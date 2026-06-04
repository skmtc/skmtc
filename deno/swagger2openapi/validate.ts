/**
 * Validates OpenAPI 3.0.x documents — structurally (a large set of targeted
 * checks) and against the bundled OpenAPI 3.0 JSON Schema (via ajv).
 *
 * Ported from swagger2openapi's `validate.js`. The original raised `should`
 * assertions; this port raises {@link ValidationError}, carrying the JSON-Pointer
 * context at which the problem was found.
 *
 * @module
 */

import * as ajvDraft04 from 'ajv-draft-04'
import * as ajvFormats from 'ajv-formats'
import type { ValidateFunction } from 'ajv'
import openapi30Schema from './schemas/openapi-3.0.json' with { type: 'json' }
import jsonV5Schema from './schemas/json_v5.json' with { type: 'json' }
import {
  isBoolean,
  isJsonArray,
  isJsonObject,
  isNumber,
  isRef,
  isString,
  type JsonObject,
  type JsonValue,
} from './json.ts'
import {
  hasDuplicates,
  parameterTypeProperties,
  resolveExternal,
  resolveInternal,
} from './common.ts'
import { jpescape, jptr, recurse, type RecurseState } from './reftools.ts'
import { getDefaultState, walkSchema, type WalkSchemaState } from './walkSchema.ts'
import { lint as defaultLinter } from './linter.ts'
import type { External, ValidateOptions } from './types.ts'

// `ajv-draft-04` and `ajv-formats` are CommonJS with a TypeScript `export default`.
// Deno's CJS interop wraps `module.exports` in a synthetic default, so the real
// default export (the class / plugin) sits one level deeper under `.default`.
const Ajv = ajvDraft04.default.default
const addFormats = ajvFormats.default.default
const ajv = new Ajv({ strict: false, allErrors: true, logger: false })
addFormats(ajv)
ajv.addFormat('uriref', { type: 'string', validate: () => true })
const validateMetaSchema: ValidateFunction = ajv.compile(jsonV5Schema)
let validateOpenAPI3: ValidateFunction = ajv.compile(openapi30Schema)

/** Error raised when a document fails validation, carrying the JSON-Pointer context. */
export class ValidationError extends Error {
  override name = 'ValidationError'
  context: string[]
  constructor(message: string, context: string[] = []) {
    super(context.length ? `${message} (at ${context[context.length - 1]})` : message)
    this.context = [...context]
  }
}

function fail(options: ValidateOptions, message: string): never {
  throw new ValidationError(message, options.context ?? [])
}
function assert(condition: boolean, options: ValidateOptions, message: string): void {
  if (!condition) fail(options, message)
}
function assertObject(
  value: JsonValue | undefined,
  options: ValidateOptions,
  message: string,
): asserts value is JsonObject {
  if (!isJsonObject(value)) fail(options, message)
}
function assertString(
  value: JsonValue | undefined,
  options: ValidateOptions,
  message: string,
): asserts value is string {
  if (!isString(value)) fail(options, message)
}

const contextStack = (options: ValidateOptions): string[] =>
  options.context ?? (options.context = [])

const contextAppend = (options: ValidateOptions, segment: string | number): void => {
  const context = contextStack(options)
  const last = context.length ? context[context.length - 1] : '#'
  context.push((last + '/' + segment).split('//').join('/'))
}

const contextPop = (options: ValidateOptions): void => {
  contextStack(options).pop()
}

const runLinter = (objectName: string, object: JsonValue, options: ValidateOptions): void => {
  if (options.lint) (options.linter ?? defaultLinter)(objectName, object, options)
}

const isEmptyValue = (value: JsonValue | undefined): boolean => {
  if (typeof value === 'undefined' || value === null) return true
  if (isString(value)) return value.length === 0
  if (isJsonArray(value)) return value.length === 0
  if (isJsonObject(value)) return Object.keys(value).length === 0
  return false
}

const validateUrl = (
  url: string,
  contextServers: JsonValue[],
  context: string,
  options: ValidateOptions,
): boolean => {
  if (!options.laxurls) assert(url !== '', options, 'Invalid empty URL ' + context)
  let base = options.origin || 'http://localhost/'
  if (contextServers.length) {
    const servers = contextServers[0]
    if (
      isJsonArray(servers) && servers.length && isJsonObject(servers[0]) && isString(servers[0].url)
    ) {
      base = servers[0].url
    }
  }
  let resolvedBase: string | undefined = base
  if (url.indexOf('://') > 0) resolvedBase = undefined // FIXME HACK
  if (options.whatwg) {
    try {
      new URL(url, resolvedBase)
    } catch {
      fail(options, 'Invalid URL ' + context)
    }
  }
  return true
}

const validateComponentName = (name: string): boolean => /^[a-zA-Z0-9.\-_]+$/.test(name)

