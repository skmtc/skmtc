/**
 * Converts Swagger 2.0 definitions to OpenAPI 3.0.x.
 *
 * The synchronous core ({@link convertObj}, {@link convertStr}) operates on an
 * in-memory document. The asynchronous wrappers ({@link convertFile},
 * {@link convertUrl}, {@link convertStream}, {@link convertObjResolve}) add the
 * file/network I/O and external `$ref` resolution that genuinely require it.
 *
 * Ported from [swagger2openapi](https://github.com/Mermade/swagger2openapi) by
 * Mike Ralphson (BSD-3-Clause).
 *
 * @module
 */

import { parse as parseYaml } from '@std/yaml'
import {
  isBoolean,
  isJsonArray,
  isJsonObject,
  isRef,
  isString,
  type JsonContainer,
  type JsonObject,
  type JsonValue,
  toJson
} from './json.ts'
import {
  arrayProperties,
  hash,
  httpVerbs,
  parameterTypeProperties,
  resolveInternal,
  sanitise,
  sanitiseAll,
  toCamelCase,
  uniqueOnly,
  VERSION
} from './common.ts'
import { clone, jpescape, recurse } from './reftools.ts'
import { walkSchema } from './walkSchema.ts'
import { statusCodes } from './statusCodes.ts'
import type { ConvertOptions, ConvertResult, External } from './types.ts'

// Re-exported so consumers that only need the converter (e.g. `@skmtc/convert`)
// can import value + types from `@skmtc/swagger2openapi/converter` without
// pulling in the validator's ajv graph via the package root (`mod.ts`).
export type { ConvertOptions, ConvertResult } from './types.ts'
export type { JsonObject, JsonValue } from './json.ts'

/** Target OpenAPI version produced by the converter. */
export const targetVersion = '3.0.0'

/** Error raised when conversion encounters a non-patchable problem. */
export class ConvertError extends Error {
  override name = 'ConvertError'
}

const throwError = (message: string): never => {
  throw new ConvertError(message)
}

const warnProperty = (options: ConvertOptions): string => options.warnProperty ?? 'x-s2o-warning'

const throwOrWarn = (message: string, container: JsonObject, options: ConvertOptions): void => {
  if (options.warnOnly) {
    container[warnProperty(options)] = message
  } else {
    throwError(message)
  }
}

// --- small typed accessors (keep the port free of `any`/`as`) -------------------

const asStr = (value: JsonValue | undefined): string | undefined =>
  isString(value) ? value : undefined

const collectionFormats = ['csv', 'ssv', 'tsv', 'pipes', 'multi'] as const

type CollectionFormat = (typeof collectionFormats)[number]

const asCollectionFormat = (value: JsonValue | undefined): CollectionFormat | undefined =>
  collectionFormats.find(format => format === asStr(value))

const childVal = (value: JsonValue | undefined, key: string): JsonValue | undefined =>
  isJsonObject(value) ? value[key] : undefined

const childObj = (value: JsonValue | undefined, key: string): JsonObject | undefined => {
  const member = childVal(value, key)
  return isJsonObject(member) ? member : undefined
}

const ensureObj = (parent: JsonObject, key: string): JsonObject => {
  const member = parent[key]
  if (isJsonObject(member)) return member
  const created: JsonObject = {}
  parent[key] = created
  return created
}

const ensureArr = (parent: JsonObject, key: string): JsonValue[] => {
  const member = parent[key]
  if (isJsonArray(member)) return member
  const created: JsonValue[] = []
  parent[key] = created
  return created
}

const stringList = (value: JsonValue | undefined): string[] =>
  isJsonArray(value) ? value.filter(isString) : []

// --- schema fix-ups -------------------------------------------------------------

const fixUpSubSchema = (schema: JsonObject, parent: JsonObject, options: ConvertOptions): void => {
  if (isString(schema.discriminator)) {
    schema.discriminator = { propertyName: schema.discriminator }
  }
  if (isJsonArray(schema.items)) {
    if (schema.items.length === 0) schema.items = {}
    else if (schema.items.length === 1) schema.items = schema.items[0]
    else schema.items = { anyOf: schema.items }
  }
  if (isJsonArray(schema.type)) {
    const types = schema.type
    if (types.length === 0) {
      delete schema.type
    } else {
      const oneOf = isJsonArray(schema.oneOf) ? schema.oneOf : (schema.oneOf = [])
      for (const type of types) {
        const newSchema: JsonObject = {}
        if (type === 'null') {
          schema.nullable = true
        } else {
          newSchema.type = type
          for (const prop of arrayProperties) {
            // NOTE: upstream reads `schema.prop` (a literal-key typo that is
            // always undefined); preserved for output parity.
            if (typeof schema.prop !== 'undefined') {
              newSchema[prop] = schema[prop]
              delete schema[prop]
            }
          }
        }
        if (typeof newSchema.type !== 'undefined') oneOf.push(newSchema)
      }
      delete schema.type
      if (oneOf.length === 0) {
        delete schema.oneOf // means was just null => nullable
      } else if (oneOf.length < 2) {
        const first = oneOf[0]
        if (isJsonObject(first)) {
          schema.type = first.type
          if (Object.keys(first).length > 1) {
            throwOrWarn('Lost properties from oneOf', schema, options)
          }
        }
        delete schema.oneOf
      }
    }
    // do not else this
    if (isJsonArray(schema.type) && schema.type.length === 1) {
      schema.type = schema.type[0]
    }
  }
  if (schema.type === 'null') {
    delete schema.type
    schema.nullable = true
  }
  if (schema.type === 'array' && typeof schema.items === 'undefined') {
    schema.items = {}
  }
  if (isBoolean(schema.required)) {
    if (schema.required && isString(schema.name)) {
      const required = isJsonArray(parent.required) ? parent.required : (parent.required = [])
      required.push(schema.name)
    }
    delete schema.required
  }
}

