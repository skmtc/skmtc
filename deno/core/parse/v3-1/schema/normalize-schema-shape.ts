import type { OpenAPIV3 } from 'openapi-types'
import {
  toMaximum,
  toMinimum,
  toTighterMaximum,
  toTighterMinimum,
  writeBounds
} from '@/parse/v3-1/_merge-all-of/merge-bounds.ts'

/**
 * OpenAPI 3.1 lets a schema's `type` be an ARRAY (e.g. `['string', 'null']`),
 * which the shared IR — modelling a single `type` plus a `nullable` flag —
 * does not. Normalize the array form into shapes the rest of the dispatcher
 * already understands:
 *
 *   - `['T', 'null']`   (one non-null type)  → `{ type: 'T', nullable: true }`.
 *     An array type without `items` keeps `items` absent (unknown items).
 *   - `['T1', 'T2', …]` (several non-null)   → a `oneOf` of the bare types,
 *     i.e. the 3.1 multi-type union. 3.0 cannot express this — it is the
 *     CASE-2 gap where the v3-0 parser degrades to OasUnknown.
 *   - `['null']`        (only null)          → left unchanged → OasUnknown,
 *     since there is no first-class OasNull IR node yet (a documented gap).
 *     Inside a merge, {@link normalizeMergeMember} handles it.
 *
 * The hoisted `nullable` flag is the IR's representation of nullability; the
 * leaf parsers read it via `parseNullable`. A non-array `type` passes through.
 */
const normalizeTypeArray = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  const rawType: unknown = schema.type

  if (!Array.isArray(rawType)) {
    return schema
  }

  const members = rawType.filter(member => member !== 'null')
  const nullable = rawType.length !== members.length || schema.nullable

  // Only `null` (`type: ['null']`): no OasNull node yet — fall through.
  if (members.length === 0) {
    return schema
  }

  // Several non-null types: a 3.1 multi-type union. Model it as a `oneOf`
  // of the bare types and let the oneOf branch build the OasUnion.
  if (members.length > 1) {
    const { type: _type, ...rest } = schema
    return { ...rest, nullable, oneOf: members.map(member => ({ type: member })) }
  }

  // Exactly one non-null type: dispatch as that type, carrying nullability.
  switch (members[0]) {
    case 'object':
    case 'integer':
    case 'number':
    case 'boolean':
    case 'string':
    case 'array':
      return { ...schema, type: members[0], nullable }
    default:
      return schema
  }
}

/**
 * OpenAPI 3.1 `const: X` is the single-value form of `enum` (3.0 expresses a
 * literal as a one-element `enum`). Rewrite it so the existing enum-aware leaf
 * parsers handle it; matches down-convert's `convertConstToEnum`, so a 3.0
 * `enum:[X]` and a 3.1 `const:X` land on the same IR.
 */
const normalizeConst = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  if (!('const' in schema)) {
    return schema
  }

  // `const` is a 3.1 keyword the 3.0-typed SchemaObject does not model; read
  // it via an annotated destructure rather than a cast.
  const { const: constValue, ...rest }: OpenAPIV3.SchemaObject & { const?: unknown } = schema

  return { ...rest, enum: [constValue] }
}

/**
 * OpenAPI 3.1 schemas carry `examples` (an array, JSON Schema 2020-12); 3.0
 * and the IR use a single `example`. Adopt the first array element as the IR
 * `example` when no singular `example` is set, and drop the array. Matches
 * down-convert's `convertJsonSchemaExamples`.
 */
const normalizeExamples = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  if ('example' in schema || !('examples' in schema)) {
    return schema
  }

  // `examples` is a 3.1 keyword the 3.0-typed SchemaObject does not model.
  const { examples, ...rest }: OpenAPIV3.SchemaObject & { examples?: unknown } = schema

  if (!Array.isArray(examples) || examples.length === 0) {
    return rest
  }

  return { ...rest, example: examples[0] }
}

/**
 * OpenAPI 3.1 expresses exclusive bounds as NUMBERS (`exclusiveMinimum: 5`
 * means "> 5"); the shared IR (and 3.0) model them as a boolean flag paired
 * with `minimum`/`maximum`. Convert the numeric form so the number/integer
 * leaves validate. Matches down-convert's `convertExclusiveMinMax`, so a 3.0
 * `{minimum:5, exclusiveMinimum:true}` and a 3.1 `{exclusiveMinimum:5}` land
 * on the same IR.
 */
const normalizeExclusiveBounds = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  // `exclusiveMinimum`/`exclusiveMaximum` are 3.0-typed boolean here; in 3.1
  // they arrive as numbers, so read them loosely.
  const exclusiveMinimum: unknown = schema.exclusiveMinimum
  const exclusiveMaximum: unknown = schema.exclusiveMaximum

  if (typeof exclusiveMinimum !== 'number' && typeof exclusiveMaximum !== 'number') {
    return schema
  }

  // A schema may carry both `minimum` and a numeric `exclusiveMinimum`:
  // keep the tighter of the two (the same for maximum).
  const minimum =
    typeof exclusiveMinimum === 'number'
      ? toTighterMinimum(toMinimum(schema), { value: exclusiveMinimum, exclusive: true })
      : undefined

  const maximum =
    typeof exclusiveMaximum === 'number'
      ? toTighterMaximum(toMaximum(schema), { value: exclusiveMaximum, exclusive: true })
      : undefined

  const next: OpenAPIV3.SchemaObject = { ...schema }

  writeBounds(next, minimum, maximum)

  return next
}

