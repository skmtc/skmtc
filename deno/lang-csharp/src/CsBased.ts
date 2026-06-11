import type { Stringable } from '@skmtc/core'

/**
 * The protocol by which a Definition's VALUE supplies a base-type clause
 * to {@link import('./CsDefinition.ts').CsDefinition} — the ` : Animal`
 * after a record's name (the `KtSupertyped` analog).
 *
 * DECLARED at CS-A, RENDERED at CS-B: the clause appears on the members
 * of a polymorphic `oneOf` parent (`public sealed partial record Dog :
 * Animal { … }`), which arrive with the `abstract-record` kind. Grammar
 * only — the lang renders ` : A, B`; WHICH base types (polymorphic
 * membership, say) is generator policy. Entries are {@link Stringable}
 * so identifiers and snippets compose; they render as bare names —
 * same-namespace references need no using, and cross-namespace base
 * types are the caller's using to register.
 */
export type CsBased = {
  baseTypes: Stringable[]
}

const isStringable = (item: unknown): item is Stringable => {
  if (typeof item === 'string') {
    return true
  }

  return typeof item === 'object' && item !== null && typeof item.toString === 'function'
}

/**
 * Type guard for the {@link CsBased} protocol — narrows without casts.
 */
export const isCsBased = (value: unknown): value is CsBased => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('baseTypes' in value)) {
    return false
  }

  return Array.isArray(value.baseTypes) && value.baseTypes.every(isStringable)
}