const fixUpSubSchemaExtensions = (schema: JsonObject): void => {
  if (isJsonArray(schema['x-required'])) {
    const required = isJsonArray(schema.required) ? schema.required : []
    schema.required = required.concat(schema['x-required'])
    delete schema['x-required']
  }
  if (typeof schema['x-anyOf'] !== 'undefined') {
    schema.anyOf = schema['x-anyOf']
    delete schema['x-anyOf']
  }
  if (typeof schema['x-oneOf'] !== 'undefined') {
    // NOTE: upstream assigns x-oneOf onto `anyOf`; preserved for parity.
    schema.anyOf = schema['x-oneOf']
    delete schema['x-oneOf']
  }
  if (typeof schema['x-not'] !== 'undefined') {
    // NOTE: upstream assigns x-not onto `anyOf`; preserved for parity.
    schema.anyOf = schema['x-not']
    delete schema['x-not']
  }
  if (isBoolean(schema['x-nullable'])) {
    schema.nullable = schema['x-nullable']
    delete schema['x-nullable']
  }
}

const fixUpSchema = (schema: JsonObject, options: ConvertOptions): void => {
  walkSchema(schema, {}, {}, (sub, parent) => {
    fixUpSubSchemaExtensions(sub)
    fixUpSubSchema(sub, parent, options)
  })
}

// --- reference fix-ups ----------------------------------------------------------

interface ComponentNames {
  schemas: Record<string, string>
}

const makeFixupRefs =
  (componentNames: ComponentNames, options: ConvertOptions) =>
  (container: JsonContainer, key: string): void => {
    if (!isJsonObject(container)) return

    if (isRef(container, key)) {
      const ref = asStr(container[key])
      if (ref !== undefined) {
        let value = ref
        if (value.startsWith('#/definitions/')) {
          const keys = value.replace('#/definitions/', '').split('/')
          const newKey = componentNames.schemas[keys[0]]
          if (!newKey) throwOrWarn('Could not resolve reference ' + value, container, options)
          else keys[0] = newKey
          value = '#/components/schemas/' + keys.join('/')
        }
        if (value.startsWith('#/parameters/')) {
          value = '#/components/parameters/' + sanitise(value.replace('#/parameters/', ''))
        }
        if (value.startsWith('#/responses/')) {
          value = '#/components/responses/' + sanitise(value.replace('#/responses/', ''))
        }
        container[key] = value
      }
    }

    if (key === 'x-ms-odata' && isString(container[key])) {
      const original = container[key]
      const keys = original
        .replace('#/definitions/', '')
        .replace('#/components/schemas/', '')
        .split('/')
      const newKey = componentNames.schemas[keys[0]]
      if (!newKey) throwOrWarn('Could not resolve reference ' + original, container, options)
      else keys[0] = newKey
      container[key] = '#/components/schemas/' + keys.join('/')
    }
  }

// --- security -------------------------------------------------------------------

const processSecurity = (securityObject: JsonValue | undefined): void => {
  if (!isJsonArray(securityObject)) return
  for (const requirement of securityObject) {
    if (!isJsonObject(requirement)) continue
    for (const k of Object.keys(requirement)) {
      const sname = sanitise(k)
      if (k !== sname) {
        requirement[sname] = requirement[k]
        delete requirement[k]
      }
    }
  }
}

const toOAuth2FlowName = (flow: string): string => {
  switch (flow) {
    case 'application':
      return 'clientCredentials'
    case 'accessCode':
      return 'authorizationCode'
    default:
      return flow
  }
}

const processSecurityScheme = (scheme: JsonObject, options: ConvertOptions): void => {
  if (scheme.type === 'basic') {
    scheme.type = 'http'
    scheme.scheme = 'basic'
  }
  if (scheme.type === 'oauth2') {
    const flow: JsonObject = {}
    const flowSource = isString(scheme.flow) ? scheme.flow : ''
    const flowName = toOAuth2FlowName(flowSource)
    if (isString(scheme.authorizationUrl)) {
      flow.authorizationUrl = scheme.authorizationUrl.split('?')[0].trim() || '/'
    }
    if (isString(scheme.tokenUrl)) {
      flow.tokenUrl = scheme.tokenUrl.split('?')[0].trim() || '/'
    }
    flow.scopes = isJsonObject(scheme.scopes) ? scheme.scopes : {}
    const flows: JsonObject = {}
    flows[flowName] = flow
    scheme.flows = flows
    delete scheme.flow
    delete scheme.authorizationUrl
    delete scheme.tokenUrl
    delete scheme.scopes
    if (typeof scheme.name !== 'undefined') {
      if (options.patch) delete scheme.name
      else throwError('(Patchable) oauth2 securitySchemes should not have name property')
    }
  }
}

const keepParameter = (value: JsonValue): boolean =>
  !(isJsonObject(value) && Boolean(value['x-s2o-delete']))

// --- headers --------------------------------------------------------------------

const processHeader = (header: JsonObject, options: ConvertOptions): void => {
  if (typeof header.$ref !== 'undefined') {
    if (isString(header.$ref)) {
      header.$ref = header.$ref.replace('#/responses/', '#/components/responses/')
    }
    return
  }

  if (typeof header.type !== 'undefined' && !isJsonObject(header.schema)) {
    header.schema = {}
  }
  const schema = isJsonObject(header.schema) ? header.schema : undefined
  if (typeof header.type !== 'undefined' && schema) schema.type = header.type

  const items = header.items
  if (isJsonObject(items) && typeof items.collectionFormat !== 'undefined') {
    if (typeof items.type !== 'undefined' && items.type !== 'array') {
      if (items.collectionFormat !== header.collectionFormat) {
        throwOrWarn('Nested collectionFormats are not supported', header, options)
      }
      delete items.collectionFormat
    }
  }

  if (typeof header.collectionFormat !== 'undefined') {
    if (header.type !== 'array') {
      if (options.patch) delete header.collectionFormat
      else throwError('(Patchable) collectionFormat is only applicable to header.type array')
    }
    const format = asCollectionFormat(header.collectionFormat)
    if (format !== undefined) {
      switch (format) {
        case 'csv':
          header.style = 'simple'
          break
        case 'ssv':
          throwOrWarn('collectionFormat:ssv is no longer supported for headers', header, options)
          break
        case 'pipes':
          throwOrWarn('collectionFormat:pipes is no longer supported for headers', header, options)
          break
        case 'multi':
          header.explode = true
          break
        case 'tsv':
          throwOrWarn('collectionFormat:tsv is no longer supported', header, options)
          header['x-collectionFormat'] = 'tsv'
          break
        default:
          format satisfies never
      }
    }
    delete header.collectionFormat
  }

  delete header.type
  if (schema) {
    for (const prop of [...parameterTypeProperties, ...arrayProperties]) {
      if (typeof header[prop] !== 'undefined') {
        schema[prop] = header[prop]
        delete header[prop]
      }
    }
  }
}