/**
 * OpenAPI 3.1 / JSON Schema 2020-12 expresses a binary string payload with
 * `contentMediaType: 'application/octet-stream'` and base64 with
 * `contentEncoding: 'base64'`; the shared IR (and 3.0) carry these as a string
 * `format` (`binary` / `byte`, both in the format allow-list). Map them so the
 * format reaches the IR. Mirrors down-convert's
 * `convertJsonSchemaContentMediaType` / `convertJsonSchemaContentEncoding`:
 * string schemas only, and a pre-existing (conflicting) `format` wins — the
 * content keyword is dropped, not overwritten. Without this, retiring
 * down-convert would silently lose the `format` signal on 3.1 binary uploads.
 */
const normalizeContentFormat = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  if (schema.type !== 'string') {
    return schema
  }

  // `contentMediaType`/`contentEncoding` are 3.1 keywords the 3.0-typed
  // SchemaObject does not model; read them loosely.
  const view: OpenAPIV3.SchemaObject & {
    contentMediaType?: unknown
    contentEncoding?: unknown
  } = schema

  const derivedFormat =
    view.contentMediaType === 'application/octet-stream'
      ? 'binary'
      : view.contentEncoding === 'base64'
        ? 'byte'
        : undefined

  if (derivedFormat === undefined) {
    return schema
  }

  const { contentMediaType: _contentMediaType, contentEncoding: _contentEncoding, ...rest } = view

  return 'format' in rest ? rest : { ...rest, format: derivedFormat }
}

/**
 * In-place applicators that evaluate keys `unevaluatedProperties` would
 * otherwise see. `$ref` never reaches `normalizeSchemaShape`, and both the
 * dispatcher and the merge refuse a schema with `not`.
 */
const inPlaceApplicators = [
  'allOf',
  'oneOf',
  'anyOf',
  'if',
  'then',
  'else',
  'dependentSchemas',
  '$dynamicRef'
]

/**
 * With no in-place applicator on the same schema, `unevaluatedProperties`
 * means the same as `additionalProperties` (JSON Schema 2020-12 §11.3,
 * §10.3.2.3), so rename it. When `additionalProperties` is also present it
 * evaluates every remaining key, so `unevaluatedProperties` is dropped.
 */
const normalizeUnevaluatedProperties = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  if (!('unevaluatedProperties' in schema)) {
    return schema
  }

  if (inPlaceApplicators.some(keyword => keyword in schema)) {
    return schema
  }

  // `unevaluatedProperties` is a 3.1 keyword the 3.0-typed SchemaObject does
  // not model; read it via an annotated destructure.
  const {
    unevaluatedProperties,
    ...rest
  }: OpenAPIV3.SchemaObject & {
    unevaluatedProperties?: unknown
  } = schema

  if ('additionalProperties' in rest) {
    return rest
  }

  if (!isAdditionalPropertiesValue(unevaluatedProperties)) {
    return schema
  }

  return { ...rest, additionalProperties: unevaluatedProperties }
}

/**
 * Is this a value `additionalProperties` accepts: a boolean, or a schema or
 * `$ref` object?
 */
const isAdditionalPropertiesValue = (
  value: unknown
): value is OpenAPIV3.SchemaObject['additionalProperties'] =>
  typeof value === 'boolean' ||
  (typeof value === 'object' && value !== null && !Array.isArray(value))

/**
 * Map the 3.1-only schema-shape encodings onto the shared IR shape before
 * dispatching: `unevaluatedProperties`, type arrays, `const`, `examples[]`,
 * numeric exclusive bounds, and binary/base64 content keywords. Each step
 * returns its input unchanged when it does not apply, so the composed result
 * is referentially equal to `schema` when nothing matched — letting the
 * dispatcher re-dispatch only when needed. Idempotent: a normalized schema
 * comes back as the same object.
 */
export const normalizeSchemaShape = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  return normalizeExclusiveBounds(
    normalizeExamples(
      normalizeConst(
        normalizeContentFormat(normalizeTypeArray(normalizeUnevaluatedProperties(schema)))
      )
    )
  )
}

/**
 * Is `type` only `null` (`'null'` or `['null']`)? `'null'` is a 3.1 type the
 * 3.0-typed SchemaObject does not model, so read it loosely.
 */
export const isNullOnlyType = (type: unknown): boolean =>
  type === 'null' || (Array.isArray(type) && type.length > 0 && type.every(item => item === 'null'))

/**
 * Normalize a schema as it enters the `allOf`/`oneOf`/`anyOf` merge: the
 * {@link normalizeSchemaShape} rules, plus a null-only member (`type: 'null'`
 * or `['null']`) becomes `{ nullable: true }` with no `type`, so it adds
 * nullability instead of conflicting with the other members' types.
 * Idempotent, like `normalizeSchemaShape`.
 */
export const normalizeMergeMember = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  const normalized = normalizeSchemaShape(schema)

  if (!isNullOnlyType(normalized.type)) {
    return normalized
  }

  const { type: _type, ...rest } = normalized

  return { ...rest, nullable: true }
}
