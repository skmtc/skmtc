/**
 * @fileoverview Operation Variant axis for SKMTC Core
 *
 * A **variant** is a named axis below `[path][method]` (OAS) or
 * `[rootKind][fieldName]` (GraphQL) inside
 * `client.json#settings.enrichments`. It lets a single operation produce
 * N Definitions instead of one — e.g. a single broad `PATCH` endpoint
 * driving several section-edit forms, each scoped to a subset of fields.
 *
 * The engine reads variant names off `Object.keys` of the per-operation
 * enrichment block. The variant name `'main'` is the canonical default
 * and is guaranteed to be present:
 *
 * - When a consumer's `client.json` writes no enrichments at all for a
 *   `(generatorId, path, method)`, the engine still dispatches once with
 *   `variant: 'main'` and `enrichments: undefined`.
 * - When a consumer's `client.json` writes any variants for a
 *   `(generatorId, path, method)`, `'main'` must be among them — Valibot
 *   rejects at parse time, and the engine also throws at runtime.
 *
 * Variant names are lowercase kebab-case at the convention level
 * (`'main'`, `'customer'`, `'line-items'`). Runtime comparisons are
 * case-sensitive. The regex below is the source of truth for what
 * Valibot accepts.
 *
 * @module Variant
 */

/**
 * The canonical default variant name. Every operation that any
 * variants-aware generator processes is guaranteed to have a `'main'`
 * variant — the engine fills it in when no enrichments exist, and the
 * Valibot wrapping at the per-(path, method) level enforces its
 * presence when other variants are declared.
 *
 * Use the literal string `'main'` in generator code; this constant
 * exists primarily for the engine boundary and for documentation
 * cross-references.
 */
export const DEFAULT_VARIANT = 'main' as const

/**
 * A named variant of an operation. Lowercase kebab-case at the
 * convention level; case-sensitive at runtime.
 *
 * Branded later if useful — kept as a plain string alias today so that
 * literal-typed callers (`variant: 'main'`) interoperate cleanly with
 * dynamic enumeration (`Object.keys(opEnrichments)`).
 */
export type Variant = string

/**
 * Regex describing the conventional shape of a variant name.
 *
 * Allows: lowercase ASCII letter or digit segments joined by single
 * hyphens, starting with a lowercase letter. Examples that match:
 * `main`, `customer`, `line-items`, `customer-data-v2`.
 *
 * Rejects: uppercase (`Customer`), leading/trailing hyphen (`-foo`,
 * `foo-`), double hyphens (`line--items`), other separators (`foo_bar`).
 *
 * The uppercase ban is what defuses the only realistic collision in
 * `withVariant`: if both `lineItems` and `line-items` were permitted,
 * both would suffix to `LineItems`. Banning uppercase keeps the
 * kebab → PascalCase transform invertible.
 */
export const variantNameRegex: RegExp = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