// --- parameters -----------------------------------------------------------------

const fixParamRef = (param: JsonObject, options: ConvertOptions): void => {
  const ref = asStr(param.$ref)
  if (ref === undefined) return
  if (ref.indexOf('#/parameters/') >= 0) {
    const parts = ref.split('#/parameters/')
    param.$ref = parts[0] + '#/components/parameters/' + sanitise(parts[1])
  }
  const updated = asStr(param.$ref)
  if (updated !== undefined && updated.indexOf('#/definitions/') >= 0) {
    throwOrWarn('Definition used as parameter', param, options)
  }
}

const collectionFormatToStyle = (param: JsonObject, options: ConvertOptions): void => {
  const value = asCollectionFormat(param.collectionFormat)
  const location = asStr(param.in)
  if (value === undefined) return
  switch (value) {
    case 'csv':
      if (location === 'query' || location === 'cookie') param.style = 'form'
      else if (location === 'path' || location === 'header') param.style = 'simple'
      break
    case 'ssv':
      if (location === 'query') param.style = 'spaceDelimited'
      else {
        throwOrWarn(
          'collectionFormat:ssv is no longer supported except for in:query parameters',
          param,
          options
        )
      }
      break
    case 'pipes':
      if (location === 'query') param.style = 'pipeDelimited'
      else {
        throwOrWarn(
          'collectionFormat:pipes is no longer supported except for in:query parameters',
          param,
          options
        )
      }
      break
    case 'multi':
      param.explode = true
      break
    case 'tsv':
      throwOrWarn('collectionFormat:tsv is no longer supported', param, options)
      param['x-collectionFormat'] = 'tsv'
      break
    default:
      value satisfies never
  }
}

