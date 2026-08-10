import { toRefV31 } from '@/parse/v3-1/ref/toRefV31.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toArray } from '@/parse/v3-1/array/toArray.ts'
import { toObject } from '../object/toObject.ts'
import { toInteger } from '../integer/toInteger.ts'
import { toNumber } from '../number/toNumber.ts'
import { toBoolean } from '../boolean/toBoolean.ts'
import { toString } from '../string/toString.ts'
import { toUnknown } from '../unknown/toUnknown.ts'
import { toUnion } from '../union/toUnion.ts'
import { toGetRef } from '@/helpers/refFns.ts'
import { mergeIntersection } from '../_merge-all-of/merge-intersection.ts'
import { mergeUnion } from '../_merge-all-of/merge-union.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
  stackTrail: StackTrail
  context: ParseContextType
}

export const toSchemasV3 = ({
  schemas,
  stackTrail,
  context
}: ToSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> => {
  const output: Record<string, OasSchema | OasRef<'schema'>> = {}
  const entries = Object.entries(schemas)

  for (const [key, schema] of entries) {
    const value = tryParseAt({
      stackTrail,
      key,
      context,
      type: 'INVALID_SCHEMA',
      parent: schema,
      fn: st => toSchemaV3({ schema, stackTrail: st, context })
    })
    if (value !== undefined) {
      output[key] = value
    }
  }

  return output
}

export type ToOptionalSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalSchemasV3 = ({
  schemas,
  stackTrail,
  context
}: ToOptionalSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> | undefined => {
  if (!schemas) {
    return undefined
  }

  return toSchemasV3({ schemas, stackTrail, context })
}

export type ToSchemaV3Args = {
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * OpenAPI 3.1 lets a schema's `type` be an ARRAY (e.g. `['string', 'null']`),
 * which the shared IR — modelling a single `type` plus a `nullable` flag —
 * does not. Normalize the array form into shapes the rest of the dispatcher
 * already understands:
 *
 *   - `['T', 'null']`   (one non-null type)  → `{ type: 'T', nullable: true }`
 *   - `['T1', 'T2', …]` (several non-null)   → a `oneOf` of the bare types,
 *     i.e. the 3.1 multi-type union. 3.0 cannot express this — it is the
 *     CASE-2 gap where the v3-0 parser degrades to OasUnknown.
 *   - `['null']`        (only null)          → left unchanged → OasUnknown,
 *     since there is no first-class OasNull IR node yet (a documented gap).
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
      return { ...schema, type: members[0], nullable }
    case 'array':
      return 'items' in schema ? { ...schema, type: members[0], nullable } : schema
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

  const next: OpenAPIV3.SchemaObject = { ...schema }

  if (typeof exclusiveMinimum === 'number') {
    next.minimum = exclusiveMinimum
    next.exclusiveMinimum = true
  }

  if (typeof exclusiveMaximum === 'number') {
    next.maximum = exclusiveMaximum
    next.exclusiveMaximum = true
  }

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
 * Map the 3.1-only schema-shape encodings onto the shared IR shape before
 * dispatching: type arrays, `const`, `examples[]`, numeric exclusive bounds,
 * and binary/base64 content keywords. Each step returns its input unchanged
 * when it does not apply, so the composed result is referentially equal to
 * `schema` when nothing matched — letting the dispatcher re-dispatch only when
 * needed.
 */
const normalizeSchemaShape = (schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject => {
  return normalizeExclusiveBounds(
    normalizeExamples(normalizeConst(normalizeContentFormat(normalizeTypeArray(schema))))
  )
}

/**
 * Is this a 3.1 `{ type: 'null' }` schema member? (`'null'` is a 3.1 type
 * literal the 3.0-typed SchemaObject does not model, so read it loosely.)
 */
const isNullTypeSchema = (member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject): boolean => {
  if (isRef(member)) {
    return false
  }

  const type: unknown = member.type
  return type === 'null'
}

/**
 * Split `oneOf`/`anyOf` members into the non-null members plus whether a
 * `{ type: 'null' }` member was present. In 3.1 that null member is how a
 * union expresses nullability (3.0 used the hoisted `nullable` keyword);
 * folding it into a flag lets the collapse/union logic stay unchanged.
 */
const partitionNullMember = (
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
): { members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]; nullable: boolean } => {
  const nonNull = members.filter(member => !isNullTypeSchema(member))
  return { members: nonNull, nullable: nonNull.length !== members.length }
}

/**
 * Collapse a single-member `oneOf`/`anyOf` into its surviving member.
 *
 * The wrapper's sibling keywords must ride into the member rather than
 * being discarded. The critical one is `nullable`: the 3.1 idiom
 * `oneOf:[{type:'string'},{type:'null'}]` ("string or null") has its
 * `{type:'null'}` member folded out by `partitionNullMember` above, leaving
 * `oneOf:[{type:'string'}]` + `nullable:true` on the wrapper. Re-dispatching
 * `members[0]` alone would drop the wrapper (`...value`) and silently turn
 * `string | null` back into a non-nullable `string`.
 * `description`/`title`/`readOnly`/... ride along the same way.
 *
 * Precedence: the member is the more specific schema, so it wins direct
 * conflicts (`{ ...value, ...member }`). `nullable` is the exception — it
 * OR-ins, because a nullable wrapper makes the whole schema nullable even
 * when the member itself is not.
 *
 * A ref member only reaches here when the wrapper carries no `nullable`
 * (the nullable-ref case stamps `nullable` on the OasRef node at the call
 * site, via `toRefV31`). Any other wrapper siblings on a bare `$ref` are
 * ignored per 3.0 ref semantics, so the ref is returned untouched.
 */
type ToUnionSchemaArgs = {
  /** The schema carrying the union keyword; its members are passed separately. */
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[]
  /** Which keyword the author wrote. Kept for stack trails and messages only. */
  parentType: 'oneOf' | 'anyOf'
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Parse a union, whichever keyword spelled it.
 *
 * `anyOf` and `oneOf` converge on one IR node: `OasUnion` records no source
 * keyword, and `toJsonSchema` emits `oneOf` for both. Keeping two near-identical
 * branches maintained a distinction nothing downstream could observe, and left
 * the merge with two group types to cross-product — so the members are merged
 * under one spelling here.
 *
 * `parentType` still carries the author's keyword, so stack trails and
 * skipped-field messages name what they actually read.
 *
 * The collapse is not free of meaning: `oneOf` is exactly-one and `anyOf` is
 * at-least-one, so a value matching two `anyOf` members is valid under `anyOf`
 * and not under `oneOf`. Codegen cannot express that difference — it
 * deserialises into one shape either way — and Stainless and Speakeasy both make
 * the same collapse deliberately, Speakeasy to avoid an explosion of types.
 * See skmtc#117.
 */
const toUnionSchema = ({
  value,
  members,
  parentType,
  stackTrail,
  context
}: ToUnionSchemaArgs): OasSchema | OasRef<'schema'> => {
  // 3.1: a `{ type: 'null' }` member makes the union nullable. Fold it into a
  // `nullable` flag the collapse/union logic already understands.
  const { members: withoutNull, nullable: hasNullMember } = partitionNullMember(members)

  const merged = mergeUnion({
    schema: hasNullMember
      ? { ...value, oneOf: withoutNull, nullable: true }
      : { ...value, oneOf: members },
    getRef: toGetRef(context.documentObject),
    groupType: 'oneOf'
  })

  if (!('oneOf' in merged) || !Array.isArray(merged.oneOf)) {
    throw new Error(`Missing "${parentType}" array`)
  }

  const { oneOf: mergedMembers, ...rest } = merged

  if (mergedMembers.length === 0) {
    throw new Error(`"${parentType}" array is empty`)
  }

  if (mergedMembers.length === 1) {
    const [soleMember] = mergedMembers
    // A 3.1 nullable reference `oneOf:[{$ref},{type:'null'}]` becomes a single
    // `$ref` member + `nullable:true` once the null member above is folded out.
    // Nullability here is a *use-site* property — the same refName may be
    // referenced nullable at one site and not another — so it rides the OasRef
    // node itself, NOT the shared referent and NOT a synthetic union.
    // Generators read `ref.nullable` and render `Foo | null`; `ModelDriver`
    // builds the un-nullable shared `Foo` from the refName. See
    // notes/openapi-3.1-webhooks-and-parser-architecture.md §3.4.
    if (isRef(soleMember) && rest.nullable) {
      return toRefV31({ ref: soleMember, refType: 'schema', nullable: true, stackTrail, context })
    }

    return toSchemaV3({ schema: collapseSingleMember(rest, soleMember), stackTrail, context })
  }

  return toUnion({ value: rest, members: mergedMembers, parentType, stackTrail, context })
}

const collapseSingleMember = (
  value: OpenAPIV3.SchemaObject,
  member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
): OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject => {
  if (isRef(member)) {
    return member
  }

  const merged: OpenAPIV3.SchemaObject = { ...value, ...member }

  if (value.nullable || member.nullable) {
    merged.nullable = true
  }

  return merged
}

export const toSchemaV3 = ({
  schema,
  stackTrail,
  context
}: ToSchemaV3Args): OasSchema | OasRef<'schema'> => {
  if (isRef(schema)) {
    return toRefV31({ ref: schema, refType: 'schema', stackTrail, context })
  }

  // OpenAPI `not` has no faithful TypeScript representation: a generated type
  // that ignored it would *widen* the contract (accepting shapes the schema
  // forbids). Refuse the schema rather than emit a type that lies. The throw
  // is isolated by `tryParseAt` into an `INVALID_SCHEMA` issue, and consumers
  // of this schema are pruned via `removeErroredItems` (INVALID_DEPENDENCY_REF).
  if ('not' in schema) {
    throw new Error('Schema uses unsupported "not" keyword')
  }

  const normalized = normalizeSchemaShape(schema)

  if (normalized !== schema) {
    return toSchemaV3({ schema: normalized, stackTrail, context })
  }

  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    return stackTrail.trace('allOf', st => {
      // A single-member allOf collapses to its sole member — the value must
      // satisfy exactly that one schema. When the member is a `$ref`, keep it
      // LAZY (as an OasRef) rather than resolving + merging its target: a
      // `{ allOf: [{$ref: self}], nullable: true }` (a nullable reference
      // written as a one-member allOf — common in real specs) is
      // self-referential, and eagerly resolving it would not terminate. The
      // ref resolves at use time like every other ref. Mirrors the
      // single-member oneOf/anyOf handling below.
      const { allOf, ...value } = schema
      const members = allOf ?? []

      if (members.length === 1) {
        const [member] = members

        if (isRef(member) && value.nullable) {
          return toRefV31({
            ref: member,
            refType: 'schema',
            nullable: true,
            stackTrail: st,
            context
          })
        }

        return toSchemaV3({
          schema: collapseSingleMember(value, member),
          stackTrail: st,
          context
        })
      }

      const merged = mergeIntersection({
        schema,
        getRef: toGetRef(context.documentObject)
      })

      return toSchemaV3({ schema: merged, stackTrail: st, context })
    })
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return stackTrail.trace('oneOf', st => {
      const { oneOf, ...value } = schema

      return toUnionSchema({
        value,
        members: oneOf ?? [],
        parentType: 'oneOf',
        stackTrail: st,
        context
      })
    })
  }

  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    return stackTrail.trace('anyOf', st => {
      // deno-lint-ignore ban-ts-comment
      // @ts-expect-error
      if (schema['x-expansionResources'] && Array.isArray(schema.anyOf)) {
        const { anyOf, ...value } = schema
        return toUnion({ value, members: anyOf, parentType: 'anyOf', stackTrail: st, context })
      }

      const { anyOf, ...value } = schema

      return toUnionSchema({
        value,
        members: anyOf ?? [],
        parentType: 'anyOf',
        stackTrail: st,
        context
      })
    })
  }

  if ('type' in schema) {
    switch (schema.type) {
      case 'object':
        return toObject({ value: schema, stackTrail, context })
      case 'array':
        return toArray({ value: schema, stackTrail, context })
      case 'integer':
        return toInteger({ value: schema, stackTrail, context })
      case 'number':
        return toNumber({ value: schema, stackTrail, context })
      case 'boolean':
        return toBoolean({ value: schema, stackTrail, context })
      case 'string':
        return toString({ value: schema, stackTrail, context })
    }
  }

  // Otherwise cases
  if (possibleObject(schema)) {
    // In 3.1 `type` is optional, so a schema with `properties` and no `type`
    // is a normal, valid object schema — inferring `object` is the expected
    // reading, not a deviation, so it is silent. (The v3-0 parser keeps the
    // MISSING_OBJECT_TYPE warning: 3.0 requires `type`, so its absence there
    // is a real signal.)
    return toObject({
      value: {
        ...schema,
        type: 'object'
      },
      stackTrail,
      context
    })
  }

  if (possibleArray(schema)) {
    context.logIssueNoKey({
      level: 'warning',
      message: 'Object has "items" property, but is missing type="array" property',
      parent: schema,
      stackTrail,
      type: 'MISSING_ARRAY_TYPE'
    })

    return toArray({
      value: {
        ...schema,
        type: 'array'
        // Adding cast here since {} is a valid value for items
      } as OpenAPIV3.ArraySchemaObject,
      stackTrail,
      context
    })
  }

  if (possibleBoolean(schema)) {
    context.logIssueNoKey({
      level: 'warning',
      message:
        'Object has a boolean "default" or "example" property, but is missing type="boolean" property',
      parent: schema,
      stackTrail,
      type: 'MISSING_BOOLEAN_TYPE'
    })

    return toBoolean({
      value: {
        ...schema,
        type: 'boolean'
      },
      stackTrail,
      context
    })
  }

  if (possibleString(schema)) {
    context.logIssueNoKey({
      level: 'warning',
      message:
        'Object has a string "default" or "example" property, but is missing type="string" property',
      parent: schema,
      stackTrail,
      type: 'MISSING_STRING_TYPE'
    })

    return toString({
      value: {
        ...schema,
        type: 'string'
      },
      stackTrail,
      context
    })
  }

  return toUnknown({ value: schema, stackTrail, context })
}

const possibleString = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    (('default' in value && typeof value.default === 'string') ||
      ('example' in value && typeof value.example === 'string') ||
      ('enum' in value &&
        Array.isArray(value.enum) &&
        value.enum.every(item => typeof item === 'string')) ||
      ('format' in value &&
        typeof value.format === 'string' &&
        ['date', 'date-time', 'binary', 'byte'].includes(value.format)))
  )
}

const possibleBoolean = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    (('default' in value && typeof value.default === 'boolean') ||
      ('example' in value && typeof value.example === 'boolean'))
  )
}

const possibleArray = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    'items' in value &&
    value.items &&
    typeof value.items === 'object' &&
    value.items
  )
}

const possibleObject = (value: unknown) => {
  return (
    value &&
    typeof value === 'object' &&
    'properties' in value &&
    typeof value.properties === 'object' &&
    value.properties
  )
}

export type ToOptionalSchemaV3Args = {
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalSchemaV3 = ({
  schema,
  stackTrail,
  context
}: ToOptionalSchemaV3Args): OasSchema | OasRef<'schema'> | undefined => {
  if (!schema) {
    return undefined
  }

  return toSchemaV3({ schema, stackTrail, context })
}
