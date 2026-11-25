/**
 * What the OpenAPI rules say of a schema, from a validator: a schema of any
 * version as JSON Schema 2020-12, and the values that Ajv accepts for it.
 */

import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { isRecord } from './api-surface.ts'

export type Version = '3.0.3' | '3.1.0' | '3.2.0'

export const VERSIONS: Version[] = ['3.0.3', '3.1.0', '3.2.0']

/** A schema as 2020-12, with what the version says is wrong in it. */
export type Translation = {
  schema: unknown
  /** What is not valid in the version. The rules then give no answer. */
  invalid: string[]
  /** What the version does not have or does not read, so it is left out. */
  ignored: string[]
}

/** The values accepted, in the order they were given. */
export type Answer = { type: 'values'; accepted: boolean[] } | { type: 'invalid'; reasons: string[] }

const SCHEMA_MAPS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']
const SCHEMA_LISTS = ['allOf', 'anyOf', 'oneOf', 'prefixItems']
const SCHEMAS = [
  'items',
  'additionalProperties',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties'
]

/** `schema` with each schema directly inside it replaced. A keyword's data (`default`, `enum`) is not a schema. */
export const mapSchemas = (
  schema: Record<string, unknown>,
  visit: (inner: unknown) => unknown
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(schema).map(([key, value]) => {
      if (SCHEMA_MAPS.includes(key) && isRecord(value)) {
        return [key, Object.fromEntries(Object.entries(value).map(([name, inner]) => [name, visit(inner)]))]
      }

      if (SCHEMA_LISTS.includes(key) && Array.isArray(value)) {
        return [key, value.map(visit)]
      }

      return [key, SCHEMAS.includes(key) && isRecord(value) ? visit(value) : value]
    })
  )

/** The keywords of the 3.0.3 Schema Object. */
const KEYWORDS_30 = [
  'title', 'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum', 'maxLength', 'minLength',
  'pattern', 'maxItems', 'minItems', 'uniqueItems', 'maxProperties', 'minProperties', 'required', 'enum', 'type',
  'allOf', 'oneOf', 'anyOf', 'not', 'items', 'properties', 'additionalProperties', 'description', 'format', 'default',
  'nullable', 'discriminator', 'readOnly', 'writeOnly', 'xml', 'externalDocs', 'example', 'deprecated'
]

const TYPES_30 = ['array', 'boolean', 'integer', 'number', 'object', 'string']

/** `#/components/schemas/Pet` as `#/$defs/Pet`. */
const toDefsRef = ($ref: string): string => $ref.replace('#/components/schemas/', '#/$defs/')

/** A bound of 3.0 as 2020-12 writes it: `exclusiveMinimum: true` takes its number from `minimum`. */
const toBound = (
  schema: Record<string, unknown>,
  bound: 'minimum' | 'maximum',
  exclusive: 'exclusiveMinimum' | 'exclusiveMaximum'
): Record<string, unknown> => {
  const value = schema[bound]

  if (value === undefined) {
    return {}
  }

  return { [schema[exclusive] === true ? exclusive : bound]: value }
}

/**
 * A 3.0 schema as 2020-12, by the 3.0.3 text:
 * - "This object cannot be extended with additional properties and any
 *   properties added SHALL be ignored" (Reference Object).
 * - "A `true` value adds `"null"` to the allowed type specified by the `type`
 *   keyword, only if `type` is explicitly defined within the same Schema
 *   Object" (`nullable`). An `enum` is not changed by it.
 * - `type` is one string, and `null` is none of them.
 * - `exclusiveMinimum` and `exclusiveMaximum` are booleans.
 */