/** Processes a single parameter, returning a requestBody fragment when one is produced. */
const processParameter = (
  paramArg: JsonObject,
  op: JsonObject | null,
  _path: JsonObject | null,
  index: string,
  openapi: JsonObject,
  options: ConvertOptions
): JsonObject => {
  let param = paramArg
  const result: JsonObject = {}
  let singularRequestBody = true

  const opConsumes = op && isJsonArray(op.consumes) ? op.consumes : undefined
  const consumes = (opConsumes ?? (isJsonArray(openapi.consumes) ? openapi.consumes : []))
    .filter(uniqueOnly)
    .filter(isString)

  if (isString(param.$ref)) {
    // if we still have a ref here, it must be an internal one
    fixParamRef(param, options)
    const ref = asStr(param.$ref) ?? ''
    const ptr = ref.replace('#/components/parameters/', '')
    let rbody = false
    const target = childVal(childObj(openapi.components, 'parameters'), ptr)

    if ((!target || (isJsonObject(target) && target['x-s2o-delete'])) && ref.startsWith('#/')) {
      // if it's gone, chances are it's a requestBody component now unless spec was broken
      param['x-s2o-delete'] = true
      rbody = true
    }

    if (rbody) {
      const newParam = resolveInternal(openapi, ref)
      if (!newParam && ref.startsWith('#/')) {
        throwOrWarn('Could not resolve reference ' + ref, param, options)
      } else if (isJsonObject(newParam)) {
        param = newParam // preserve reference
      }
    }
  }

  if (typeof param.name !== 'undefined' || typeof param.in !== 'undefined') {
    // if it's a real parameter OR we've dereferenced it
    if (isBoolean(param['x-deprecated'])) {
      param.deprecated = param['x-deprecated']
      delete param['x-deprecated']
    }
    if (typeof param['x-example'] !== 'undefined') {
      param.example = param['x-example']
      delete param['x-example']
    }

    if (param.in !== 'body' && typeof param.type === 'undefined') {
      if (options.patch) param.type = 'string'
      else throwError('(Patchable) parameter.type is mandatory for non-body parameters')
    }
    const typeRef = childObj(param.type, '$ref')
    if (isJsonObject(param.type) && isString(param.type.$ref)) {
      param.type = resolveValueOrKeep(openapi, param.type.$ref)
    } else if (typeRef) {
      // unreachable in practice; kept for clarity
    }
    if (isJsonObject(param.description) && isString(param.description.$ref)) {
      param.description = resolveValueOrKeep(openapi, param.description.$ref)
    }

    const oldCollectionFormat = asStr(param.collectionFormat)
    if (typeof param.collectionFormat !== 'undefined') {
      if (param.type !== 'array') {
        if (options.patch) delete param.collectionFormat
        else throwError('(Patchable) collectionFormat is only applicable to param.type array')
      }
      collectionFormatToStyle(param, options)
      delete param.collectionFormat
    }

    if (
      typeof param.type !== 'undefined' &&
      param.type !== 'object' &&
      param.type !== 'body' &&
      param.in !== 'formData'
    ) {
      if (typeof param.items !== 'undefined' && typeof param.schema !== 'undefined') {
        throwOrWarn('parameter has array,items and schema', param, options)
      } else {
        const schema = isJsonObject(param.schema) ? param.schema : (param.schema = {})
        schema.type = param.type
        if (typeof param.items !== 'undefined') {
          schema.items = param.items
          delete param.items
          recurse(schema.items, null, (container, key) => {
            if (!isJsonObject(container)) return
            if (key === 'collectionFormat' && isString(container[key])) {
              if (oldCollectionFormat && container[key] !== oldCollectionFormat) {
                throwOrWarn('Nested collectionFormats are not supported', param, options)
              }
              delete container[key] // not lossless
            }
          })
        }
        for (const prop of parameterTypeProperties) {
          if (typeof param[prop] !== 'undefined') schema[prop] = param[prop]
          delete param[prop]
        }
      }
    }

    if (isJsonObject(param.schema)) {
      fixUpSchema(param.schema, options)
    }

    if (param['x-ms-skip-url-encoding']) {
      if (param.in === 'query') {
        param.allowReserved = true
        delete param['x-ms-skip-url-encoding']
      }
    }
  }

  if (param.in === 'formData') {
    // convert to requestBody component
    singularRequestBody = false
    const content = ensureObj(result, 'content')
    const contentType = consumes.includes('multipart/form-data')
      ? 'multipart/form-data'
      : 'application/x-www-form-urlencoded'

    const media = ensureObj(content, contentType)
    if (isJsonObject(param.schema)) {
      media.schema = param.schema
      if (isString(param.schema.$ref)) {
        result['x-s2o-name'] = param.schema.$ref.replace('#/components/schemas/', '')
      }
    } else {
      const schema = ensureObj(media, 'schema')
      schema.type = 'object'
      const properties = ensureObj(schema, 'properties')
      const name = isString(param.name) ? param.name : ''
      const target = ensureObj(properties, name)
      if (typeof param.description !== 'undefined') target.description = param.description
      if (typeof param.example !== 'undefined') target.example = param.example
      if (typeof param.type !== 'undefined') target.type = param.type
      for (const prop of parameterTypeProperties) {
        if (typeof param[prop] !== 'undefined') target[prop] = param[prop]
      }
      if (param.required === true) {
        ensureArr(schema, 'required').push(name)
      }
      if (typeof param.default !== 'undefined') target.default = param.default
      if (typeof target.properties !== 'undefined') target.properties = param.properties
      if (typeof param.allOf !== 'undefined') target.allOf = param.allOf
      if (param.type === 'array' && typeof param.items !== 'undefined') {
        target.items = param.items
      }
      if (param.type === 'file') {
        target.type = 'string'
        target.format = 'binary'
      }
    }
  } else if (param.type === 'file') {
    // convert to requestBody
    if (typeof param.required !== 'undefined') result.required = param.required
    const content = ensureObj(result, 'content')
    const media = ensureObj(content, 'application/octet-stream')
    media.schema = { type: 'string', format: 'binary' }
  }

  if (param.in === 'body') {
    const content = ensureObj(result, 'content')
    if (typeof param.name !== 'undefined') {
      const opId = op && isString(op.operationId) ? sanitiseAll(op.operationId) : ''
      result['x-s2o-name'] = opId + toCamelCase('_' + String(param.name))
    }
    if (typeof param.description !== 'undefined') result.description = param.description
    if (typeof param.required !== 'undefined') result.required = param.required

    const schemaRef = asStr(childVal(param.schema, '$ref'))
    const itemsRef = asStr(childVal(childObj(param.schema, 'items'), '$ref'))
    if (schemaRef !== undefined) {
      result['x-s2o-name'] = schemaRef.replace('#/components/schemas/', '')
    } else if (childVal(param.schema, 'type') === 'array' && itemsRef !== undefined) {
      result['x-s2o-name'] = itemsRef.replace('#/components/schemas/', '') + 'Array'
    }

    const bodyConsumes = consumes.length ? consumes : ['application/json']
    for (const mimetype of bodyConsumes) {
      const media = ensureObj(content, mimetype)
      const cloned = isJsonObject(param.schema) ? clone(param.schema) : {}
      media.schema = cloned
      if (isJsonObject(cloned)) fixUpSchema(cloned, options)
    }
  }

  if (Object.keys(result).length > 0) {
    param['x-s2o-delete'] = true
    // work out where to attach the requestBody
    if (op) {
      if (isJsonObject(op.requestBody) && singularRequestBody) {
        op.requestBody['x-s2o-overloaded'] = true
        const opId = isString(op.operationId) ? op.operationId : index
        throwOrWarn('Operation ' + opId + ' has multiple requestBodies', op, options)
      } else {
        const requestBody = isJsonObject(op.requestBody) ? op.requestBody : {}
        op.requestBody = requestBody
        const existingForm = childObj(childObj(requestBody, 'content'), 'multipart/form-data')
        const existingUrlEncoded = childObj(
          childObj(requestBody, 'content'),
          'application/x-www-form-urlencoded'
        )
        const resultForm = childObj(childObj(result, 'content'), 'multipart/form-data')
        const resultUrlEncoded = childObj(
          childObj(result, 'content'),
          'application/x-www-form-urlencoded'
        )
        if (existingForm && resultForm) {
          mergeFormSchema(existingForm, resultForm)
        } else if (existingUrlEncoded && resultUrlEncoded) {
          mergeFormSchema(existingUrlEncoded, resultUrlEncoded)
        } else {
          Object.assign(requestBody, result)
          if (typeof requestBody['x-s2o-name'] === 'undefined') {
            const schemaRef = asStr(childVal(requestBody.schema, '$ref'))
            if (schemaRef !== undefined) {
              requestBody['x-s2o-name'] = schemaRef
                .replace('#/components/schemas/', '')
                .split('/')
                .join('')
            } else if (isString(op.operationId)) {
              requestBody['x-s2o-name'] = sanitiseAll(op.operationId)
            }
          }
        }
      }
    }
  }

  // tidy up
  delete param.type
  for (const prop of parameterTypeProperties) {
    delete param[prop]
  }

  if (param.in === 'path' && param.required !== true) {
    if (options.patch) param.required = true
    else throwError('(Patchable) path parameters must be required:true')
  }

  return result
}

const mergeFormSchema = (existing: JsonObject, incoming: JsonObject): void => {
  const existingSchema = ensureObj(existing, 'schema')
  const incomingSchema = ensureObj(incoming, 'schema')
  const existingProps = ensureObj(existingSchema, 'properties')
  const incomingProps = isJsonObject(incomingSchema.properties) ? incomingSchema.properties : {}
  existingSchema.properties = Object.assign(existingProps, incomingProps)
  const required = [...stringList(existingSchema.required), ...stringList(incomingSchema.required)]
  existingSchema.required = required
  if (required.length === 0) delete existingSchema.required
}

const resolveValueOrKeep = (root: JsonValue, pointer: string): JsonValue => {
  const resolved = resolveInternal(root, pointer)
  return resolved === false || typeof resolved === 'undefined' ? pointer : resolved
}

// --- responses ------------------------------------------------------------------

