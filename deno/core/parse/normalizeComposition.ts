import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toRefName } from '@/helpers/refFns.ts'
import { hoistCyclicAllOf } from '@/parse/hoistCyclicAllOf.ts'
import { excludedProperties } from '@/parse/v3-0/_merge-all-of/decompose-union.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type SchemaOrRef = OpenAPIV3.ReferenceObject | SchemaObject

export type Normalized = {
  /** The document to parse — the input itself when nothing changed. */
  document: OpenAPIV3.Document
  /** Inline `allOf`s that took part in a cycle and were given a name. */
  hoisted: string[]
  /**
   * For each component whose `oneOf`/`anyOf` lists its own subclasses: what
   * it contributes when copied in as a base — its keywords minus that list.
   * The document's copy of the component keeps only the union, so the
   * parser's union branch has nothing to push into the members and they
   * stay the references they are.
   */
  bases: Map<string, SchemaObject>
}

/**
 * Rewrite the raw document, once, so that the parser's copying never has to
 * decide anything about cycles. Three rewrites, in order:
 *
 * 1. **A union wrapper's extending keywords are distributed into its
 *    members.** `{ properties: P, oneOf: [A, B] }` means "P and one of A,
 *    B", and the parser has always produced that by copying `A` and `B` and
 *    pushing `P` in. Written out, that is `oneOf: [{ allOf: [P, A] },
 *    { allOf: [P, B] }]` — the same thing, as `allOf`, which the parser
 *    already eliminates. The rewrite does that spelling for it.
 *
 *    A component whose members already extend it (the parent-lists-its-
 *    children idiom: `Parent: { P, oneOf: [Child] }`, `Child: allOf [Parent,
 *    …]`) is the exception: its union is a list of subclasses, and the
 *    members inherit `P` through their own `allOf`. `P` is set aside as the
 *    component's BASE — what a child receives when it copies the parent in —
 *    and the document keeps only the union, so the members stay references.
 * 2. **Inline `allOf`s on a reference cycle are hoisted into
 *    `components.schemas`** under a location-derived name, so every
 *    recursion in the document goes through a `$ref` (see
 *    `hoistCyclicAllOf`).
 *
 * A document that needs neither comes back as the same object.
 */
export const normalizeComposition = (document: OpenAPIV3.Document): Normalized => {
  const subclassLists = findSubclassLists(document)
  const { document: distributed, bases } = distributeWrappers(document, subclassLists)
  const { document: hoisted, hoisted: names } = hoistCyclicAllOf(distributed)

  return { document: hoisted, hoisted: names, bases }
}

/**
 * Components whose `oneOf`/`anyOf` names a schema that extends them,
 * directly or through an intermediate level (`Grandparent` lists `Child`,
 * `Child: allOf [Parent]`, `Parent: allOf [Grandparent]`). Such a union is
 * a subclass list, not a constraint: copied in as a base, the component
 * contributes its keywords minus the list.
 */
export const findSubclassLists = (document: OpenAPIV3.Document): Set<string> => {
  const schemas = document.components?.schemas ?? {}
  const found = new Set<string>()

  const extendsName = (name: string, ancestor: string, seen: Set<string>): boolean => {
    if (name === ancestor) {
      return true
    }

    if (seen.has(name) || seen.size > 16) {
      return false
    }

    seen.add(name)

    const schema = schemas[name]

    return !isRef(schema) && baseRefs(schema).some(base => extendsName(base, ancestor, seen))
  }

  for (const [name, schema] of Object.entries(schemas)) {
    if (isRef(schema)) {
      continue
    }

    const members = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])]

    if (members.some(member => refNamesOf(member).some(ref => extendsName(ref, name, new Set())))) {
      found.add(name)
    }
  }

  return found
}

/**
 * Keywords on a union wrapper that extend its members, as opposed to
 * describing the union. `allOf` beside a union is the parser's own business
 * (its `allOf` branch runs first and merges the union in); `type` and `x-*`
 * describe the union and stay on it.
 */
