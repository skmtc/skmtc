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

export const modelEnrichments: v.GenericSchema<ModelEnrichments> = v.record(v.string(), v.unknown())

/**
 * OAS operation enrichments: HTTP method (`get`, `post`, ...) → leaf payload.
 * One entry per operation defined at a path; the leaf is opaque to core.
 */
export type OasOperationEnrichments = Record<string, EnrichmentLeaf>

export const oasOperationEnrichments: v.GenericSchema<OasOperationEnrichments> = v.record(
  v.string(),
  v.unknown()
)

/**
 * OAS webhook enrichments: HTTP method (`get`, `post`, ...) → leaf payload.
 * Structurally identical to {@link OasOperationEnrichments} — an OpenAPI 3.1
 * webhook is a path-item keyed by method, the same shape as an operation — but
 * named distinctly so a webhook generator's slot reads as webhook-scoped (the
 * `webhook` subject kind) rather than operation-scoped. The leaf is opaque to
 * core.
 */
export type OasWebhookEnrichments = Record<string, EnrichmentLeaf>

export const oasWebhookEnrichments: v.GenericSchema<OasWebhookEnrichments> = v.record(
  v.string(),
  v.unknown()
)

/**
 * OAS path enrichments: path template → operation enrichments.
 */
export type OasPathEnrichments = Record<string, OasOperationEnrichments>

export const oasPathEnrichments: v.GenericSchema<OasPathEnrichments> = v.record(
  v.string(),
  oasOperationEnrichments
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
 * Reserved enrichment key for the **stack** scope. Lives at the top
 * level of the enrichments record (a sibling of the generator-id keys);
 * its value is a single leaf shared across every generator in the
 * composition. Read via `toStackEnrichment(context, schema)`.
 */
export const STACK_ENRICHMENT_KEY = '_stack'

/**
 * Reserved enrichment key for the **generator** scope. Lives inside a
 * generator's slot (a sibling of the subject keys); its value is a
 * run-constant leaf for that one generator. Read via
 * `toGeneratorEnrichment(context, id, schema)`.
 */
export const GENERATOR_ENRICHMENT_KEY = '_generator'

/**
 * Whether an enrichment key is **engine-reserved** rather than
 * customer-defined. Every reserved key is `_`-prefixed; customer keys
 * (generator ids, subject names) must not be. This single predicate is
 * the source of truth for every iteration site that must skip reserved
 * keys — generators never iterate enrichments themselves (they read by
 * known key through the typed helpers), so the segregation is a core /
 * migration concern only.
 */
export const isReservedEnrichmentKey = (key: string): boolean => key.startsWith('_')

/**
 * Top-level enrichments: generator id → hierarchy, plus the reserved
 * `_stack` key (stack-scoped leaf). Each generator's slot is one of
 * three structurally-distinct hierarchies depending on the generator's
 * entry kind:
 *  - `ModelEnrichments` for `toModelEntry`
 *  - `OasPathEnrichments` for `toOasOperationEntry`
 *  - `GqlRootKindEnrichments` for `toGqlOperationEntry`
 *
 * Each slot may additionally carry the reserved `_generator` key
 * (generator-scoped leaf) alongside its subject keys. The dispatcher
 * knows which hierarchy applies from the generator's declared entry
 * type; the union is the wire format.
 *
 * **Reserved-key rule** (enforced by {@link generatorEnrichments}):
 * customer keys — generator ids at the top level, subject names inside a
 * slot — must not start with `_`. The only reserved keys are
 * {@link STACK_ENRICHMENT_KEY} (top level) and
 * {@link GENERATOR_ENRICHMENT_KEY} (per-generator slot).
 */
export type GeneratorEnrichments = Record<
  string,
  ModelEnrichments | OasPathEnrichments | GqlRootKindEnrichments
>

export const generatorEnrichments: v.GenericSchema<GeneratorEnrichments> = v.pipe(
  v.record(v.string(), v.union([modelEnrichments, oasPathEnrichments, gqlRootKindEnrichments])),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return

    for (const [topKey, slot] of Object.entries(dataset.value)) {
      if (isReservedEnrichmentKey(topKey)) {
        if (topKey !== STACK_ENRICHMENT_KEY) {
          addIssue({
            message:
              `Enrichment key '${topKey}' starts with '_' but is not a recognised reserved key. ` +
              `The only reserved top-level key is '${STACK_ENRICHMENT_KEY}' (stack enrichment); ` +
              `generator ids must not start with '_'.`
          })
        }
        // `_stack`'s value is a leaf — nothing to validate inside it.
        continue
      }

      if (typeof slot !== 'object' || slot === null) continue

      for (const slotKey of Object.keys(slot)) {
        if (isReservedEnrichmentKey(slotKey) && slotKey !== GENERATOR_ENRICHMENT_KEY) {
          addIssue({
            message:
              `Enrichment key '${slotKey}' under generator '${topKey}' starts with '_' but is not ` +
              `a recognised reserved key. The only reserved per-generator key is ` +
              `'${GENERATOR_ENRICHMENT_KEY}' (generator enrichment); subject keys must not start with '_'.`
          })
        }
      }
    }
  })
)

/**
 * The structural CONSTRAINT a generator's enrichment umbrella type must
 * satisfy: the three scopes, each optional and opaque to core. Used to
 * constrain the projection chain's single `EnrichmentType` generic
 * (`EnrichmentType extends EnrichmentScopes`) wherever a member scope is
 * indexed (`EnrichmentType['subject']`). `ContentSettings` / `Inserted` stay
 * unconstrained — they only carry the umbrella, never index it.
 */
export type EnrichmentScopes = {
  subject?: unknown
  generator?: unknown
  stack?: unknown
}

/**
 * The `{ subject, generator, stack }` umbrella carried on
 * `ContentSettings.enrichments`. Each member is the generator-owned leaf for
 * that scope at a different key-depth in `client.json#settings.enrichments`:
 *
 *  - **subject** — `[id][subject][variant]`, resolved per item (the original
 *    per-subject enrichment).
 *  - **generator** — `[id]._generator`, a run-constant for one generator.
 *  - **stack** — `._stack`, a run-constant shared across every generator.
 *
 * A member is `undefined` when the generator declares nothing for that scope.
 * Assembled by `static toEnrichments` (raw from the three storage spots, then
 * parsed through the generator's composite `toEnrichmentSchema`). The single
 * `EnrichmentType` generic on the projection chain now *means* this umbrella —
 * no new type parameters; the chain stays single-param.
 */
export type Enrichments<Subject = undefined, Generator = undefined, Stack = undefined> = {
  subject: Subject
  generator: Generator
  stack: Stack
}

/**
 * The composite enrichment schema a generator with NO enrichments at any scope
 * declares (`toEnrichmentSchema: () => emptyEnrichmentSchema`). Every member is
 * `v.undefined()` — strict: a no-enrichment generator that somehow receives a
 * value fails loud (fail-open at the call site) rather than silently swallowing
 * it.
 */
export const emptyEnrichmentSchema: v.GenericSchema<Enrichments<undefined, undefined, undefined>> =
  v.object({
    subject: v.undefined(),
    generator: v.undefined(),
    stack: v.undefined()
  })

export type EmptyEnrichments = v.InferOutput<typeof emptyEnrichmentSchema>