const processResponse = (
  response: JsonObject,
  name: string,
  op: JsonObject | null,
  openapi: JsonObject,
  options: ConvertOptions
): void => {
  if (isString(response.$ref)) {
    if (response.$ref.indexOf('#/definitions/') >= 0) {
      throwOrWarn('definition used as response: ' + response.$ref, response, options)
    } else if (response.$ref.startsWith('#/responses/')) {
      response.$ref =
        '#/components/responses/' + sanitise(response.$ref.replace('#/responses/', ''))
    }
    return
  }

  if (
    typeof response.description === 'undefined' ||
    response.description === null ||
    (response.description === '' && options.patch)
  ) {
    if (options.patch) {
      const sc = statusCodes.find(entry => entry.code === name)
      response.description = sc ? sc.phrase : ''
    } else {
      throwError('(Patchable) response.description is mandatory')
    }
  }

  if (isJsonObject(response.schema)) {
    fixUpSchema(response.schema, options)

    if (isString(response.schema.$ref) && response.schema.$ref.startsWith('#/responses/')) {
      response.schema.$ref =
        '#/components/responses/' + sanitise(response.schema.$ref.replace('#/responses/', ''))
    }

    const opProduces = op && isJsonArray(op.produces) ? op.produces : undefined
    const produces = (opProduces ?? (isJsonArray(openapi.produces) ? openapi.produces : []))
      .filter(uniqueOnly)
      .filter(isString)
    const mimes = produces.length ? produces : ['*/*']

    const content = ensureObj(response, 'content')
    const examples = isJsonObject(response.examples) ? response.examples : undefined
    for (const mimetype of mimes) {
      const media = ensureObj(content, mimetype)
      const cloned = clone(response.schema)
      media.schema = cloned
      if (examples && typeof examples[mimetype] !== 'undefined') {
        const exampleContainer = ensureObj(media, 'examples')
        exampleContainer.response = { value: examples[mimetype] }
        delete examples[mimetype]
      }
      if (isJsonObject(cloned) && cloned.type === 'file') {
        media.schema = { type: 'string', format: 'binary' }
      }
    }
    delete response.schema
  }

  // examples for content-types not listed in produces
  if (isJsonObject(response.examples)) {
    for (const mimetype of Object.keys(response.examples)) {
      const content = ensureObj(response, 'content')
      const media = ensureObj(content, mimetype)
      const exampleContainer = ensureObj(media, 'examples')
      exampleContainer.response = { value: response.examples[mimetype] }
    }
  }
  delete response.examples

  if (isJsonObject(response.headers)) {
    for (const h of Object.keys(response.headers)) {
      if (h.toLowerCase() === 'status code') {
        if (options.patch) delete response.headers[h]
        else throwError('(Patchable) "Status Code" is not a valid header')
      } else {
        const headerValue = response.headers[h]
        if (isJsonObject(headerValue)) processHeader(headerValue, options)
      }
    }
  }
}

// --- paths ----------------------------------------------------------------------

interface RequestBodyEntry {
  name: string
  body: JsonValue
  refs: string[]
}

const replaceProtocol = (urlString: string, scheme: string): string =>
  /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlString)
    ? urlString.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, scheme + '://')
    : scheme + '://' + urlString

const processPaths = (
  container: JsonObject,
  containerName: string,
  options: ConvertOptions,
  requestBodyCache: Record<number, RequestBodyEntry>,
  openapi: JsonObject
): void => {
  for (const p of Object.keys(container)) {
    const path = container[p]
    if (!isJsonObject(path)) continue
    // path.$ref is external only
    if (isJsonObject(path['x-trace'])) {
      path.trace = path['x-trace']
      delete path['x-trace']
    }
    if (isString(path['x-summary'])) {
      path.summary = path['x-summary']
      delete path['x-summary']
    }
    if (isString(path['x-description'])) {
      path.description = path['x-description']
      delete path['x-description']
    }
    if (isJsonArray(path['x-servers'])) {
      path.servers = path['x-servers']
      delete path['x-servers']
    }

    for (const method of Object.keys(path)) {
      if (!(httpVerbs.includes(method) || method === 'x-amazon-apigateway-any-method')) continue
      const op = path[method]
      if (!isJsonObject(op)) continue

      if (isJsonArray(op.parameters)) {
        if (isJsonArray(path.parameters)) {
          for (let param of path.parameters) {
            if (!isJsonObject(param)) continue
            if (isString(param.$ref)) {
              fixParamRef(param, options)
              const resolved = resolveInternal(openapi, asStr(param.$ref) ?? '')
              if (isJsonObject(resolved)) param = resolved
            }
            const opParams = op.parameters
            const matched = opParams.find(
              candidate =>
                isJsonObject(candidate) &&
                candidate.name === param.name &&
                candidate.in === param.in
            )
            // NOTE: upstream operator precedence preserved: (!matched && formData) || body || file
            if (
              (!matched && param.in === 'formData') ||
              param.in === 'body' ||
              param.type === 'file'
            ) {
              processParameter(param, op, path, p, openapi, options)
            }
          }
        }
        for (const param of op.parameters) {
          if (isJsonObject(param)) {
            processParameter(param, op, path, method + ':' + p, openapi, options)
          }
        }
        if (!options.debug) {
          op.parameters = op.parameters.filter(keepParameter)
        }
      }

      if (typeof op.security !== 'undefined') processSecurity(op.security)

      // responses
      if (typeof op.responses === 'undefined') {
        op.responses = { default: { description: 'Default response' } }
      }
      const responses = op.responses
      if (isJsonObject(responses)) {
        for (const r of Object.keys(responses)) {
          const response = responses[r]
          if (isJsonObject(response)) processResponse(response, r, op, openapi, options)
        }
      }

      if (isJsonArray(op['x-servers'])) {
        op.servers = op['x-servers']
        delete op['x-servers']
      } else if (isJsonArray(op.schemes) && op.schemes.length) {
        for (const scheme of op.schemes) {
          const openapiSchemes = openapi.schemes
          if (!isJsonArray(openapiSchemes) || openapiSchemes.indexOf(scheme) < 0) {
            const servers = ensureArr(op, 'servers')
            if (isJsonArray(openapi.servers) && isString(scheme)) {
              for (const server of openapi.servers) {
                if (!isJsonObject(server)) continue
                const newServer = clone(server)
                if (isJsonObject(newServer) && isString(newServer.url)) {
                  newServer.url = replaceProtocol(newServer.url, scheme)
                }
                servers.push(newServer)
              }
            }
          }
        }
      }

      if (options.debug) {
        op['x-s2o-consumes'] = op.consumes ?? []
        op['x-s2o-produces'] = op.produces ?? []
      }
      delete op.consumes
      delete op.produces
      delete op.schemes

      processXmsExamples(op, path, openapi, options)

      if (isJsonArray(op.parameters) && op.parameters.length === 0) delete op.parameters

      if (isJsonObject(op.requestBody)) {
        const effectiveOperationId = isString(op.operationId)
          ? sanitiseAll(op.operationId)
          : sanitiseAll(toCamelCase(method + p))
        const rbName = sanitise(asStr(op.requestBody['x-s2o-name']) ?? effectiveOperationId ?? '')
        delete op.requestBody['x-s2o-name']
        const rbStr = JSON.stringify(op.requestBody)
        const rbHash = hash(rbStr)
        const entry =
          requestBodyCache[rbHash] ??
          (requestBodyCache[rbHash] = { name: rbName, body: op.requestBody, refs: [] })
        const ptr =
          '#/' +
          containerName +
          '/' +
          encodeURIComponent(jpescape(p)) +
          '/' +
          method +
          '/requestBody'
        entry.refs.push(ptr)
      }
    }

    if (isJsonArray(path.parameters)) {
      for (const param of path.parameters) {
        if (isJsonObject(param)) processParameter(param, null, path, p, openapi, options)
      }
      if (!options.debug) {
        path.parameters = path.parameters.filter(keepParameter)
      }
    }
  }
}