const validateHeaderName = (name: string): boolean => /^[A-Za-z0-9!#\-$%&'*+\\.^_`|~]+$/.test(name)

const validateSchemaObject = (schema: JsonValue): void => {
  if (!validateMetaSchema(schema)) {
    throw new ValidationError('Schema invalid: ' + JSON.stringify(validateMetaSchema.errors))
  }
}

const SCHEMA_KEYWORDS = new Set([
  'type',
  'items',
  'format',
  'properties',
  'required',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'enum',
  'default',
  'description',
  'title',
  'readOnly',
  'writeOnly',
  'anyOf',
  'allOf',
  'oneOf',
  'not',
  'discriminator',
  'maxItems',
  'minItems',
  'additionalItems',
  'additionalProperties',
  'example',
  'maxLength',
  'minLength',
  'pattern',
  'uniqueItems',
  'xml',
  'externalDocs',
  'nullable',
  'minProperties',
  'maxProperties',
  'multipleOf',
])

const SCHEMA_TYPES = ['integer', 'number', 'string', 'boolean', 'object', 'array']

const STRING_FORMATS = [
  'date-time',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uri',
  'uriref',
  'byte',
  'binary',
  'date',
  'password',
]

const checkSubSchema = (
  schema: JsonObject,
  parent: JsonObject,
  state: WalkSchemaState,
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  const prop = typeof state.property === 'string' ? state.property : undefined
  if (prop) contextAppend(options, prop)
  runLinter('schema', schema, options)

  if (typeof schema.$ref !== 'undefined') {
    assertString(schema.$ref, options, '$ref should be a string')
    runLinter('reference', schema, options)
    if (prop) contextPop(options)
    return // all other properties SHALL be ignored
  }

  for (const k of Object.keys(schema)) {
    if (!k.startsWith('x-')) {
      assert(SCHEMA_KEYWORDS.has(k), options, 'Schema object cannot have additionalProperty: ' + k)
    }
  }

  const numeric = (key: string): void => {
    const value = schema[key]
    if (value) assert(isNumber(value), options, key + ' must be a number')
  }
  const numericGtMinusOne = (key: string): void => {
    const value = schema[key]
    if (value) assert(isNumber(value) && value > -1, options, key + ' must be a number > -1')
  }
  const booleanProp = (key: string): void => {
    if (typeof schema[key] !== 'undefined') {
      assert(isBoolean(schema[key]), options, key + ' must be a boolean')
    }
  }

  if (schema.multipleOf) {
    assert(
      isNumber(schema.multipleOf) && schema.multipleOf > 0,
      options,
      'multipleOf must be a number > 0',
    )
  }
  numeric('maximum')
  booleanProp('exclusiveMaximum')
  numeric('minimum')
  booleanProp('exclusiveMinimum')
  numericGtMinusOne('maxLength')
  numericGtMinusOne('minLength')
  if (schema.pattern) {
    try {
      new RegExp(String(schema.pattern))
    } catch {
      fail(options, 'pattern does not conform to ECMA-262')
    }
  }
  if (typeof schema.items !== 'undefined') {
    assert(isJsonObject(schema.items), options, 'items must be an object, not an array')
  }
  if (schema.additionalItems) {
    assert(
      isBoolean(schema.additionalItems) || isJsonObject(schema.additionalItems),
      options,
      'additionalItems must be a boolean or schema',
    )
  }
  if (schema.additionalProperties) {
    assert(
      isBoolean(schema.additionalProperties) || isJsonObject(schema.additionalProperties),
      options,
      'additionalProperties must be a boolean or schema',
    )
  }
  numericGtMinusOne('maxItems')
  numericGtMinusOne('minItems')
  booleanProp('uniqueItems')
  numericGtMinusOne('maxProperties')
  numericGtMinusOne('minProperties')
  if (typeof schema.required !== 'undefined') {
    assert(isJsonArray(schema.required), options, 'required must be an array')
    if (isJsonArray(schema.required)) {
      assert(schema.required.length > 0, options, 'required must not be empty')
      assert(!hasDuplicates(schema.required), options, 'required items must be unique')
    }
  }
  if (schema.properties) {
    assert(isJsonObject(schema.properties), options, 'properties must be an object')
  }
  if (schema.patternProperties) {
    assert(isJsonObject(schema.patternProperties), options, 'patternProperties must be an object')
    if (isJsonObject(schema.patternProperties)) {
      for (const prop2 of Object.keys(schema.patternProperties)) {
        try {
          new RegExp(prop2)
        } catch {
          fail(options, 'patternProperty ' + prop2 + ' does not conform to ECMA-262')
        }
      }
    }
  }
  if (typeof schema.enum !== 'undefined') {
    assert(isJsonArray(schema.enum), options, 'enum must be an array')
    if (isJsonArray(schema.enum)) assert(schema.enum.length > 0, options, 'enum must not be empty')
  }
  if (typeof schema.type !== 'undefined') {
    assertString(schema.type, options, 'type must be a string')
    assert(SCHEMA_TYPES.includes(schema.type), options, 'type must be a valid JSON Schema type')
    if (schema.type === 'array') {
      assert(typeof schema.items !== 'undefined', options, 'array schema requires items')
    }
  }
  for (const combiner of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (schema[combiner]) {
      assert(isJsonArray(schema[combiner]), options, combiner + ' must be an array')
      if (isJsonArray(schema[combiner])) {
        assert(schema[combiner].length > 0, options, combiner + ' must not be empty')
      }
    }
  }
  if (schema.not) {
    assert(isJsonObject(schema.not), options, 'not must be an object')
  }
  if (typeof schema.title !== 'undefined') {
    assertString(schema.title, options, 'title must be a string')
  }
  if (typeof schema.description !== 'undefined') {
    assertString(schema.description, options, 'description must be a string')
  }
  if (typeof schema.default !== 'undefined') {
    assert(
      typeof schema.type !== 'undefined',
      options,
      'a schema with a default should have a type',
    )
    let realType: string = typeof schema.default
    let schemaType = schema.type
    if (isJsonArray(schema.default)) realType = 'array'
    if (schemaType === 'integer') schemaType = 'number'
    assert(schemaType === realType, options, 'default value type should match schema type')
  }
  if (typeof schema.format !== 'undefined') {
    assertString(schema.format, options, 'format must be a string')
    if (isString(schema.type)) {
      if (STRING_FORMATS.includes(schema.format)) {
        assert(schema.type === 'string', options, `format ${schema.format} requires type string`)
      }
      if (['int32', 'int64'].includes(schema.format)) {
        if (schema.type !== 'string' && schema.type !== 'number') {
          assert(
            schema.type === 'integer',
            options,
            `format ${schema.format} requires type integer`,
          )
        }
      }
      if (['float', 'double'].includes(schema.format)) {
        if (schema.type !== 'string') {
          assert(schema.type === 'number', options, `format ${schema.format} requires type number`)
        }
      }
    }
  }
  booleanProp('nullable')
  if (typeof schema.readOnly !== 'undefined') {
    assert(isBoolean(schema.readOnly), options, 'readOnly must be a boolean')
    assert(
      typeof schema.writeOnly === 'undefined',
      options,
      'schema cannot be both readOnly and writeOnly',
    )
  }
  if (typeof schema.writeOnly !== 'undefined') {
    assert(isBoolean(schema.writeOnly), options, 'writeOnly must be a boolean')
    assert(
      typeof schema.readOnly === 'undefined',
      options,
      'schema cannot be both readOnly and writeOnly',
    )
  }
  booleanProp('deprecated')
  if (typeof schema.discriminator !== 'undefined') {
    assertObject(schema.discriminator, options, 'discriminator must be an object')
    assert('propertyName' in schema.discriminator, options, 'discriminator requires propertyName')
    assert(
      Boolean(parent.oneOf || parent.anyOf || parent.allOf),
      options,
      'discriminator requires oneOf, anyOf or allOf in parent schema',
    )
  }
  if (typeof schema.xml !== 'undefined') {
    assert(isJsonObject(schema.xml), options, 'xml must be an object')
  }

  if (isJsonObject(schema.externalDocs)) {
    assert('url' in schema.externalDocs, options, 'externalDocs requires url')
    assertString(schema.externalDocs.url, options, 'externalDocs.url must be a string')
    validateUrl(schema.externalDocs.url, [openapi.servers], 'externalDocs', options)
  }
  if (prop) contextPop(options)
  if (!prop || prop === 'schema') validateSchemaObject(schema) // top level only
}

const checkSchema = (
  schema: JsonObject,
  parent: JsonObject,
  prop: string,
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  const state = getDefaultState()
  state.property = prop
  walkSchema(schema, parent, state, (sub, subParent, walkState) => {
    checkSubSchema(sub, subParent, walkState, openapi, options)
  })
}

const EXAMPLE_KEYWORDS = ['summary', 'description', 'value', 'externalValue']

const checkExample = (
  ex: JsonObject,
  contextServers: JsonValue[],
  _openapi: JsonObject,
  options: ValidateOptions,
): void => {
  assert(!isJsonArray(ex), options, 'example must be an object, not an array')
  if (typeof ex.summary !== 'undefined') {
    assertString(ex.summary, options, 'example.summary must be a string')
  }
  if (typeof ex.description !== 'undefined') {
    assertString(ex.description, options, 'example.description must be a string')
  }
  if (typeof ex.value !== 'undefined') {
    assert(
      typeof ex.externalValue === 'undefined',
      options,
      'example cannot have both value and externalValue',
    )
  }
  if (typeof ex.externalValue !== 'undefined') {
    assertString(ex.externalValue, options, 'example.externalValue must be a string')
    assert(
      typeof ex.value === 'undefined',
      options,
      'example cannot have both value and externalValue',
    )
    validateUrl(ex.externalValue, contextServers, 'examples..externalValue', options)
  }
  for (const k of Object.keys(ex)) {
    if (!k.startsWith('x-')) {
      assert(
        EXAMPLE_KEYWORDS.includes(k),
        options,
        'Example object cannot have additionalProperty: ' + k,
      )
    }
  }
  runLinter('example', ex, options)
}

const MEDIA_TYPE_RE = /[a-zA-Z0-9!#$%^&*_\-+{}|'.`~]+\/[a-zA-Z0-9!#$%^&*_\-+{}|'.`~]+/

const checkContent = (
  content: JsonObject,
  contextServers: JsonValue[],
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  contextAppend(options, 'content')
  for (const ct of Object.keys(content)) {
    assert(MEDIA_TYPE_RE.test(ct), options, 'media-type should match RFC6838 format')
    contextAppend(options, jpescape(ct))
    const contentType = content[ct]
    assertObject(contentType, options, 'content media type must be an object')
    if (typeof contentType.schema !== 'undefined') {
      assertObject(contentType.schema, options, 'media type schema must be an object')
      checkSchema(contentType.schema, {}, 'schema', openapi, options)
    }
    if (contentType.example) {
      assert(
        typeof contentType.examples === 'undefined',
        options,
        'content cannot have both example and examples',
      )
    }
    if (isJsonObject(contentType.examples)) {
      contextAppend(options, 'examples')
      assert(
        typeof contentType.example === 'undefined',
        options,
        'content cannot have both example and examples',
      )
      for (const e of Object.keys(contentType.examples)) {
        const ex = contentType.examples[e]
        if (isJsonObject(ex) && isRef(ex, '$ref')) {
          runLinter('reference', ex, options)
        } else if (isJsonObject(ex)) {
          checkExample(ex, contextServers, openapi, options)
        }
      }
      contextPop(options)
    }
    contextPop(options)
  }
  contextPop(options)
}

const checkServer = (server: JsonObject, options: ValidateOptions): void => {
  assert('url' in server, options, 'server requires url')
  if (isString(server.url)) validateUrl(server.url, [], 'server.url', options)
  let serverVars = 0
  if (isString(server.url)) {
    for (const m of server.url.matchAll(/\{(.+?)\}/g)) {
      serverVars++
      assert(isJsonObject(server.variables), options, 'server requires variables')
      assert(
        isJsonObject(server.variables) && m[1] in server.variables,
        options,
        'server variable ' + m[1] + ' not found',
      )
    }
  }
  if (isJsonObject(server.variables)) {
    contextAppend(options, 'variables')
    for (const v of Object.keys(server.variables)) {
      contextAppend(options, v)
      const variable = server.variables[v]
      assertObject(variable, options, 'server variable must be an object')
      assert('default' in variable, options, 'server variable requires default')
      assertString(variable.default, options, 'server variable default must be a string')
      if (typeof variable.enum !== 'undefined') {
        contextAppend(options, 'enum')
        assert(isJsonArray(variable.enum), options, 'server variable enum must be an array')
        if (isJsonArray(variable.enum)) {
          assert(variable.enum.length !== 0, options, 'Server variables enum should not be empty')
          variable.enum.forEach((entry, index) => {
            contextAppend(options, index)
            assert(isString(entry), options, 'server variable enum entries must be strings')
            contextPop(options)
          })
        }
        contextPop(options)
      }
      runLinter('serverVariable', variable, options)
      contextPop(options)
    }
    assert(
      Object.keys(server.variables).length === serverVars,
      options,
      'server variable count mismatch',
    )
    contextPop(options)
  }
  runLinter('server', server, options)
}

const checkServers = (servers: JsonValue[], options: ValidateOptions): void => {
  servers.forEach((server, index) => {
    contextAppend(options, index)
    if (isJsonObject(server)) checkServer(server, options)
    contextPop(options)
  })
}

const checkLink = (link: JsonObject, options: ValidateOptions): void => {
  if (typeof link.operationRef !== 'undefined') {
    assertString(link.operationRef, options, 'link.operationRef must be a string')
    assert(
      typeof link.operationId === 'undefined',
      options,
      'link cannot have both operationRef and operationId',
    )
  } else {
    assert('operationId' in link, options, 'link requires operationId or operationRef')
  }
  if (typeof link.operationId !== 'undefined') {
    assertString(link.operationId, options, 'link.operationId must be a string')
    assert(
      typeof link.operationRef === 'undefined',
      options,
      'link cannot have both operationRef and operationId',
    )
  } else {
    assert('operationRef' in link, options, 'link requires operationId or operationRef')
  }
  if (typeof link.parameters !== 'undefined') {
    assert(isJsonObject(link.parameters), options, 'link.parameters must be an object')
  }
  if (typeof link.description !== 'undefined') {
    assertString(link.description, options, 'link.description must be a string')
  }
  if (isJsonObject(link.server)) checkServer(link.server, options)
  runLinter('link', link, options)
}

const checkHeader = (
  headerArg: JsonValue,
  contextServers: JsonValue[],
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  let header = headerArg
  if (isJsonObject(header) && isRef(header, '$ref')) {
    const ref = header.$ref
    assertString(ref, options, 'header $ref must be a string')
    runLinter('reference', header, options)
    const resolved = resolveInternal(openapi, ref)
    assert(
      resolved !== false && isJsonObject(resolved),
      options,
      'Could not resolve reference ' + ref,
    )
    if (isJsonObject(resolved)) header = resolved
  }
  assertObject(header, options, 'header must be an object')
  assert(!('name' in header), options, 'header should not have a name property')
  assert(!('in' in header), options, 'header should not have an in property')
  assert(!('type' in header), options, 'header should not have a type property')
  for (const prop of parameterTypeProperties) {
    assert(!(prop in header), options, 'header should not have property ' + prop)
  }
  if (header.schema) {
    assert(!('content' in header), options, 'header cannot have both schema and content')
    if (typeof header.style !== 'undefined') {
      assertString(header.style, options, 'header.style must be a string')
      assert(header.style === 'simple', options, 'header style must be simple')
    }
    if (typeof header.explode !== 'undefined') {
      assert(isBoolean(header.explode), options, 'header.explode must be a boolean')
    }
    if (typeof header.allowReserved !== 'undefined') {
      assert(isBoolean(header.allowReserved), options, 'header.allowReserved must be a boolean')
    }
    if (isJsonObject(header.schema)) checkSchema(header.schema, {}, 'schema', openapi, options)
  }
  if (header.content) {
    assert(!('schema' in header), options, 'header cannot have both content and schema')
    assert(!('style' in header), options, 'header with content cannot have style')
    assert(!('explode' in header), options, 'header with content cannot have explode')
    assert(!('allowReserved' in header), options, 'header with content cannot have allowReserved')
    assert(!('example' in header), options, 'header with content cannot have example')
    assert(!('examples' in header), options, 'header with content cannot have examples')
    if (isJsonObject(header.content)) checkContent(header.content, contextServers, openapi, options)
  }
  if (!header.schema && !header.content) {
    assert('schema' in header, options, 'Header should have schema or content')
  }
  runLinter('header', header, options)
}

const checkResponse = (
  responseArg: JsonValue,
  contextServers: JsonValue[],
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  let response = responseArg
  if (isJsonObject(response) && isRef(response, '$ref')) {
    const ref = response.$ref
    assertString(ref, options, 'response $ref must be a string')
    runLinter('reference', response, options)
    const resolved = resolveInternal(openapi, ref)
    assert(
      resolved !== false && isJsonObject(resolved),
      options,
      'Could not resolve reference ' + ref,
    )
    if (isJsonObject(resolved)) response = resolved
  }
  assertObject(response, options, 'response must be an object')
  assert('description' in response, options, 'response requires description')
  assertString(response.description, options, 'response description should be of type string')
  assert(!('examples' in response), options, 'response should not have examples (2.0 only)')
  if (typeof response.schema !== 'undefined') {
    assertObject(response.schema, options, 'response schema must be an object')
    checkSchema(response.schema, {}, 'schema', openapi, options)
  }
  if (isJsonObject(response.headers)) {
    contextAppend(options, 'headers')
    for (const h of Object.keys(response.headers)) {
      contextAppend(options, h)
      assert(validateHeaderName(h), options, "Header doesn't match RFC7230 pattern")
      checkHeader(response.headers[h], contextServers, openapi, options)
      contextPop(options)
    }
    contextPop(options)
  }
  if (isJsonObject(response.content)) {
    checkContent(response.content, contextServers, openapi, options)
  }
  if (typeof response.links !== 'undefined') {
    contextAppend(options, 'links')
    if (isJsonObject(response.links)) {
      for (const l of Object.keys(response.links)) {
        contextAppend(options, l)
        const link = response.links[l]
        if (isJsonObject(link)) checkLink(link, options)
        contextPop(options)
      }
    }
    contextPop(options)
  }
  runLinter('response', response, options)
}

const checkParam = (
  paramArg: JsonValue,
  index: string | number,
  path: string,
  contextServers: JsonValue[],
  openapi: JsonObject,
  options: ValidateOptions,
): JsonObject => {
  contextAppend(options, index)
  let param = paramArg
  if (isJsonObject(param) && isRef(param, '$ref')) {
    const ref = param.$ref
    assertString(ref, options, 'parameter $ref must be a string')
    runLinter('reference', param, options)
    const resolved = resolveInternal(openapi, ref)
    assert(
      resolved !== false && isJsonObject(resolved),
      options,
      'Could not resolve reference ' + ref,
    )
    if (isJsonObject(resolved)) param = resolved
  }
  assertObject(param, options, 'parameter must be an object')
  assert('name' in param, options, 'parameter requires name')
  assertString(param.name, options, 'parameter name must be a string')
  assert('in' in param, options, 'parameter requires in')
  assertString(param.in, options, 'parameter in must be a string')
  assert(
    ['query', 'header', 'path', 'cookie'].includes(param.in),
    options,
    'parameter in must be query, header, path or cookie',
  )
  if (param.in === 'path') {
    assert('required' in param, options, 'Path parameters must have an explicit required:true')
    assert(param.required === true, options, 'Path parameters must have an explicit required:true')
    if (path) {
      assert(
        path.indexOf('{' + param.name + '}') >= 0,
        options,
        'path parameters must appear in the path',
      )
    }
  }
  if (typeof param.required !== 'undefined') {
    assert(isBoolean(param.required), options, 'required must be a boolean')
  }
  assert(!('items' in param), options, 'parameter should not have items')
  assert(!('collectionFormat' in param), options, 'parameter should not have collectionFormat')
  assert(!('type' in param), options, 'parameter should not have type')
  for (const prop of parameterTypeProperties) {
    assert(!(prop in param), options, 'parameter should not have property ' + prop)
  }
  assert(param.in !== 'body', options, 'Parameter type body is no-longer valid')
  assert(param.in !== 'formData', options, 'Parameter type formData is no-longer valid')
  if (param.description) {
    assertString(param.description, options, 'parameter description must be a string')
  }
  if (param.schema) {
    assert(!('content' in param), options, 'parameter cannot have both schema and content')
    checkParamStyle(param, options)
    if (typeof param.example !== 'undefined') {
      assert(!('examples' in param), options, 'parameter cannot have both example and examples')
    }
    if (typeof param.examples !== 'undefined') {
      contextAppend(options, 'examples')
      assert(!('example' in param), options, 'parameter cannot have both example and examples')
      assertObject(param.examples, options, 'parameter examples must be an object')
      for (const e of Object.keys(param.examples)) {
        contextAppend(options, e)
        const example = param.examples[e]
        if (isJsonObject(example)) checkExample(example, contextServers, openapi, options)
        contextPop(options)
      }
      contextPop(options)
    }
    if (isJsonObject(param.schema)) checkSchema(param.schema, {}, 'schema', openapi, options)
  }
  if (param.content) {
    assert(!('schema' in param), options, 'parameter with content cannot have schema')
    assert(!('style' in param), options, 'parameter with content cannot have style')
    assert(!('explode' in param), options, 'parameter with content cannot have explode')
    assert(!('allowReserved' in param), options, 'parameter with content cannot have allowReserved')
    assert(!('example' in param), options, 'parameter with content cannot have example')
    assert(!('examples' in param), options, 'parameter with content cannot have examples')
    assert(
      isJsonObject(param.content) && Object.keys(param.content).length === 1,
      options,
      'Parameter content must have only one entry',
    )
    if (isJsonObject(param.content)) checkContent(param.content, contextServers, openapi, options)
  }
  if (!param.schema && !param.content) {
    assert('schema' in param, options, 'Parameter should have schema or content')
  }
  runLinter('parameter', param, options)
  contextPop(options)
  return param
}

const checkParamStyle = (param: JsonObject, options: ValidateOptions): void => {
  if (typeof param.style === 'undefined') return
  assertString(param.style, options, 'parameter style must be a string')
  if (param.in === 'path') {
    for (const forbidden of ['form', 'spaceDelimited', 'pipeDelimited', 'deepObject']) {
      assert(param.style !== forbidden, options, `path parameter style cannot be ${forbidden}`)
    }
  }
  if (param.in === 'query') {
    for (const forbidden of ['matrix', 'label', 'simple']) {
      assert(param.style !== forbidden, options, `query parameter style cannot be ${forbidden}`)
    }
  }
  if (param.in === 'header') {
    assert(param.style === 'simple', options, 'header parameter style must be simple')
  }
  if (param.in === 'cookie') {
    assert(param.style === 'form', options, 'cookie parameter style must be form')
  }
  if (typeof param.explode !== 'undefined') {
    assert(isBoolean(param.explode), options, 'parameter explode must be a boolean')
  }
  if (typeof param.allowReserved !== 'undefined') {
    assert(isBoolean(param.allowReserved), options, 'parameter allowReserved must be a boolean')
  }
}

const checkPathItem = (
  pathItem: JsonObject,
  path: string,
  openapi: JsonObject,
  options: ValidateOptions,
): boolean => {
  const contextServers: JsonValue[] = []
  contextServers.push(openapi.servers)
  if (pathItem.servers) contextServers.push(pathItem.servers)

  const pathParameters: Record<string, JsonObject> = {}
  if (isJsonArray(pathItem.parameters)) {
    pathItem.parameters.forEach((rawParam, index) => {
      const param = checkParam(rawParam, index, path, contextServers, openapi, options)
      const key = param.in + ':' + param.name
      if (pathParameters[key]) fail(options, 'Duplicate path-level parameter ' + String(param.name))
      pathParameters[key] = param
    })
  }

  for (const o of Object.keys(pathItem)) {
    contextAppend(options, o)
    const op = pathItem[o]
    if (o === '$ref') {
      assert(Boolean(op), options, '$ref should not be empty')
      assertString(op, options, '$ref must be a string')
      if (isString(op)) {
        assert(!op.startsWith('#/'), options, 'PathItem $refs must be external (' + op + ')')
      }
      runLinter('reference', isJsonObject(op) ? op : {}, options)
    } else if (o === 'parameters') {
      // checked above
    } else if (o === 'servers') {
      contextAppend(options, 'servers')
      if (isJsonArray(op)) checkServers(op, options)
      contextPop(options)
    } else if (o === 'summary') {
      assertString(pathItem.summary, options, 'pathItem.summary must be a string')
    } else if (o === 'description') {
      assertString(pathItem.description, options, 'pathItem.description must be a string')
    } else if (HTTP_VERBS.includes(o)) {
      assertObject(op, options, 'operation must be an object')
      assert(Object.keys(op).length > 0, options, 'operation must not be empty')
      assert(!('consumes' in op), options, 'operation should not have consumes')
      assert(!('produces' in op), options, 'operation should not have produces')
      assert(!('schemes' in op), options, 'operation should not have schemes')
      assert('responses' in op, options, 'operation requires responses')
      assert(!isEmptyValue(op.responses), options, 'operation responses must not be empty')
      if (op.summary) assertString(op.summary, options, 'operation.summary must be a string')
      if (op.description) {
        assertString(op.description, options, 'operation.description must be a string')
      }
      if (typeof op.operationId !== 'undefined') {
        assertString(op.operationId, options, 'operationId must be a string')
        const operationIds = options.operationIds ?? (options.operationIds = [])
        assert(operationIds.indexOf(op.operationId) < 0, options, 'operationIds must be unique')
        operationIds.push(op.operationId)
      }

      if (op.servers) {
        contextAppend(options, 'servers')
        if (isJsonArray(op.servers)) checkServers(op.servers, options)
        contextPop(options)
        contextServers.push(op.servers)
      }

      if (isJsonObject(op.requestBody) && op.requestBody.content) {
        contextAppend(options, 'requestBody')
        assert('content' in op.requestBody, options, 'requestBody requires content')
        if (typeof op.requestBody.description !== 'undefined') {
          assertString(
            op.requestBody.description,
            options,
            'requestBody.description must be a string',
          )
        }
        if (typeof op.requestBody.required !== 'undefined') {
          assert(
            isBoolean(op.requestBody.required),
            options,
            'requestBody.required must be a boolean',
          )
        }
        if (isJsonObject(op.requestBody.content)) {
          checkContent(op.requestBody.content, contextServers, openapi, options)
        }
        contextPop(options)
      }

      contextAppend(options, 'responses')
      if (isJsonObject(op.responses)) {
        for (const r of Object.keys(op.responses)) {
          if (!r.startsWith('x-')) {
            contextAppend(options, r)
            checkResponse(op.responses[r], contextServers, openapi, options)
            contextPop(options)
          }
        }
      }
      contextPop(options)

      if (isJsonArray(op.parameters)) {
        const opParameters: Record<string, JsonObject> = {}
        contextAppend(options, 'parameters')
        op.parameters.forEach((rawParam, index) => {
          const param = checkParam(rawParam, index, path, contextServers, openapi, options)
          const key = param.in + ':' + param.name
          if (opParameters[key]) {
            fail(options, 'Duplicate operation-level parameter ' + String(param.name))
          }
          opParameters[key] = param
        })
        const contextParameters = { ...pathParameters, ...opParameters }
        for (const m of path.matchAll(/\{(.+?)\}/g)) {
          assert(
            Boolean(contextParameters['path:' + m[1]]),
            options,
            'Templated parameter ' + m[1] + ' not found',
          )
        }
        contextPop(options)
      }
      if (isJsonObject(op.externalDocs)) {
        contextAppend(options, 'externalDocs')
        assert('url' in op.externalDocs, options, 'externalDocs requires url')
        assertString(op.externalDocs.url, options, 'externalDocs.url must be a string')
        validateUrl(op.externalDocs.url, contextServers, 'externalDocs', options)
        contextPop(options)
      }
      if (isJsonObject(op.callbacks)) {
        contextAppend(options, 'callbacks')
        for (const c of Object.keys(op.callbacks)) {
          const callback = op.callbacks[c]
          if (isJsonObject(callback) && isRef(callback, '$ref')) {
            runLinter('reference', callback, options)
          } else if (isJsonObject(callback)) {
            contextAppend(options, c)
            for (const p of Object.keys(callback)) {
              const cbPi = callback[p]
              if (isJsonObject(cbPi)) checkPathItem(cbPi, p, openapi, options)
            }
            contextPop(options)
          }
        }
        contextPop(options)
      }
      if (op.security) checkSecurity(op.security, openapi, options)
      runLinter('operation', op, options)
    }
    contextPop(options)
  }
  runLinter('pathItem', pathItem, options)
  return true
}

const checkSecurity = (
  security: JsonValue,
  openapi: JsonObject,
  options: ValidateOptions,
): void => {
  contextAppend(options, 'security')
  assert(isJsonArray(security), options, 'security must be an array')
  if (isJsonArray(security)) {
    for (const sr of security) {
      assertObject(sr, options, 'security requirement must be an object')
      for (const i of Object.keys(sr)) {
        assert(isJsonArray(sr[i]), options, 'security requirement scopes must be an array')
        const sec = jptr(openapi, '#/components/securitySchemes/' + i)
        assert(
          sec !== false && isJsonObject(sec),
          options,
          'Could not dereference securityScheme ' + i,
        )
        if (isJsonObject(sec) && sec.type !== 'oauth2') {
          assert(
            isJsonArray(sr[i]) && sr[i].length === 0,
            options,
            'non-oauth2 security requirement must have empty scopes',
          )
        }
      }
    }
  }
  runLinter('security', security, options)
  contextPop(options)
}

const HTTP_VERBS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']
const OPENAPI_KEYWORDS = [
  'openapi',
  'info',
  'servers',
  'security',
  'externalDocs',
  'tags',
  'paths',
  'components',
]

const setupOptions = (options: ValidateOptions): void => {
  options.context = ['#/']
  options.warnings = []
  options.operationIds = []
  options.violations = options.violations ?? []
  if (!options.cache) options.cache = {}
}

/**
 * Synchronously validates an OpenAPI 3.0.x document, throwing
 * {@link ValidationError} on the first problem found. Returns `true` when valid.
 */
export const validateSync = (openapi: JsonValue, options: ValidateOptions): boolean => {
  setupOptions(options)
  assertObject(openapi, options, 'openapi document must be an object')

  if (options.jsonschema) {
    // (intentionally unsupported in the port; kept here for parity of the option)
  }

  assert(!('swagger' in openapi), options, 'document should not have a swagger key')
  assert('openapi' in openapi, options, 'document requires an openapi version')
  assertString(openapi.openapi, options, 'openapi version must be a string')
  assert(openapi.openapi.startsWith('3.0.'), options, 'Must be an OpenAPI 3.0.x document')
  for (
    const forbidden of [
      'host',
      'basePath',
      'schemes',
      'definitions',
      'parameters',
      'responses',
      'securityDefinitions',
      'produces',
      'consumes',
    ]
  ) {
    assert(!(forbidden in openapi), options, 'OpenAPI object cannot have ' + forbidden)
  }
  for (const k of Object.keys(openapi)) {
    if (!k.startsWith('x-')) {
      assert(
        OPENAPI_KEYWORDS.includes(k),
        options,
        'OpenAPI object cannot have additionalProperty: ' + k,
      )
    }
  }

  assert('info' in openapi, options, 'document requires info')
  contextAppend(options, 'info')
  assertObject(openapi.info, options, 'info must be an object')
  assert('title' in openapi.info, options, 'info requires title')
  assertString(openapi.info.title, options, 'title should be of type string')
  assert('version' in openapi.info, options, 'info requires version')
  assertString(openapi.info.version, options, 'version should be of type string')
  const emptyServers: JsonValue[] = []
  if (isJsonObject(openapi.info.license)) {
    contextAppend(options, 'license')
    assert('name' in openapi.info.license, options, 'license requires name')
    assertString(openapi.info.license.name, options, 'license.name must be a string')
    if (typeof openapi.info.license.url !== 'undefined') {
      assertString(openapi.info.license.url, options, 'license.url must be a string')
      assert(openapi.info.license.url !== '', options, 'license.url must not be empty')
      validateUrl(openapi.info.license.url, emptyServers, 'license.url', options)
    }
    runLinter('license', openapi.info.license, options)
    contextPop(options)
  }
  if (typeof openapi.info.termsOfService !== 'undefined') {
    assert(openapi.info.termsOfService !== null, options, 'termsOfService must not be null')
    if (isString(openapi.info.termsOfService)) {
      validateUrl(openapi.info.termsOfService, emptyServers, 'termsOfService', options)
    }
  }
  if (typeof openapi.info.contact !== 'undefined') {
    contextAppend(options, 'contact')
    assertObject(openapi.info.contact, options, 'contact must be an object')
    if (typeof openapi.info.contact.url !== 'undefined') {
      assertString(openapi.info.contact.url, options, 'contact.url must be a string')
      validateUrl(openapi.info.contact.url, emptyServers, 'url', options)
    }
    if (typeof openapi.info.contact.email !== 'undefined') {
      assertString(openapi.info.contact.email, options, 'contact.email must be a string')
      assert(
        openapi.info.contact.email.indexOf('@') >= 0,
        options,
        'Contact email must be a valid email address',
      )
    }
    runLinter('contact', openapi.info.contact, options)
    contextPop(options)
  }
  runLinter('info', openapi.info, options)
  contextPop(options)

  const contextServers: JsonValue[] = []
  if (openapi.servers) {
    contextAppend(options, 'servers')
    assert(isJsonArray(openapi.servers), options, 'servers must be an array')
    if (isJsonArray(openapi.servers)) checkServers(openapi.servers, options)
    contextPop(options)
    contextServers.push(openapi.servers)
  }
  if (isJsonObject(openapi.externalDocs)) {
    contextAppend(options, 'externalDocs')
    assert('url' in openapi.externalDocs, options, 'externalDocs requires url')
    assertString(openapi.externalDocs.url, options, 'externalDocs.url must be a string')
    validateUrl(openapi.externalDocs.url, contextServers, 'externalDocs', options)
    contextPop(options)
  }

  if (isJsonArray(openapi.tags)) {
    contextAppend(options, 'tags')
    const tagsSeen = new Set<string>()
    for (const tag of openapi.tags) {
      if (!isJsonObject(tag)) continue
      assert('name' in tag, options, 'tag requires name')
      if (isString(tag.name)) {
        contextAppend(options, tag.name)
        assert(!tagsSeen.has(tag.name), options, 'Tag names must be unique')
        tagsSeen.add(tag.name)
      }
      if (isJsonObject(tag.externalDocs)) {
        contextAppend(options, 'externalDocs')
        assert('url' in tag.externalDocs, options, 'tag externalDocs requires url')
        assertString(tag.externalDocs.url, options, 'tag externalDocs.url must be a string')
        validateUrl(tag.externalDocs.url, contextServers, 'tag.externalDocs', options)
        contextPop(options)
      }
      if (isString(tag.name)) contextPop(options)
    }
    contextPop(options)
  }

  if (openapi.security) checkSecurity(openapi.security, openapi, options)

  validateComponents(openapi, contextServers, options)

  checkRefs(openapi, options)
  checkPaths(openapi, options)

  if (!validateOpenAPI3(openapi)) {
    throw new ValidationError(
      'Failed OpenAPI3 schema validation: ' + JSON.stringify(validateOpenAPI3.errors, null, 2),
    )
  }

  options.valid = !options.expectFailure
  runLinter('openapi', openapi, options)
  return options.valid
}

const checkRefs = (openapi: JsonObject, options: ValidateOptions): void => {
  recurse(openapi, null, (container, key, state: RecurseState) => {
    if (!isJsonObject(container)) return
    if (!isRef(container, key)) return
    const ref = container[key]
    if (!isString(ref)) return
    contextStack(options).push(state.path)
    assert(!ref.startsWith('#/definitions/'), options, 'Reference to #/definitions is not allowed')
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref)
    const isFragmentOnly = ref.startsWith('#')
    if (!hasProtocol && isFragmentOnly) {
      assert(ref + '/$ref' !== state.path, options, 'Circular reference')
      assert(jptr(openapi, ref) !== false, options, 'Cannot resolve reference: ' + ref)
    }
    contextPop(options)
  })
}

const checkPaths = (openapi: JsonObject, options: ValidateOptions): void => {
  const paths: Record<string, boolean> = {}
  if (isJsonObject(openapi.paths)) {
    for (const p of Object.keys(openapi.paths)) {
      contextStack(options).push('#/paths/' + jpescape(p))
      if (!p.startsWith('x-')) {
        assert(p.startsWith('/'), options, 'path must start with /')
        let pCount = 0
        const template = p.replace(/\{(.+?)\}/g, () => '{' + pCount++ + '}')
        if (paths[template] && !openapi['x-hasEquivalentPaths']) {
          fail(options, 'Identical path templates detected')
        }
        paths[template] = true
        const templateCheck = p.replace(/\{(.+?)\}/g, () => '')
        assert(
          templateCheck.indexOf('{') < 0 && templateCheck.indexOf('}') < 0,
          options,
          'Mismatched {} in path template',
        )
        const pathItem = openapi.paths[p]
        if (isJsonObject(pathItem)) checkPathItem(pathItem, p, openapi, options)
      }
      contextPop(options)
    }
  }
  if (isJsonObject(openapi['x-ms-paths'])) {
    for (const p of Object.keys(openapi['x-ms-paths'])) {
      contextStack(options).push('#/x-ms-paths/' + jpescape(p))
      assert(p.startsWith('/'), options, 'path must start with /')
      const pathItem = openapi['x-ms-paths'][p]
      if (isJsonObject(pathItem)) checkPathItem(pathItem, p, openapi, options)
      contextPop(options)
    }
  }
}

const validateComponents = (
  openapi: JsonObject,
  contextServers: JsonValue[],
  options: ValidateOptions,
): void => {
  const components = openapi.components
  if (!isJsonObject(components)) return

  if (isJsonObject(components.securitySchemes)) {
    for (const s of Object.keys(components.securitySchemes)) {
      contextStack(options).push('#/components/securitySchemes/' + s)
      assert(validateComponentName(s), options, 'component name invalid')
      const scheme = components.securitySchemes[s]
      if (isJsonObject(scheme)) checkSecurityScheme(scheme, contextServers, options)
      contextPop(options)
    }
  }

  const sections: Array<[string, (value: JsonObject) => void]> = [
    ['parameters', (value) => checkParam(value, '', '', contextServers, openapi, options)],
    ['schemas', (value) => checkSchema(value, { anyOf: {} }, '', openapi, options)],
    ['responses', (value) => checkResponse(value, contextServers, openapi, options)],
    ['headers', (value) => checkHeader(value, contextServers, openapi, options)],
    ['examples', (value) => {
      if (isRef(value, '$ref')) runLinter('reference', value, options)
      else checkExample(value, openapi.servers ? [openapi.servers] : [], openapi, options)
    }],
    ['links', (value) => {
      if (isRef(value, '$ref')) runLinter('reference', value, options)
      else checkLink(value, options)
    }],
  ]

  for (const [section, check] of sections) {
    const group = components[section]
    if (!isJsonObject(group)) continue
    contextStack(options).push('#/components/' + section)
    for (const name of Object.keys(group)) {
      contextStack(options).push('#/components/' + section + '/' + name)
      assert(validateComponentName(name), options, 'component name invalid')
      const member = group[name]
      if (isJsonObject(member)) check(member)
      contextPop(options)
    }
    contextPop(options)
  }

  if (isJsonObject(components.requestBodies)) {
    contextStack(options).push('#/components/requestBodies')
    for (const r of Object.keys(components.requestBodies)) {
      contextStack(options).push('#/components/requestBodies/' + r)
      assert(validateComponentName(r), options, 'component name invalid')
      if (r.startsWith('requestBody')) {
        ;(options.warnings ?? (options.warnings = [])).push('Anonymous requestBody: ' + r)
      }
      const rb = components.requestBodies[r]
      if (isJsonObject(rb)) {
        assert('content' in rb, options, 'requestBody requires content')
        if (typeof rb.description !== 'undefined') {
          assertString(rb.description, options, 'requestBody.description must be a string')
        }
        if (typeof rb.required !== 'undefined') {
          assert(isBoolean(rb.required), options, 'requestBody.required must be a boolean')
        }
        if (isJsonObject(rb.content)) {
          checkContent(rb.content, openapi.servers ? [openapi.servers] : [], openapi, options)
        }
      }
      contextPop(options)
    }
    contextPop(options)
  }

  if (isJsonObject(components.callbacks)) {
    contextStack(options).push('#/components/callbacks')
    for (const c of Object.keys(components.callbacks)) {
      contextStack(options).push('#/components/callbacks/' + c)
      assert(validateComponentName(c), options, 'component name invalid')
      const cb = components.callbacks[c]
      if (isJsonObject(cb) && isRef(cb, '$ref')) {
        runLinter('reference', cb, options)
      } else if (isJsonObject(cb)) {
        for (const exp of Object.keys(cb)) {
          const cbPi = cb[exp]
          if (isJsonObject(cbPi)) checkPathItem(cbPi, exp, openapi, options)
        }
      }
      contextPop(options)
    }
    contextPop(options)
  }
}

const checkSecurityScheme = (
  scheme: JsonObject,
  contextServers: JsonValue[],
  options: ValidateOptions,
): void => {
  assert('type' in scheme, options, 'securityScheme requires type')
  assertString(scheme.type, options, 'securityScheme type must be a string')
  assert(scheme.type !== 'basic', options, 'Security scheme basic should be http with scheme basic')
  assert(
    ['apiKey', 'http', 'oauth2', 'openIdConnect'].includes(scheme.type),
    options,
    'securityScheme type must be apiKey, http, oauth2 or openIdConnect',
  )
  if (scheme.type === 'http') {
    assert('scheme' in scheme, options, 'http securityScheme requires scheme')
    assertString(scheme.scheme, options, 'http securityScheme scheme must be a string')
    if (scheme.scheme !== 'bearer') {
      assert(!('bearerFormat' in scheme), options, 'bearerFormat only valid for bearer scheme')
    }
  } else {
    assert(!('scheme' in scheme), options, 'scheme only valid for http securityScheme')
    assert(!('bearerFormat' in scheme), options, 'bearerFormat only valid for http securityScheme')
  }
  if (scheme.type === 'apiKey') {
    assert('name' in scheme, options, 'apiKey securityScheme requires name')
    assertString(scheme.name, options, 'apiKey name must be a string')
    assert('in' in scheme, options, 'apiKey securityScheme requires in')
    assertString(scheme.in, options, 'apiKey in must be a string')
    assert(
      ['query', 'header', 'cookie'].includes(scheme.in),
      options,
      'apiKey in must be query, header or cookie',
    )
  } else {
    assert(!('name' in scheme), options, 'name only valid for apiKey securityScheme')
    assert(!('in' in scheme), options, 'in only valid for apiKey securityScheme')
  }
  if (scheme.type === 'oauth2') {
    assert(!('flow' in scheme), options, 'oauth2 securityScheme should not have flow (2.0 only)')
    assert('flows' in scheme, options, 'oauth2 securityScheme requires flows')
    if (isJsonObject(scheme.flows)) {
      for (const f of Object.keys(scheme.flows)) {
        const flow = scheme.flows[f]
        if (!isJsonObject(flow)) continue
        if (f === 'implicit' || f === 'authorizationCode') {
          assert('authorizationUrl' in flow, options, f + ' flow requires authorizationUrl')
          assertString(flow.authorizationUrl, options, 'authorizationUrl must be a string')
          validateUrl(flow.authorizationUrl, contextServers, 'authorizationUrl', options)
        } else {
          assert(
            !('authorizationUrl' in flow),
            options,
            f + ' flow should not have authorizationUrl',
          )
        }
        if (f === 'password' || f === 'clientCredentials' || f === 'authorizationCode') {
          assert('tokenUrl' in flow, options, f + ' flow requires tokenUrl')
          assertString(flow.tokenUrl, options, 'tokenUrl must be a string')
          validateUrl(flow.tokenUrl, contextServers, 'tokenUrl', options)
        } else {
          assert(!('tokenUrl' in flow), options, f + ' flow should not have tokenUrl')
        }
        if (typeof flow.refreshUrl !== 'undefined' && isString(flow.refreshUrl)) {
          validateUrl(flow.refreshUrl, contextServers, 'refreshUrl', options)
        }
        assert('scopes' in flow, options, f + ' flow requires scopes')
      }
    }
  } else {
    assert(!('flows' in scheme), options, 'flows only valid for oauth2 securityScheme')
  }
  if (scheme.type === 'openIdConnect') {
    assert(
      'openIdConnectUrl' in scheme,
      options,
      'openIdConnect securityScheme requires openIdConnectUrl',
    )
    assertString(scheme.openIdConnectUrl, options, 'openIdConnectUrl must be a string')
    validateUrl(scheme.openIdConnectUrl, contextServers, 'openIdConnectUrl', options)
  } else {
    assert(
      !('openIdConnectUrl' in scheme),
      options,
      'openIdConnectUrl only valid for openIdConnect securityScheme',
    )
  }
}

const findExternalRefs = (
  master: JsonValue,
  options: ValidateOptions,
  externals: External[],
  actions: Promise<JsonValue>[],
): JsonValue => {
  recurse(master, {}, (container, key, state: RecurseState) => {
    if (!isJsonObject(container)) return
    if (!isRef(container, key)) return
    const ref = container[key]
    if (!isString(ref) || ref.startsWith('#')) return
    contextStack(options).push(state.path)
    actions.push(
      resolveExternal(master, ref, options, (data) => {
        const parent = state.parent
        const resolved = findExternalRefs(data, options, externals, actions)
        if (isJsonObject(parent)) parent[state.pkey] = resolved
        else if (isJsonArray(parent)) parent[Number(state.pkey)] = resolved
      }),
    )
    contextPop(options)
  })
  return master
}

/** Like {@link validateSync}, but resolves external `$ref`s first (asynchronous). */
export const validate = async (openapi: JsonValue, options: ValidateOptions): Promise<boolean> => {
  setupOptions(options)
  const externals: External[] = []
  if (options.resolve) {
    const actions: Promise<JsonValue>[] = []
    findExternalRefs(openapi, options, externals, actions)
    for (const action of actions) await action
  }
  options.context = []
  return validateSync(openapi, options)
}

/** Replaces the OpenAPI 3.0 schema used for validation (e.g. a custom or newer schema). */
export const setOpenApiSchema = (schema: JsonObject): void => {
  validateOpenAPI3 = ajv.compile(schema)
}
