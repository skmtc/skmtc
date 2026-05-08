/**
 * @fileoverview Enrichment hierarchy for SKMTC Core.
 *
 * Core owns only the lookup *hierarchy* — the keys that locate an
 * enrichment payload for a generator + operation/model:
 *
 *   - **Models** are keyed by name (component schema name in OAS;
 *     registry-named type in GraphQL).
 *   - **OAS operations** are keyed by HTTP path → method.
 *   - **GraphQL operations** are keyed by root kind → field name.
 *
 * The leaf at the bottom of each hierarchy is opaque to core — its
 * shape is owned by the generator that consumes it. Each generator
 * declares its own enrichment schema via the `toEnrichmentSchema`
 * configuration on its entry factory; the dispatcher parses the
 * generator's slice of the enrichments record through that schema
 * before handing typed enrichments to `transform`.
 *
 * This means **no leaf shapes live in core**. A generator adding a
 * new enrichment field is a purely local change — no coordinated
 * core update, no canonical schema to extend. Two generators with
 * different needs at the same operation can declare different leaf
 * shapes and they don't collide.
 *
 * @example A generator declaring its own leaf shape
 * ```ts
 * // gen-myform/src/enrichments.ts
 * import * as v from 'valibot'
 *
 * const enrichmentSchema = v.optional(v.object({
 *   title: v.optional(v.string()),
 *   submitLabel: v.optional(v.string()),
 *   fields: v.optional(v.array(v.object({
 *     id: v.string(),
 *     label: v.optional(v.string())
 *   })))
 * }))
 *
 * export type EnrichmentSchema = v.InferOutput<typeof enrichmentSchema>
 * export const toEnrichmentSchema = () => enrichmentSchema
 * ```
 *
 * @module Enrichments
 */

import * as v from 'valibot'

/**
 * Generator-owned enrichment payload at a hierarchy leaf. Core treats
 * it as opaque; the consuming generator parses it through its own
 * `toEnrichmentSchema()`.
 */
export type EnrichmentLeaf = unknown

/**
 * Model enrichments: schema name → leaf payload.
 *
 * Used by `toModelEntry`-shaped generators (TS types, Zod validators,
 * mappers, etc.).
 */
export type ModelEnrichments = Record<string, EnrichmentLeaf>

export const modelEnrichments: v.GenericSchema<ModelEnrichments> = v.record(
  v.string(),
  v.unknown()
)

/**
 * OAS method enrichments: HTTP method (`get`, `post`, ...) → leaf payload.
 */
export type OasMethodEnrichments = Record<string, EnrichmentLeaf>

export const oasMethodEnrichments: v.GenericSchema<OasMethodEnrichments> = v.record(
  v.string(),
  v.unknown()
)

/**
 * OAS path enrichments: path template → method enrichments.
 */
export type OasPathEnrichments = Record<string, OasMethodEnrichments>

export const oasPathEnrichments: v.GenericSchema<OasPathEnrichments> = v.record(
  v.string(),
  oasMethodEnrichments
)

/**
 * GraphQL field enrichments: root field name → leaf payload.
 */
export type GqlFieldEnrichments = Record<string, EnrichmentLeaf>

export const gqlFieldEnrichments: v.GenericSchema<GqlFieldEnrichments> = v.record(
  v.string(),
  v.unknown()
)

/**
 * GraphQL root-kind enrichments: `query` / `mutation` / `subscription`
 * → field enrichments.
 */
export type GqlRootKindEnrichments = Record<string, GqlFieldEnrichments>

export const gqlRootKindEnrichments: v.GenericSchema<GqlRootKindEnrichments> = v.record(
  v.string(),
  gqlFieldEnrichments
)

/**
 * Top-level enrichments: generator id → hierarchy.
 *
 * Each generator's value is one of three structurally-distinct
 * hierarchies depending on the generator's entry kind:
 *  - `ModelEnrichments` for `toModelEntry`
 *  - `OasPathEnrichments` for `toOasOperationEntry`
 *  - `GqlRootKindEnrichments` for `toGqlOperationEntry`
 *
 * The dispatcher knows which shape applies based on the generator's
 * declared entry type; the union is the wire format.
 */
export type GeneratorEnrichments = Record<
  string,
  ModelEnrichments | OasPathEnrichments | GqlRootKindEnrichments
>

export const generatorEnrichments: v.GenericSchema<GeneratorEnrichments> = v.record(
  v.string(),
  v.union([modelEnrichments, oasPathEnrichments, gqlRootKindEnrichments])
)