const extendingKeys = (schema: SchemaObject): string[] =>
  Object.keys(schema).filter(
    key =>
      key !== 'oneOf' &&
      key !== 'anyOf' &&
      key !== 'allOf' &&
      key !== 'type' &&
      !key.startsWith('x-') &&
      !excludedProperties.includes(key)
  )

const needsDistribution = (schema: SchemaObject): boolean =>
  (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) && extendingKeys(schema).length > 0

type Distributed = {
  document: OpenAPIV3.Document
  bases: Map<string, SchemaObject>
}

const distributeWrappers = (
  document: OpenAPIV3.Document,
  subclassLists: Set<string>
): Distributed => {
  const bases = new Map<string, SchemaObject>()

  // Every subclass-list component has a base, extending keywords or not: a
  // child copying it in must never receive the list.
  for (const name of subclassLists) {
    const schema = document.components?.schemas?.[name]

    if (schema !== undefined && !isRef(schema)) {
      const { oneOf: _oneOf, anyOf: _anyOf, discriminator: _discriminator, ...base } = schema
      bases.set(name, base)
    }
  }

  if (!someNode(document, needsDistribution)) {
    return { document, bases }
  }

  const copy: OpenAPIV3.Document = structuredClone(document)

  const rewrite = (schema: SchemaObject, componentName: string | undefined): void => {
    const keys = extendingKeys(schema)
    const extension: SchemaObject = Object.fromEntries(
      keys.map(key => [key, schema[key as keyof SchemaObject]])
    )

    if (componentName !== undefined && subclassLists.has(componentName)) {
      // The subclass list stays as written; the base recorded above is what
      // the children copy, so the keywords can leave the document's copy.
    } else {
      for (const groupType of ['oneOf', 'anyOf'] as const) {
        const members = schema[groupType]

        if (Array.isArray(members)) {
          schema[groupType] = members.map(member => ({ allOf: [extension, member] }))
        }
      }
    }

    for (const key of keys) {
      delete schema[key as keyof SchemaObject]
    }
  }

  const walk = (value: unknown, componentName: string | undefined): void => {
    if (value === null || typeof value !== 'object' || isRef(value)) {
      return
    }

    if (needsDistribution(value as SchemaObject)) {
      rewrite(value as SchemaObject, componentName)
    }

    for (const child of Object.values(value)) {
      walk(child, undefined)
    }
  }

  for (const [name, schema] of Object.entries(copy.components?.schemas ?? {})) {
    if (!isRef(schema)) {
      if (needsDistribution(schema)) {
        rewrite(schema, name)
      }

      for (const child of Object.values(schema)) {
        walk(child, undefined)
      }
    }
  }

  const { components, ...rest } = copy
  walk(rest, undefined)

  for (const [key, value] of Object.entries(components ?? {})) {
    if (key !== 'schemas') {
      walk(value, undefined)
    }
  }

  return { document: copy, bases }
}

const someNode = (value: unknown, predicate: (schema: SchemaObject) => boolean): boolean => {
  if (value === null || typeof value !== 'object' || isRef(value)) {
    return false
  }

  if (predicate(value as SchemaObject)) {
    return true
  }

  return Object.values(value).some(child => someNode(child, predicate))
}

/** The component names a union member refers to: itself, or the bases of its own `allOf`. */
const refNamesOf = (member: SchemaOrRef): string[] =>
  isRef(member) ? [toRefName(member.$ref)] : baseRefs(member)

/** The components a schema's `allOf` copies in, seeing through nested single-member wrappers. */
const baseRefs = (schema: SchemaObject | undefined): string[] => {
  const allOf = Array.isArray(schema?.allOf) ? schema.allOf : []

  return allOf.flatMap(base => (isRef(base) ? [toRefName(base.$ref)] : baseRefs(base)))
}
