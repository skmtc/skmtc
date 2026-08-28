import { toRefV31 } from '@/parse/v3-0/ref/toRefV31.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef, toRefName } from '@/helpers/refFns.ts'
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
import {
  toParseGetRef,
  toMemberRef,
  memberRefNames,
  extendsSchemaTransitively
} from '@/helpers/toParseGetRef.ts'
import { excludedProperties } from '../_merge-all-of/decompose-union.ts'
import { mergeIntersection } from '../_merge-all-of/merge-intersection.ts'
import { mergeUnion } from '../_merge-all-of/merge-union.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToSchemasV3Args = {
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>
  stackTrail: StackTrail
  context: ParseContextType
  /**
   * True for `components.schemas` only: each entry is a named component,
   * built as a host so a cycle back into it is met by name. The same parser
   * handles `properties`, whose keys are NOT schema names.
   */
  components?: boolean
}

export const toSchemasV3 = ({
  schemas,
  stackTrail,
  context,
  components = false
}: ToSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> => {
  const output: Record<string, OasSchema | OasRef<'schema'>> = {}
  const entries = Object.entries(schemas)
  const expansion = context.expansion

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
      fn: st =>
        components
          ? expansion.enterHost(schema, key, () => toSchemaV3({ schema, stackTrail: st, context }))
          : toSchemaV3({ schema, stackTrail: st, context })
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
  /** See {@link ToSchemasV3Args.components}. */
  components?: boolean
}

export const toOptionalSchemasV3 = ({
  schemas,
  stackTrail,
  context,
  components
}: ToOptionalSchemasV3Args): Record<string, OasSchema | OasRef<'schema'>> | undefined => {
  if (!schemas) {
    return undefined
  }

  return toSchemasV3({ schemas, stackTrail, context, components })
}

export type ToSchemaV3Args = {
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
  /**
   * The author's node when `schema` is a normalised COPY of it. Cycle
   * detection keys on node identity, so a re-dispatch on a copy must say
   * which node it stands for.
   */
  identity?: object
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
  context,
  identity
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
          // The collapse is a copy; cycle detection keys on the author's node.
          identity: isRef(member) ? undefined : member,
          stackTrail: st,
          context
        })
      }

      return eliminateAllOf({ schema, identity, stackTrail, st, context })
    })
  }

  if ('oneOf' in schema && Array.isArray(schema.oneOf)) {
    return stackTrail.trace('oneOf', st => {
      const soleRef = toSoleRefMember({
        schema: schema,
        groupType: 'oneOf',
        stackTrail: st,
        context
      })

      if (soleRef) {
        return toRefV31({
          ref: soleRef,
          refType: 'schema',
          nullable: schema.nullable === true ? true : undefined,
          stackTrail: st,
          context
        })
      }

      const selfName = context.expansion.nameOf(identity ?? schema)
      const { value, members } = mergeUnionWrapper({
        schema: schema,
        wrapperName: selfName,
        groupType: 'oneOf',
        stackTrail: st,
        context
      })

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
          // The collapse is a copy; cycle detection keys on the author's node.
          identity: isRef(soleMember) ? undefined : soleMember,
          stackTrail: st,
          context
        })
      }

      return toUnion({
        value,
        members,
        parentType: 'oneOf',
        stackTrail: st,
        context,
        selfName
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

      const soleRef = toSoleRefMember({
        schema: schema,
        groupType: 'anyOf',
        stackTrail: st,
        context
      })

      if (soleRef) {
        return toRefV31({
          ref: soleRef,
          refType: 'schema',
          nullable: schema.nullable === true ? true : undefined,
          stackTrail: st,
          context
        })
      }

      const selfName = context.expansion.nameOf(identity ?? schema)
      const { value, members } = mergeUnionWrapper({
        schema: schema,
        wrapperName: selfName,
        groupType: 'anyOf',
        stackTrail: st,
        context
      })

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
          // The collapse is a copy; cycle detection keys on the author's node.
          identity: isRef(soleMember) ? undefined : soleMember,
          stackTrail: st,
          context
        })
      }

      return toUnion({
        value,
        members,
        parentType: 'anyOf',
        stackTrail: st,
        context,
        selfName
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
  /** The author's node, when `schema` is a normalised copy of it (3.1). */
  identity: object | undefined
  /** The trail the schema was reached at — names a recursive inline `allOf`. */
  stackTrail: StackTrail
  /** The trail inside the `allOf` frame — where the merged result is built. */
  st: StackTrail
  context: ParseContextType
}

const toComponentRef = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`
})

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
 * - an inline `allOf` is given one from its location (first visit wins, for
 *   the life of the parse) and, because something now refers to it, is
 *   registered as a component at the end of the parse
 *   (`ParseContext.parse`). The site that held it inline refers to the new
 *   component too, so the schema exists once; a later visit to the same node
 *   by another path refers to it as well rather than building it again.
 *
 * An inline `allOf` nothing refers back to is merged in place as before:
 * no name, no new component, identical IR to today.
 */
const eliminateAllOf = ({
  schema,
  identity,
  stackTrail,
  st,
  context
}: EliminateAllOfArgs): OasSchema | OasRef<'schema'> => {
  const expansion = context.expansion
  const node = identity ?? schema

  const refTo = (name: string) =>
    toRefV31({ ref: toComponentRef(name), refType: 'schema', stackTrail: st, context })

  const onChain = expansion.chainNameOf(node)

  if (onChain !== undefined) {
    expansion.markReferenced(node)

    return refTo(onChain)
  }

  const synthesized = expansion.synthesizedNameFor(node)

  if (synthesized !== undefined) {
    return refTo(synthesized)
  }

  const hostName = expansion.hostNameOf(node)
  const name = hostName ?? expansion.nameFor(node, stackTrail)

  // The bases stay on the chain while the merged result is PARSED, not just
  // while it is merged: the result holds their properties by reference, and a
  // union member met in there that names a base is a schema being copied.
  const allOf = Array.isArray(schema.allOf) ? schema.allOf : []
  const baseNames = allOf.filter(isRef).map(member => toRefName(member.$ref))
  // A copy of a component (its `allOf` array is the component's) is that
  // component being eliminated: its parent's union, met as a base, names it.
  const owner = expansion.ownerOf(schema.allOf ?? {})

  const build = (): OasSchema | OasRef<'schema'> => {
    const merged = mergeIntersection({ schema, getRef: toParseGetRef(context) })

    if (!isRef(merged)) {
      expansion.alias(merged, name)
    }

    return toSchemaV3({ schema: merged, stackTrail: st, context })
  }

  return expansion.withElimination(name, node, () => {
    const built = expansion.withChain(baseNames, () =>
      owner === undefined ? build() : expansion.withEliminating(owner, build)
    )

    if (hostName !== undefined || !expansion.wasReferenced(node)) {
      return built
    }

    expansion.synthesize(name, schema, built)

    context.logIssueNoKey({
      level: 'debug',
      type: 'CYCLIC_COMPOSITION',
      parent: schema,
      stackTrail: st,
      message: `Recursive inline allOf registered as component "${name}"`
    })

    return refTo(name)
  })
}

type ToSoleRefMemberArgs = {
  schema: OpenAPIV3.SchemaObject
  groupType: 'oneOf' | 'anyOf'
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * The single `$ref` member of a one-member `oneOf`/`anyOf` whose wrapper
 * adds nothing structural to it; `undefined` when the wrapper carries
 * keywords that extend the member (`properties`, `required`, `minProperties`,
 * …), which the merge handles.
 *
 * "Adds nothing structural" is decided by the same list `decomposeUnion`
 * keeps on the union rather than pushing into members, plus `type` — the
 * OData `x-ms-navigationProperty` spelling of a nullable self-reference is
 * `{ type: object, anyOf: [{ $ref: self }], nullable, description }`, and
 * pushing that `type` into the ref would copy the parent into its own
 * property without end. Metadata the wrapper carried (`description`,
 * `default`, …) has nowhere to go on an `OasRef` and is logged as skipped
 * so the loss is visible.
 */
const toSoleRefMember = ({
  schema,
  groupType,
  stackTrail,
  context
}: ToSoleRefMemberArgs): OpenAPIV3.ReferenceObject | undefined => {
  const members = schema[groupType]

  if (!Array.isArray(members) || members.length !== 1) {
    return undefined
  }

  const [member] = members

  if (!isRef(member)) {
    return undefined
  }

  const allowed = (key: string) =>
    key === groupType || key === 'type' || key.startsWith('x-') || excludedProperties.includes(key)

  if (!Object.keys(schema).every(allowed)) {
    return undefined
  }

  const { [groupType]: _members, type, nullable: _nullable, ...rest } = schema
  const extensions = Object.keys(rest).filter(key => key.startsWith('x-'))
  const metadata = Object.keys(rest).filter(key => !key.startsWith('x-'))

  // Metadata on a description-only wrapper has always been dropped here. A
  // wrapper that also carries `type` or an `x-` key used to be pushed INTO
  // the member (copying it, metadata and all); now that it stays a
  // reference, say what the reference cannot carry.
  if (metadata.length > 0 && (type !== undefined || extensions.length > 0)) {
    context.logIssueNoKey({
      level: 'debug',
      type: 'UNEXPECTED_PROPERTY',
      parent: schema,
      stackTrail,
      message: `Single-reference ${groupType}: ${metadata.join(', ')} cannot be carried on the reference and were dropped`
    })
  }

  return member
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
  /** The wrapper's union-level keywords — everything that stays on the union node. */
  value: OpenAPIV3.SchemaObject
  /**
   * The members, in the author's order. Kept as written: refs to schemas
   * that already `allOf`-extend this wrapper (pushing its keywords in would
   * only copy what they inherit), and members that name a schema still
   * being built (pushing keywords in would copy a schema that is not
   * finished — the recursion the named reference exists to avoid). Every
   * other member is extended by the wrapper, as before.
   */
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
}

/**
 * Push a union wrapper's keywords into its members — except the members
 * that must stay references.
 *
 * `Parent: { properties, discriminator, oneOf: [Child1, Child2] }` with each
 * `ChildN: allOf [Parent, own]` is the polymorphism idiom springdoc and
 * Swagger emit. The children have the parent's properties through their own
 * `allOf`; the parent's union is there to name them. Those members stay
 * `OasRef`s (recorded at debug — nothing is lost). A member that names a
 * schema still being built is kept too; that is lossy only when the wrapper
 * carries keywords that would have extended it, and is recorded at warning
 * in that case. A member that does neither is extended by the wrapper into
 * a new inline schema, as before.
 */
const mergeUnionWrapper = ({
  schema,
  wrapperName,
  groupType,
  stackTrail,
  context
}: MergeUnionWrapperArgs): MergeUnionWrapperResult => {
  const getRef = toParseGetRef(context)
  const expansion = context.expansion
  const members = schema[groupType] ?? []

  const inherits = (member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject): boolean => {
    const ref = toMemberRef(member)

    if (ref === undefined || wrapperName === undefined) {
      return false
    }

    return extendsSchemaTransitively(toRefName(ref.$ref), wrapperName, getRef)
  }

  const unfinished = (member: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject): boolean =>
    memberRefNames(member).some(name => expansion.isActive(name))

  const inheriting = members.filter(inherits)
  const deferred = members.filter(member => !inheriting.includes(member) && unfinished(member))
  const kept = new Set([...inheriting, ...deferred])

  if (inheriting.length > 0) {
    context.logIssueNoKey({
      level: 'debug',
      type: 'CYCLIC_COMPOSITION',
      parent: schema,
      stackTrail,
      message: `${inheriting.length} ${groupType} member(s) already extend "${wrapperName}"; kept as references`
    })
  }

  if (deferred.length > 0) {
    // Lossy only when the wrapper carries keywords that would have extended
    // the member; `type`, `nullable`, `description` and friends add nothing.
    const unapplied = Object.keys(schema).filter(
      key =>
        key !== groupType &&
        key !== 'type' &&
        !key.startsWith('x-') &&
        !excludedProperties.includes(key)
    )

    context.logIssueNoKey({
      level: unapplied.length > 0 ? 'warning' : 'debug',
      type: 'CYCLIC_COMPOSITION',
      parent: schema,
      stackTrail,
      message:
        unapplied.length > 0
          ? `${deferred.length} ${groupType} member(s) refer to a schema still being built; kept as references, ${unapplied.join(', ')} not applied to them`
          : `${deferred.length} ${groupType} member(s) refer to a schema still being built; kept as references`
    })
  }

  const toMembers = (merged: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject) => {
    const group = isRef(merged) ? undefined : merged[groupType]

    if (!Array.isArray(group)) {
      throw new Error(`Missing "${groupType}" array`)
    }

    return group
  }

  if (kept.size === 0) {
    const merged = mergeUnion({ schema, getRef, groupType })
    const { [groupType]: _group, ...value } = isRef(merged) ? {} : merged

    return { value, members: toMembers(merged) }
  }

  // Extend each remaining member on its own, so the author's order survives
  // with the kept members in place.
  const value = Object.fromEntries(
    Object.entries(schema).filter(
      ([key]) => key.startsWith('x-') || (key !== groupType && excludedProperties.includes(key))
    )
  )

  const extended = members.flatMap(member =>
    kept.has(member)
      ? [member]
      : toMembers(mergeUnion({ schema: { ...schema, [groupType]: [member] }, getRef, groupType }))
  )

  return { value, members: extended }
}
