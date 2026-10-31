import { toRefV31 } from '@/parse/v3-2/ref/toRefV31.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toArray } from '@/parse/v3-2/array/toArray.ts'
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
import {
  normalizeMergeMember,
  normalizeSchemaShape
} from '@/parse/v3-2/schema/normalize-schema-shape.ts'
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
 * Remove `unevaluatedProperties` from an `allOf`/`oneOf`/`anyOf` wrapper and
 * log it as skipped. Left in place, it would be renamed to
 * `additionalProperties` when the merged or collapsed schema is dispatched
 * again with no composition keyword left.
 */
const withoutWrapperUnevaluatedProperties = ({
  schema,
  parentType,
  stackTrail,
  context
}: {
  schema: OpenAPIV3.SchemaObject
  parentType: string
  stackTrail: StackTrail
  context: ParseContextType
}): OpenAPIV3.SchemaObject => {
  if (!('unevaluatedProperties' in schema)) {
    return schema
  }

  const {
    unevaluatedProperties,
    ...rest
  }: OpenAPIV3.SchemaObject & { unevaluatedProperties?: unknown } = schema

  context.logSkippedFields({
    skipped: { unevaluatedProperties },
    parent: schema,
    parentType,
    stackTrail
  })

  return rest
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
    const wrapper = withoutWrapperUnevaluatedProperties({
      schema,
      parentType: 'allOf',
      stackTrail,
      context
    })

    return stackTrail.trace('allOf', st => {
      // A single-member allOf collapses to its sole member — the value must
      // satisfy exactly that one schema. When the member is a `$ref`, keep it
      // LAZY (as an OasRef) rather than resolving + merging its target: a
      // `{ allOf: [{$ref: self}], nullable: true }` (a nullable reference
      // written as a one-member allOf — common in real specs) is
      // self-referential, and eagerly resolving it would not terminate. The
      // ref resolves at use time like every other ref. Mirrors the
      // single-member oneOf/anyOf handling below.
      const { allOf, ...value } = wrapper
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
        schema: wrapper,
        getRef: toGetRef(context.documentObject),
        normalize: normalizeMergeMember
      })

      return toSchemaV3({ schema: merged, stackTrail: st, context })
    })
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    const wrapper = withoutWrapperUnevaluatedProperties({
      schema,
      parentType: 'oneOf',
      stackTrail,
      context
    })

    return stackTrail.trace('oneOf', st => {
      // 3.1: a `{ type: 'null' }` member makes the union nullable. Fold it
      // into a `nullable` flag the collapse/union logic already understands.
      const { members: oneOfWithoutNull, nullable: hasNullMember } = partitionNullMember(
        wrapper.oneOf ?? []
      )
      const withoutNull: OpenAPIV3.SchemaObject = hasNullMember
        ? { ...wrapper, oneOf: oneOfWithoutNull, nullable: true }
        : wrapper

      const merged = mergeUnion({
        schema: withoutNull,
        getRef: toGetRef(context.documentObject),
        normalize: normalizeMergeMember,
        groupType: 'oneOf'
      })

      if (!('oneOf' in merged) || !Array.isArray(merged.oneOf)) {
        throw new Error('Missing "oneOf" array')
      }

      const { oneOf: members, ...value } = merged

      if (members.length === 0) {
        throw new Error('"oneOf" array is empty')
      }

      if (members.length === 1) {
        const [soleMember] = members
        // A 3.1 nullable reference `oneOf:[{$ref},{type:'null'}]` becomes a
        // single `$ref` member + `nullable:true` once the null member above
        // is folded out. Nullability here is a *use-site* property — the same
        // refName may be referenced nullable at one site and not another — so
        // it rides the OasRef node itself, NOT the shared referent and NOT a
        // synthetic union. Generators read `ref.nullable` and render
        // `Foo | null`; `ModelDriver` builds the un-nullable shared `Foo` from
        // the refName. See
        // notes/openapi-3.1-webhooks-and-parser-architecture.md §3.4.
        if (isRef(soleMember) && value.nullable) {
          return toRefV31({
            ref: soleMember,
            refType: 'schema',
            nullable: true,
            stackTrail: st,
            context
          })
        }

        return toSchemaV3({
          schema: collapseSingleMember(value, soleMember),
          stackTrail: st,
          context
        })
      }

      return toUnion({ value, members, parentType: 'oneOf', stackTrail: st, context })
    })
  }

  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    const wrapper = withoutWrapperUnevaluatedProperties({
      schema,
      parentType: 'anyOf',
      stackTrail,
      context
    })

    return stackTrail.trace('anyOf', st => {
      // deno-lint-ignore ban-ts-comment
      // @ts-expect-error
      if (wrapper['x-expansionResources'] && Array.isArray(wrapper.anyOf)) {
        const { anyOf, ...value } = wrapper
        return toUnion({ value, members: anyOf, parentType: 'anyOf', stackTrail: st, context })
      }

      // 3.1: a `{ type: 'null' }` member makes the union nullable (mirrors
      // the oneOf branch above).
      const { members: anyOfWithoutNull, nullable: hasNullMember } = partitionNullMember(
        wrapper.anyOf ?? []
      )
      const withoutNull: OpenAPIV3.SchemaObject = hasNullMember
        ? { ...wrapper, anyOf: anyOfWithoutNull, nullable: true }
        : wrapper

      const merged = mergeUnion({
        schema: withoutNull,
        getRef: toGetRef(context.documentObject),
        normalize: normalizeMergeMember,
        groupType: 'anyOf'
      })

      if (!('anyOf' in merged) || !Array.isArray(merged.anyOf)) {
        throw new Error('Missing "anyOf" array')
      }

      const { anyOf: members, ...value } = merged

      if (members.length === 0) {
        throw new Error('"anyOf" array is empty')
      }

      if (members.length === 1) {
        const [soleMember] = members
        // See the oneOf branch: a single `$ref` carrying a hoisted `nullable`
        // sets `nullable` on the OasRef node itself.
        if (isRef(soleMember) && value.nullable) {
          return toRefV31({
            ref: soleMember,
            refType: 'schema',
            nullable: true,
            stackTrail: st,
            context
          })
        }

        return toSchemaV3({
          schema: collapseSingleMember(value, soleMember),
          stackTrail: st,
          context
        })
      }

      return toUnion({ value, members, parentType: 'anyOf', stackTrail: st, context })
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
