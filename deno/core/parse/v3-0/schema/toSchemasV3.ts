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
import { extendsSchema, toMemberRef, toParseGetRef } from '@/helpers/toParseGetRef.ts'
import { toSchemaExpansion, toSynthesizedName } from '@/context/SchemaExpansion.ts'
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
  const expansion = toSchemaExpansion(context)

  for (const [key, schema] of entries) {
    const value = tryParseAt({
      stackTrail,
      key,
      context,
      type: 'INVALID_SCHEMA',
      parent: schema,
      // Built under its own name: while `key` is in progress, a cycle back
      // into it is recognised by name (see `toParseGetRef`) or by node
      // identity (see the `allOf` branch of `toSchemaV3`).
      fn: st => expansion.enter(schema, key, () => toSchemaV3({ schema, stackTrail: st, context }))
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
  // forbids). Refuse the schema rather than emit a type that lies. The throw
  // is isolated by `tryParseAt` into an `INVALID_SCHEMA` issue, and consumers
  // of this schema are pruned via `removeErroredItems` (INVALID_DEPENDENCY_REF).
  if ('not' in schema) {
    throw new Error('Schema uses unsupported "not" keyword')
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

      return eliminateAllOf({ schema, stackTrail, st, context })
    })
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return stackTrail.trace('oneOf', st => {
      const soleRef = toSoleRefMember(schema, 'oneOf')

      if (soleRef) {
        return toRefV31({
          ref: soleRef,
          refType: 'schema',
          nullable: schema.nullable === true ? true : undefined,
          stackTrail: st,
          context
        })
      }

      const { merged, inheriting } = mergeUnionWrapper({
        schema: schema,
        wrapperName: toSchemaExpansion(context).nameOf(schema),
        groupType: 'oneOf',
        stackTrail: st,
        context
      })

      if (!('oneOf' in merged) || !Array.isArray(merged.oneOf)) {
        throw new Error('Missing "oneOf" array')
      }

      const { oneOf: mergedMembers, ...value } = merged
      const members = [...inheriting, ...mergedMembers]

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

      return toUnion({
        value,
        members,
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
        return toUnion({
          value,
          members: anyOf,
          parentType: 'anyOf',
          stackTrail: st,
          context
        })
      }

      const soleRef = toSoleRefMember(schema, 'anyOf')

      if (soleRef) {
        return toRefV31({
          ref: soleRef,
          refType: 'schema',
          nullable: schema.nullable === true ? true : undefined,
          stackTrail: st,
          context
        })
      }

      const { merged, inheriting } = mergeUnionWrapper({
        schema: schema,
        wrapperName: toSchemaExpansion(context).nameOf(schema),
        groupType: 'anyOf',
        stackTrail: st,
        context
      })

      if (!('anyOf' in merged) || !Array.isArray(merged.anyOf)) {
        throw new Error('Missing "anyOf" array')
      }

      const { anyOf: mergedMembers, ...value } = merged
      const members = [...inheriting, ...mergedMembers]

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

      return toUnion({
        value,
        members,
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

type EliminateAllOfArgs = {
  schema: OpenAPIV3.SchemaObject
  /** The trail the schema was reached at — names a recursive inline `allOf`. */
  stackTrail: StackTrail
  /** The trail inside the `allOf` frame — where the merged result is built. */
  st: StackTrail
  context: ParseContextType
}

/**
 * Eliminate a multi-member `allOf` by merging its members into one schema,
 * without looping on a document that reaches this node again while it is
 * being merged.
 *
 * The merge copies property values by reference, so a cycle through a
 * property (`A: allOf [B, …]`, `B.properties.x: { allOf: [A-shaped …] }`)
 * hands `toSchemaV3` the SAME node object a second time, part-way through
 * building it. That second visit is answered with a `$ref` to the node's
 * name — the way a recursive type is written in any target language —
 * rather than by merging it again:
 *
 * - a component already has a name, and the ref resolves to the component;
 * - an inline `allOf` is given one from its location (`toSynthesizedName`)
 *   and, because something now refers to it, is registered as a component
 *   at the end of the parse (`ParseContext.parse`). The site that held it
 *   inline refers to the new component too, so the schema exists once.
 *
 * An inline `allOf` nothing refers back to is merged in place as before:
 * no name, no new component, identical IR to today.
 */
const eliminateAllOf = ({
  schema,
  stackTrail,
  st,
  context
}: EliminateAllOfArgs): OasSchema | OasRef<'schema'> => {
  const expansion = toSchemaExpansion(context)

  if (expansion.isBuilding(schema)) {
    const name = expansion.nameOf(schema)

    if (name === undefined) {
      throw new Error('Re-entered an allOf that has no name')
    }

    expansion.markReferenced(schema)

    return toRefV31({
      ref: { $ref: `#/components/schemas/${name}` },
      refType: 'schema',
      stackTrail: st,
      context
    })
  }

  const build = (): OasSchema | OasRef<'schema'> => {
    expansion.startBuilding(schema)

    const merged = mergeIntersection({
      schema,
      getRef: toParseGetRef(context)
    })

    return toSchemaV3({ schema: merged, stackTrail: st, context })
  }

  if (expansion.nameOf(schema) !== undefined) {
    return build()
  }

  const name = toSynthesizedName(stackTrail)

  return expansion.enter(schema, name, () => {
    const node = build()

    if (!expansion.wasReferenced(schema)) {
      return node
    }

    expansion.synthesize(name, schema, node)

    context.logIssueNoKey({
      level: 'debug',
      type: 'CYCLIC_COMPOSITION',
      parent: schema,
      stackTrail: st,
      message: `Recursive inline allOf registered as component "${name}"`
    })

    return toRefV31({
      ref: { $ref: `#/components/schemas/${name}` },
      refType: 'schema',
      stackTrail: st,
      context
    })
  })
}

/**
 * Wrapper keywords that describe the union itself rather than extend its
 * members. A single-`$ref` union carrying only these is just a reference
 * (with the wrapper's nullability), and must not force the target to be
 * copied in — the OData `x-ms-navigationProperty` spelling of a nullable
 * self-reference (`{ type: object, anyOf: [{ $ref: self }], nullable }`)
 * would otherwise copy the parent into its own property without end.
 */
const UNION_ONLY_KEYWORDS = new Set([
  'oneOf',
  'anyOf',
  'type',
  'nullable',
  'description',
  'title',
  'example',
  'examples',
  'default',
  'deprecated',
  'readOnly',
  'writeOnly',
  'externalDocs',
  'discriminator'
])

/**
 * The single `$ref` member of a one-member `oneOf`/`anyOf` whose wrapper adds
 * nothing to it; `undefined` when the wrapper carries keywords that extend
 * the member (`properties`, `required`, …), which the merge handles.
 */
const toSoleRefMember = (
  schema: OpenAPIV3.SchemaObject,
  groupType: 'oneOf' | 'anyOf'
): OpenAPIV3.ReferenceObject | undefined => {
  const members = schema[groupType]

  if (!Array.isArray(members) || members.length !== 1) {
    return undefined
  }

  const [member] = members

  if (!isRef(member)) {
    return undefined
  }

  const extendsMember = Object.keys(schema).some(
    key => !UNION_ONLY_KEYWORDS.has(key) && !key.startsWith('x-')
  )

  return extendsMember ? undefined : member
}

type MergeUnionWrapperArgs = {
  schema: OpenAPIV3.SchemaObject
  /** The component name this union is the root of, when it is one. */
  wrapperName: string | undefined
  groupType: 'oneOf' | 'anyOf'
  stackTrail: StackTrail
  context: ParseContextType
}

type MergeUnionWrapperResult = {
  /** `mergeUnion` over the members the wrapper extends. */
  merged: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  /**
   * Members kept as written — refs to schemas that already `allOf`-extend
   * this wrapper, so pushing its keywords into them would only copy what
   * they inherit (and, with `Child: allOf [Parent]`, never finish).
   */
  inheriting: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
}

/**
 * Push a union wrapper's keywords into its members — except members that
 * inherit from the wrapper already.
 *
 * `Parent: { properties, discriminator, oneOf: [Child1, Child2] }` with each
 * `ChildN: allOf [Parent, own]` is the polymorphism idiom springdoc and
 * Swagger emit. The children have the parent's properties through their own
 * `allOf`; the parent's union is there to name them. Those members stay
 * `OasRef`s. A member that does NOT extend the wrapper is extended by it,
 * into a new inline schema, as before.
 */
const mergeUnionWrapper = ({
  schema,
  wrapperName,
  groupType,
  stackTrail,
  context
}: MergeUnionWrapperArgs): MergeUnionWrapperResult => {
  const getRef = toParseGetRef(context)
  const members = schema[groupType] ?? []

  const inheriting =
    wrapperName === undefined
      ? []
      : members.filter(member => {
          const ref = toMemberRef(member)

          if (ref === undefined) {
            return false
          }

          try {
            return extendsSchema(getRef(ref), wrapperName)
          } catch {
            return false
          }
        })

  if (inheriting.length === 0) {
    return { merged: mergeUnion({ schema, getRef, groupType }), inheriting }
  }

  const extending = members.filter(member => !inheriting.includes(member))

  context.logIssueNoKey({
    level: 'debug',
    type: 'CYCLIC_COMPOSITION',
    parent: schema,
    stackTrail,
    message: `${inheriting.length} ${groupType} member(s) already extend "${wrapperName}"; kept as references`
  })

  if (extending.length > 0) {
    return {
      merged: mergeUnion({
        schema: { ...schema, [groupType]: extending },
        getRef,
        groupType
      }),
      inheriting
    }
  }

  // Every member inherits: the wrapper's structural keywords are already in
  // each of them, so only the union-level ones survive on the union node.
  const unionOnly = Object.fromEntries(
    Object.entries(schema).filter(
      ([key]) => (UNION_ONLY_KEYWORDS.has(key) && key !== 'type') || key.startsWith('x-')
    )
  )

  return { merged: { ...unionOnly, [groupType]: [] }, inheriting }
}