const processXmsExamples = (
  op: JsonObject,
  path: JsonObject,
  openapi: JsonObject,
  _options: ConvertOptions
): void => {
  const examples = op['x-ms-examples']
  if (!isJsonObject(examples)) return
  for (const e of Object.keys(examples)) {
    const example = examples[e]
    if (!isJsonObject(example)) continue
    const se = sanitiseAll(e)
    if (isJsonObject(example.parameters)) {
      for (const pName of Object.keys(example.parameters)) {
        const value = example.parameters[pName]
        const opParams = isJsonArray(op.parameters) ? op.parameters : []
        const pathParams = isJsonArray(path.parameters) ? path.parameters : []
        for (let param of [...opParams, ...pathParams]) {
          if (!isJsonObject(param)) continue
          if (isString(param.$ref)) {
            const resolved = resolveInternal(openapi, param.$ref)
            if (isJsonObject(resolved)) param = resolved
          }
          if (param.name === pName && typeof param.example === 'undefined') {
            const examplesMap = ensureObj(param, 'examples')
            examplesMap[e] = { value }
          }
        }
      }
    }
    if (isJsonObject(example.responses)) {
      for (const r of Object.keys(example.responses)) {
        const exResponse = example.responses[r]
        if (!isJsonObject(exResponse)) continue
        if (isJsonObject(exResponse.headers)) {
          for (const h of Object.keys(exResponse.headers)) {
            const value = exResponse.headers[h]
            const opResponses = childObj(op.responses, r)
            const responseHeaders = childObj(opResponses, 'headers')
            if (responseHeaders && isJsonObject(responseHeaders[h])) {
              const header = responseHeaders[h]
              if (isJsonObject(header)) header.example = value
            }
          }
        }
        if (typeof exResponse.body !== 'undefined') {
          const componentsExamples = ensureObj(ensureObj(openapi, 'components'), 'examples')
          componentsExamples[se] = { value: clone(exResponse.body) }
          const opResponse = childObj(op.responses, r)
          const responseContent = childObj(opResponse, 'content')
          if (responseContent) {
            for (const ct of Object.keys(responseContent)) {
              const contentType = responseContent[ct]
              if (isJsonObject(contentType)) {
                const exMap = ensureObj(contentType, 'examples')
                exMap[e] = { $ref: '#/components/examples/' + se }
              }
            }
          }
        }
      }
    }
  }
  delete op['x-ms-examples']
}

// --- main conversion ------------------------------------------------------------

/**
 * Run the Swagger 2.0 → OpenAPI 3.0 body transform over a prepared document.
 *
 * @internal Exported for `./io.ts`; not part of the package's public API.
 */
