import { toRefV31 } from '@/parse/v3-0/ref/toRefV31.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { toArray } from '@/parse/v3-0/array/toArray.ts'
import { toObject } from '../object/toObject.ts'
import { toInteger } from '../integer/toInteger.ts'
import { toNumber } from '../number/toNumber.ts'
import { toBoolean } from '../boolean/toBoolean.ts'
import { toString } from '../string/toString.ts'
import { toUnknown } from '../unknown/toUnknown.ts'
import { toUnion } from '../union/toUnion.ts'
import { toGetRef } from '@/helpers/refFns.ts'
import { toSiblingKeywords } from '@/parse/toSiblingKeywords.ts'
import { logAllOfContradictions, toAllOfSystem } from '@/parse/allOfSystem.ts'
import {
  hasShapeKeyword,
  isUnknownAnyOf,
  logMergedUnknownAnyOf,
  logUnknownAnyOf,
  withoutUnknownAnyOf
} from '@/parse/anyOfSystem.ts'
import { toAdditionalPropertiesV3 } from '../object/toAdditionalPropertiesV3.ts'
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

  // OpenAPI `not` has no faithful TypeScript representation: a generated type
  // that ignored it would *widen* the contract (accepting shapes the schema
  // forbids). Under `client.json` `system.not: strict` (the default) the schema
  // is refused rather than emit a type that lies. The throw is isolated by
  // `tryParseAt` into an `INVALID_SCHEMA` issue, and consumers of this schema
  // are pruned via `removeErroredItems` (INVALID_DEPENDENCY_REF).
  //
  // Under `system.not: unknown` the schema parses with its other keywords, and
  // its `not` is kept as an `OasUnknown` that core does not read: a generator
  // can see that the document says "not something".
  if ('not' in schema) {
    // A test's mock context may have no `system`.
    if (context.system?.not !== 'unknown') {
      throw new Error('Schema uses unsupported "not" keyword')
    }

    const { not: _not, ...keywords } = schema
    const parsed = toSchemaV3({ schema: keywords, stackTrail, context })

    // Only a one-member `allOf` of a `$ref` parses to a reference, and a
    // reference has no field for a `not`. Fail rather than lose it.
    if (parsed.isRef()) {
      throw new Error('Schema uses "not" next to a one-member allOf reference, which cannot keep it')
    }

    parsed.not = stackTrail.trace('not', notTrail =>
      context.withStackTrail(notTrail, () => new OasUnknown({}, context))
    )

    return parsed
  }

  if ('allOf' in schema && Array.isArray(schema.allOf)) {
    return stackTrail.trace('allOf', st => {
      // A single-member allOf collapses to its sole member — the value must
      // satisfy exactly that one schema. When the member is a `$ref`, keep it
      // LAZY (as an OasRef) rather than resolving + merging its target: a
      // `{ allOf: [{$ref: self}], nullable: true }` (a nullable reference
      // written as a one-member allOf — common in real specs) is
      // self-referential, and eagerly resolving it would not terminate. The
      // ref resolves at use time like every other ref. This mirrors the
      // single-member oneOf/anyOf handling below.
      const { allOf, ...value } = schema
      const members = allOf ?? []

      if (members.length === 1) {
        const [member] = members

        // Keywords next to the one member say how this site uses the
        // reference, which stays lazy, so a self-reference still ends:
        // `nullable`, `readOnly` and `writeOnly` ride it as use-site flags,
        // and the others are read without the target's type (`siblings`).
        // `resolve()` applies them to a copy of the target at generate time;
        // the ones its type cannot take are left out there. The shared model
        // never changes.
        if (isRef(member)) {
          const { nullable, readOnly, writeOnly, ...keywords } = value
          const siblings = isEmpty(keywords)
            ? undefined
            : toSiblingKeywords({
                keywords,
                properties: stackTrail.trace('properties', propertiesTrail =>
                  toOptionalSchemasV3({ schemas: keywords.properties, stackTrail: propertiesTrail, context })
                ),
                additionalProperties: stackTrail.trace('additionalProperties', additionalTrail =>
                  toAdditionalPropertiesV3({
                    additionalProperties: keywords.additionalProperties,
                    stackTrail: additionalTrail,
                    context
                  })
                ),
                stackTrail,
                context
              })

          if (nullable || readOnly || writeOnly || siblings) {
            return toRefV31({
              ref: member,
              refType: 'schema',
              nullable: nullable || undefined,
              readOnly: readOnly || undefined,
              writeOnly: writeOnly || undefined,
              siblings,
              stackTrail: st,
              context
            })
          }
        }

        return toSchemaV3({
          schema: collapseSingleMember(value, member),
          stackTrail: st,
          context
        })
      }

      const system = toAllOfSystem(context)
      const merged = mergeIntersection({
        schema,
        getRef: toGetRef(context.documentObject),
        system
      })

      logAllOfContradictions({ system, stackTrail, parent: schema, context })
      logMergedUnknownAnyOf({ system, stackTrail, parent: schema, context })

      return toSchemaV3({ schema: merged, stackTrail: st, context })
    })
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return stackTrail.trace('oneOf', st => {
      const system = toAllOfSystem(context)
      const merged = mergeUnion({
        schema,
        getRef: toGetRef(context.documentObject),
        system,
        groupType: 'oneOf'
      })

      logAllOfContradictions({ system, stackTrail, parent: schema, context })
      logMergedUnknownAnyOf({ system, stackTrail, parent: schema, context })

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
    })
  }

  if ('anyOf' in schema && Array.isArray(schema.anyOf)) {
    // Under `system.anyOf: unknown`, as Cloudflare's `cf` reads it, an `anyOf`
    // of two or more members is any value: the schema parses with its other
    // keywords, so the properties next to it stay, without the members.
    if (isUnknownAnyOf({ members: schema.anyOf, setting: context.system?.anyOf, getRef: toGetRef(context.documentObject) })) {
      logUnknownAnyOf({ stackTrail, parent: schema, context })

      const keywords = withoutUnknownAnyOf({
        schema,
        setting: context.system?.anyOf,
        getRef: toGetRef(context.documentObject)
      })

      // A `default` alone is no type: the parser would guess one from it.
      return hasShapeKeyword(keywords)
        ? toSchemaV3({ schema: keywords, stackTrail, context })
        : toUnknown({ value: keywords, stackTrail, context })
    }

    return stackTrail.trace('anyOf', st => {
      // deno-lint-ignore ban-ts-comment
      // @ts-expect-error
      if (schema['x-expansionResources'] && Array.isArray(schema.anyOf)) {
        const { anyOf, ...value } = schema
        return toUnion({ value, members: anyOf, parentType: 'anyOf', stackTrail: st, context })
      }

      const system = toAllOfSystem(context)
      const merged = mergeUnion({
        schema,
        getRef: toGetRef(context.documentObject),
        system,
        groupType: 'anyOf'
      })

      logAllOfContradictions({ system, stackTrail, parent: schema, context })
      logMergedUnknownAnyOf({ system, stackTrail, parent: schema, context })

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
    // 3.0 requires `type`, so its absence is a real (if benign) deviation —
    // recorded at `debug` rather than `warning`: `properties` makes the
    // intent unambiguous and inferring `object` is reliable, so it is noise
    // in the default view but worth keeping in the record. (The v3-1 parser
    // is silent here — type-less is valid in 3.1.)
    context.logIssueNoKey({
      level: 'debug',
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