export const translate30 = (schema: unknown): Translation => {
  if (typeof schema === 'boolean' || !isRecord(schema)) {
    return { schema, invalid: [], ignored: [] }
  }

  if (typeof schema.$ref === 'string') {
    const ignored = Object.keys(schema).filter(key => key !== '$ref')

    return { schema: { $ref: toDefsRef(schema.$ref) }, invalid: [], ignored }
  }

  const { type, nullable, minimum: _minimum, maximum: _maximum, exclusiveMinimum, exclusiveMaximum, ...rest } = schema
  const inner: Translation[] = []
  const known = Object.fromEntries(Object.entries(rest).filter(([key]) => KEYWORDS_30.includes(key)))

  const translated = mapSchemas(known, value => {
    const translation = translate30(value)
    inner.push(translation)

    return translation.schema
  })

  const invalid = [
    ...(type === undefined || (typeof type === 'string' && TYPES_30.includes(type))
      ? []
      : [`type: ${JSON.stringify(type)}`]),
    ...(schema.required === undefined || Array.isArray(schema.required) ? [] : ['required is not a list']),
    ...(exclusiveMinimum === undefined || typeof exclusiveMinimum === 'boolean'
      ? []
      : ['exclusiveMinimum is not a boolean']),
    ...(exclusiveMaximum === undefined || typeof exclusiveMaximum === 'boolean'
      ? []
      : ['exclusiveMaximum is not a boolean'])
  ]

  return {
    schema: {
      ...translated,
      ...(type === undefined ? {} : { type: nullable === true ? [type, 'null'] : type }),
      ...toBound(schema, 'minimum', 'exclusiveMinimum'),
      ...toBound(schema, 'maximum', 'exclusiveMaximum')
    },
    invalid: [...invalid, ...inner.flatMap(translation => translation.invalid)],
    ignored: [
      ...Object.keys(rest).filter(key => !KEYWORDS_30.includes(key) && !key.startsWith('x-')),
      ...inner.flatMap(translation => translation.ignored)
    ]
  }
}

/**
 * A 3.1 or 3.2 schema: 2020-12 already. `nullable` is taken out because it is
 * not a keyword there, and Ajv reads it as one.
 */
export const translate31 = (schema: unknown): Translation => {
  if (typeof schema === 'boolean' || !isRecord(schema)) {
    return { schema, invalid: [], ignored: [] }
  }

  const { nullable, $ref, ...rest } = schema
  const inner: Translation[] = []

  const translated = mapSchemas(rest, value => {
    const translation = translate31(value)
    inner.push(translation)

    return translation.schema
  })

  return {
    schema: { ...(typeof $ref === 'string' ? { $ref: toDefsRef($ref) } : {}), ...translated },
    invalid: inner.flatMap(translation => translation.invalid),
    ignored: [...(nullable === undefined ? [] : ['nullable']), ...inner.flatMap(translation => translation.ignored)]
  }
}

export const translate = (version: Version, schema: unknown): Translation =>
  version === '3.0.3' ? translate30(schema) : translate31(schema)

const toAjv = () => new Ajv2020({ strict: false, validateFormats: false, logger: false })

type ValidateArgs = {
  /** The name in `schemas` of the schema to ask about. */
  name: string
  /** 2020-12 schemas, which refer to each other as `#/$defs/<name>`. */
  schemas: Record<string, unknown>
  values: unknown[]
}

/** Which of the values a 2020-12 schema accepts, from Ajv. */
export const validate = ({ name, schemas, values }: ValidateArgs): Answer => {
  const ajv = toAjv()
  const root = { $ref: `#/$defs/${name}`, $defs: schemas }

  if (!ajv.validateSchema(root)) {
    return { type: 'invalid', reasons: [ajv.errorsText()] }
  }

  const check = ajv.compile(root)

  return { type: 'values', accepted: values.map(value => check(value) === true) }
}

/** Which of the values the raw schema `name` of a document accepts, by the rules of the version. */
export const toRulesAnswer = ({ version, name, schemas, values }: ValidateArgs & { version: Version }): Answer => {
  const translations = Object.entries(schemas).map(([key, schema]) => ({ key, ...translate(version, schema) }))
  const invalid = translations.flatMap(translation => translation.invalid)

  return invalid.length > 0
    ? { type: 'invalid', reasons: invalid }
    : validate({
        name,
        schemas: Object.fromEntries(translations.map(({ key, schema }) => [key, schema])),
        values
      })
}
