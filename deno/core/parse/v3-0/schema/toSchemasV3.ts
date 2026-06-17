import { toRefV31 } from '@/parse/v3-0/ref/toRefV31.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toArray } from '@/parse/v3-0/array/toArray.ts'
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
 * Collapse a single-member `oneOf`/`anyOf` into its surviving member.
 *
 * The wrapper's sibling keywords must ride into the member rather than
 * being discarded. The critical one is `nullable`: down-convert's
 * `convertNullableOneOfAnyOf` rewrites the 3.1 idiom
 * `oneOf:[{type:'string'},{type:'null'}]` ("string or null") into
 * `oneOf:[{type:'string'}]` + a hoisted `nullable:true` on the wrapper.
 * The old short-circuit re-dispatched `members[0]` alone, dropping the
 * wrapper (`...value`) and silently turning `string | null` back into a
 * non-nullable `string`. `description`/`title`/`readOnly`/... ride along
 * the same way.
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

  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    return stackTrail.trace('allOf', st => {
      const merged = mergeIntersection({
        schema,
        getRef: toGetRef(context.documentObject)
      })

      return toSchemaV3({ schema: merged, stackTrail: st, context })
    });
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return stackTrail.trace('oneOf', st => {
      const merged = mergeUnion({
        schema,
        getRef: toGetRef(context.documentObject),
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
        // A 3.1 nullable reference `oneOf:[{$ref},{type:null}]` down-converts
        // to a single `$ref` member + a hoisted `nullable:true`. Nullability
        // here is a *use-site* property — the same refName may be referenced
        // nullable at one site and not another — so it rides the OasRef node
        // itself, NOT the shared referent and NOT a synthetic union.
        // Generators read `ref.nullable` (`'nullable' in schema ?
        // schema.nullable`) and render `Foo | null`; `ModelDriver` builds the
        // un-nullable shared `Foo` from the refName. See
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
    });
  }

  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    return stackTrail.trace('anyOf', st => {
      // deno-lint-ignore ban-ts-comment
      // @ts-expect-error
      if (schema['x-expansionResources'] && Array.isArray(schema.anyOf)) {
        const { anyOf, ...value } = schema
        return toUnion({ value, members: anyOf, parentType: 'anyOf', stackTrail: st, context })
      }

      const merged = mergeUnion({
        schema,
        getRef: toGetRef(context.documentObject),
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
    });
  }

  if ('type' in schema) {
    switch (schema.type) {
      case 'object':
        return toObject({ value: schema, stackTrail, context });
      case 'array':
        return toArray({ value: schema, stackTrail, context });
      case 'integer':
        return toInteger({ value: schema, stackTrail, context });
      case 'number':
        return toNumber({ value: schema, stackTrail, context });
      case 'boolean':
        return toBoolean({ value: schema, stackTrail, context });
      case 'string':
        return toString({ value: schema, stackTrail, context });
    }
  }

  // Otherwise cases
  if (possibleObject(schema)) {
    context.logIssueNoKey({
      level: 'warning',
      message: 'Object has "properties" property, but is missing type="object" property',
      parent: schema,
      stackTrail,
      type: 'MISSING_OBJECT_TYPE'
    })

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
