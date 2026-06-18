/**
 * @fileoverview Typed readers for the run-constant enrichment scopes.
 *
 * Three enrichment scopes share one storage namespace
 * (`client.json#settings.enrichments`), distinguished only by where they
 * sit and how often they vary:
 *
 *  - **subject** — `[id][subject][variant]`, resolved *per item* by the
 *    engine into `ContentSettings.subjectEnrichments`. Not read here.
 *  - **generator** — `[id]._generator`, a run-constant for one generator.
 *  - **stack** — `._stack`, a run-constant shared across every generator.
 *
 * The generator and stack scopes are run-constants — the same value for
 * every subject and variant — so the engine does not thread them through
 * the per-item `ContentSettings`/`Inserted` generic chain. Instead a
 * generator reads them on demand, from anywhere holding a context: a
 * `transform`, an `isSupported` gate, a projection constructor, or an
 * accumulator snippet.
 *
 * Both readers look up by a known reserved key and never enumerate, so a
 * generator can never trip over the reserved keys — iteration-safety is a
 * core / migration concern, not a generator one.
 *
 * @module readEnrichments
 */

import * as v from 'valibot'
import type { ClientSettings } from '@/types/Settings.ts'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'

/**
 * Minimal structural view of the read context. Any `GenerateContext`
 * satisfies it; kept structural so the readers stay decoupled from the
 * full context type and are trivially testable.
 */
type EnrichmentReadContext = {
  settings: ClientSettings | undefined
}

/**
 * Read this generator's **generator-scoped** enrichment — the
 * run-constant leaf at
 * `client.json#settings.enrichments[generatorId]._generator`, validated
 * through the generator's own schema (typically declared as
 * `toGeneratorEnrichmentSchema` on its entry, and reused here).
 *
 * The return type is inferred from `schema`, so the read is fully typed
 * with no cast. Whether the block is required or optional is the
 * schema's decision: a generator that needs config passes a required
 * `v.object({...})` (a missing block then throws); one with all-optional
 * config passes `v.optional(v.object({...}))`.
 *
 * @throws on a malformed block. The generator's item is then recorded as
 *   `error` and the run continues (fail-open), exactly like a bad subject
 *   leaf.
 */
export const toGeneratorEnrichment = <EnrichmentType>(
  context: EnrichmentReadContext,
  generatorId: string,
  schema: v.GenericSchema<EnrichmentType>
): EnrichmentType =>
  v.parse(schema, context.settings?.enrichments?.[generatorId]?.[GENERATOR_ENRICHMENT_KEY])

/**
 * Read the **stack-scoped** enrichment — the run-constant leaf at
 * `client.json#settings.enrichments._stack`, validated through the
 * caller's schema.
 *
 * The stack leaf is a single bag shared by every generator in the
 * composition; it has no single owner. Each consuming generator passes a
 * **partial** schema describing only the fields it reads — Valibot's
 * `v.object` ignores unknown keys, so fields other generators consume
 * don't interfere. The return type is inferred from `schema`.
 *
 * @throws on a malformed block (fail-open, as above).
 */
export const toStackEnrichment = <EnrichmentType>(
  context: EnrichmentReadContext,
  schema: v.GenericSchema<EnrichmentType>
): EnrichmentType => v.parse(schema, context.settings?.enrichments?.[STACK_ENRICHMENT_KEY])