export const main = (openapi: JsonObject, options: ConvertOptions): JsonObject => {
  const requestBodyCache: Record<number, RequestBodyEntry> = {}
  const componentNames: ComponentNames = { schemas: {} }
  const components = ensureObj(openapi, 'components')

  if (typeof openapi.security !== 'undefined') processSecurity(openapi.security)

  const securitySchemes = childObj(components, 'securitySchemes')
  if (securitySchemes) {
    for (const s of Object.keys(securitySchemes)) {
      const sname = sanitise(s)
      if (s !== sname) {
        if (securitySchemes[sname]) throwError('Duplicate sanitised securityScheme name ' + sname)
        securitySchemes[sname] = securitySchemes[s]
        delete securitySchemes[s]
      }
      const scheme = securitySchemes[sname]
      if (isJsonObject(scheme)) processSecurityScheme(scheme, options)
    }
  }

  const schemas = childObj(components, 'schemas')
  if (schemas) {
    for (const s of Object.keys(schemas)) {
      const sname = sanitiseAll(s)
      let suffix = 0
      if (s !== sname) {
        while (typeof schemas[sname + (suffix || '')] !== 'undefined') {
          suffix = suffix ? suffix + 1 : 2
        }
        schemas[sname + (suffix || '')] = schemas[s]
        delete schemas[s]
      }
      const finalName = sname + (suffix || '')
      componentNames.schemas[s] = finalName
      const finalSchema = schemas[finalName]
      if (isJsonObject(finalSchema)) fixUpSchema(finalSchema, options)
    }
  }

  // fix all $refs to their new locations (and potentially new names)
  recurse(openapi, {}, makeFixupRefs(componentNames, options))

  const parameters = childObj(components, 'parameters')
  if (parameters) {
    for (const p of Object.keys(parameters)) {
      const sname = sanitise(p)
      if (p !== sname) {
        if (parameters[sname]) throwError('Duplicate sanitised parameter name ' + sname)
        parameters[sname] = parameters[p]
        delete parameters[p]
      }
      const param = parameters[sname]
      if (isJsonObject(param)) processParameter(param, null, null, sname, openapi, options)
    }
  }

  const responses = childObj(components, 'responses')
  if (responses) {
    for (const r of Object.keys(responses)) {
      const sname = sanitise(r)
      if (r !== sname) {
        if (responses[sname]) throwError('Duplicate sanitised response name ' + sname)
        responses[sname] = responses[r]
        delete responses[r]
      }
      const response = responses[sname]
      if (isJsonObject(response)) {
        processResponse(response, sname, null, openapi, options)
        if (isJsonObject(response.headers)) {
          for (const h of Object.keys(response.headers)) {
            if (h.toLowerCase() === 'status code') {
              if (options.patch) delete response.headers[h]
              else throwError('(Patchable) "Status Code" is not a valid header')
            } else {
              const headerValue = response.headers[h]
              if (isJsonObject(headerValue)) processHeader(headerValue, options)
            }
          }
        }
      }
    }
  }

  const requestBodies = childObj(components, 'requestBodies')
  if (requestBodies) {
    for (const r of Object.keys(requestBodies)) {
      const rb = requestBodies[r]
      const rbHash = hash(JSON.stringify(rb))
      requestBodyCache[rbHash] = { name: r, body: rb, refs: [] }
    }
  }

  if (isJsonObject(openapi.paths)) {
    processPaths(openapi.paths, 'paths', options, requestBodyCache, openapi)
  }
  if (isJsonObject(openapi['x-ms-paths'])) {
    processPaths(openapi['x-ms-paths'], 'x-ms-paths', options, requestBodyCache, openapi)
  }

  if (!options.debug && parameters) {
    for (const p of Object.keys(parameters)) {
      const param = parameters[p]
      if (isJsonObject(param) && param['x-s2o-delete']) delete parameters[p]
    }
  }

  if (options.debug) {
    openapi['x-s2o-consumes'] = openapi.consumes ?? []
    openapi['x-s2o-produces'] = openapi.produces ?? []
  }
  delete openapi.consumes
  delete openapi.produces
  delete openapi.schemes

  const rbNamesGenerated: string[] = []
  components.requestBodies = {} // for now as we've dereffed them
  const newRequestBodies = ensureObj(components, 'requestBodies')

  let counter = 1
  for (const key of Object.keys(requestBodyCache)) {
    const entry = requestBodyCache[Number(key)]
    if (entry.refs.length > 1) {
      // create a shared requestBody
      let suffix: string | number = ''
      if (!entry.name) {
        entry.name = 'requestBody'
        suffix = counter++
      }
      while (rbNamesGenerated.indexOf(entry.name + suffix) >= 0) {
        suffix = typeof suffix === 'number' ? suffix + 1 : 2
      }
      entry.name = entry.name + suffix
      rbNamesGenerated.push(entry.name)
      newRequestBodies[entry.name] = clone(entry.body)
      for (const ref of entry.refs) {
        resolveInternal(openapi, ref, { $ref: '#/components/requestBodies/' + entry.name })
      }
    }
  }

  pruneEmptyComponents(components, openapi)
  return openapi
}

const pruneEmptyComponents = (components: JsonObject, openapi: JsonObject): void => {
  for (const key of [
    'responses',
    'parameters',
    'examples',
    'requestBodies',
    'securitySchemes',
    'headers',
    'schemas'
  ]) {
    const value = components[key]
    if (isJsonObject(value) && Object.keys(value).length === 0) delete components[key]
  }
  if (isJsonObject(openapi.components) && Object.keys(openapi.components).length === 0) {
    delete openapi.components
  }
}

// --- document preparation -------------------------------------------------------

const extractServerParameters = (server: JsonObject): void => {
  if (!isString(server.url)) return
  server.url = server.url.split('{{').join('{').split('}}').join('}')
  for (const matchResult of server.url.matchAll(/\{(.+?)\}/g)) {
    const variables = ensureObj(server, 'variables')
    variables[matchResult[1]] = { default: 'unknown' }
  }
}

const fixInfo = (openapi: JsonObject, options: ConvertOptions): void => {
  if (!isJsonObject(openapi.info)) {
    if (options.patch) openapi.info = { version: '', title: '' }
    else throwError('(Patchable) info object is mandatory')
  }
  const info = isJsonObject(openapi.info) ? openapi.info : {}
  if (typeof info.title === 'undefined' || info.title === null) {
    if (options.patch) info.title = ''
    else throwError('(Patchable) info.title cannot be null')
  }
  if (typeof info.version === 'undefined' || info.version === null) {
    if (options.patch) info.version = ''
    else throwError('(Patchable) info.version cannot be null')
  }
  if (typeof info.version !== 'string') {
    if (options.patch) info.version = String(info.version)
    else throwError('(Patchable) info.version cannot be null')
  }
  if (typeof info.logo !== 'undefined') {
    if (options.patch) {
      info['x-logo'] = info.logo
      delete info.logo
    } else throwError('(Patchable) info should not have logo property')
  }
  if (typeof info.termsOfService !== 'undefined') {
    if (info.termsOfService === null) {
      if (options.patch) info.termsOfService = ''
      else throwError('(Patchable) info.termsOfService cannot be null')
    }
    if (options.whatwg && isString(info.termsOfService)) {
      try {
        new URL(info.termsOfService)
      } catch {
        if (options.patch) delete info.termsOfService
        else throwError('(Patchable) info.termsOfService must be a URL')
      }
    }
  }
}

const fixPaths = (openapi: JsonObject, options: ConvertOptions): void => {
  if (typeof openapi.paths === 'undefined') {
    if (options.patch) openapi.paths = {}
    else throwError('(Patchable) paths object is mandatory')
  }
}

const recordOrigin = (openapi: JsonObject, swagger: JsonObject, origin: string): void => {
  const origins = ensureArr(openapi, 'x-origin')
  origins.push({
    url: origin,
    format: 'swagger',
    version: isString(swagger.swagger) ? swagger.swagger : '2.0',
    converter: {
      url: 'https://github.com/mermade/swagger2openapi',
      version: VERSION
    }
  })
}

/** Result of {@link prepare}: the cloned/normalised doc and whether it was Swagger 2.0. @internal */
export interface Prepared {
  openapi: JsonObject
  isV2: boolean
}

/**
 * Clone and structurally normalise an input document, detecting Swagger 2.0.
 *
 * @internal Exported for `./io.ts`; not part of the package's public API.
 */
export const prepare = (swagger: JsonObject, options: ConvertOptions): Prepared => {
  if (isString(swagger.openapi) && swagger.openapi.startsWith('3.')) {
    const cloned = clone(swagger)
    const openapi = isJsonObject(cloned) ? cloned : {}
    fixInfo(openapi, options)
    fixPaths(openapi, options)
    return { openapi, isV2: false }
  }

  if (swagger.swagger !== '2.0') {
    const version = isString(swagger.openapi)
      ? swagger.openapi
      : isString(swagger.swagger)
        ? swagger.swagger
        : String(swagger.swagger)
    throwError('Unsupported swagger/OpenAPI version: ' + version)
  }

  const skeleton: JsonObject = { openapi: targetVersion, servers: [] }
  if (options.origin) recordOrigin(skeleton, swagger, options.origin)

  const clonedSwagger = clone(swagger)
  const openapi = Object.assign(skeleton, isJsonObject(clonedSwagger) ? clonedSwagger : {})
  openapi.openapi = targetVersion
  delete openapi.swagger

  const servers = ensureArr(openapi, 'servers')
  if (isString(swagger.host) && isJsonArray(swagger.schemes)) {
    for (const s of swagger.schemes) {
      if (!isString(s)) continue
      const server: JsonObject = {
        url: s + '://' + swagger.host + (isString(swagger.basePath) ? swagger.basePath : '/')
      }
      extractServerParameters(server)
      servers.push(server)
    }
  } else if (isString(swagger.basePath)) {
    const server: JsonObject = { url: swagger.basePath }
    extractServerParameters(server)
    servers.push(server)
  }
  delete openapi.host
  delete openapi.basePath

  if (isJsonArray(openapi['x-servers'])) {
    openapi.servers = openapi['x-servers']
    delete openapi['x-servers']
  }

  if (isJsonObject(swagger['x-ms-parameterized-host'])) {
    const xMsPHost = swagger['x-ms-parameterized-host']
    const server: JsonObject = {
      url: isString(xMsPHost.hostTemplate) ? xMsPHost.hostTemplate : '',
      variables: {}
    }
    const variables = ensureObj(server, 'variables')
    if (isJsonObject(xMsPHost.parameters)) {
      for (const msp of Object.keys(xMsPHost.parameters)) {
        let param = xMsPHost.parameters[msp]
        if (isJsonObject(param) && isString(param.$ref)) {
          const resolved = resolveInternal(openapi, param.$ref)
          if (isJsonObject(resolved)) param = resolved
        }
        if (!isJsonObject(param)) continue
        if (!msp.startsWith('x-')) {
          delete param.required
          delete param.type
          delete param.in
          if (typeof param.default === 'undefined') {
            param.default = isJsonArray(param.enum) && param.enum.length ? param.enum[0] : ''
          }
          if (isString(param.name)) variables[param.name] = param
          delete param.name
        }
      }
    }
    servers.push(server)
    delete openapi['x-ms-parameterized-host']
  }

  fixInfo(openapi, options)
  fixPaths(openapi, options)

  const components = ensureObj(openapi, 'components')
  if (typeof openapi['x-callbacks'] !== 'undefined') {
    components.callbacks = openapi['x-callbacks']
    delete openapi['x-callbacks']
  }
  components.examples = {}
  components.headers = {}
  if (typeof openapi['x-links'] !== 'undefined') {
    components.links = openapi['x-links']
    delete openapi['x-links']
  }
  components.parameters = isJsonObject(openapi.parameters) ? openapi.parameters : {}
  components.responses = isJsonObject(openapi.responses) ? openapi.responses : {}
  components.requestBodies = {}
  components.securitySchemes = isJsonObject(openapi.securityDefinitions)
    ? openapi.securityDefinitions
    : {}
  components.schemas = isJsonObject(openapi.definitions) ? openapi.definitions : {}
  delete openapi.definitions
  delete openapi.responses
  delete openapi.parameters
  delete openapi.securityDefinitions

  return { openapi, isV2: true }
}

// --- public API -----------------------------------------------------------------

/**
 * Assemble a {@link ConvertResult}.
 *
 * @internal Exported for `./io.ts`; not part of the package's public API.
 */
export const toResult = (
  openapi: JsonObject,
  externals: External[],
  sourceYaml: boolean
): ConvertResult => ({
  openapi,
  externals,
  sourceYaml
})

/**
 * Converts a Swagger 2.0 (or pass-through OpenAPI 3.x) document object to
 * OpenAPI 3.0. Synchronous: throws if `options.resolve` is set — use
 * `convertObjResolve` (from `@skmtc/swagger2openapi`) for external reference
 * resolution.
 */
export const convertObj = (swagger: JsonValue, options: ConvertOptions = {}): ConvertResult => {
  if (!isJsonObject(swagger)) throw new ConvertError('Document must be an object')
  if (options.resolve) {
    throwError('convertObj is synchronous; use convertObjResolve when options.resolve is set')
  }
  const { openapi, isV2 } = prepare(swagger, options)
  if (isV2) main(openapi, options)
  return toResult(openapi, [], false)
}

/** Parsed JSON/YAML input plus whether the source was YAML. @internal */
export interface ParsedInput {
  value: JsonValue
  yaml: boolean
}

/**
 * Parse a JSON-or-YAML string into a {@link JsonValue}.
 *
 * @internal Exported for `./io.ts`; not part of the package's public API.
 */
export const parseInput = (str: string): ParsedInput | undefined => {
  try {
    return { value: toJson(JSON.parse(str)), yaml: false }
  } catch {
    // fall through to YAML
  }
  try {
    return { value: toJson(parseYaml(str)), yaml: true }
  } catch {
    return undefined
  }
}

/** Parses a JSON/YAML string and converts it. Synchronous (no external resolution). */
export const convertStr = (str: string, options: ConvertOptions = {}): ConvertResult => {
  const parsed = parseInput(str)
  if (!parsed) throw new ConvertError('Could not parse the input as JSON or YAML')
  const result = convertObj(parsed.value, options)
  return toResult(result.openapi, result.externals, parsed.yaml)
}
