/**
 * @fileoverview The enrichment-warning surface — the manifest's record of
 * enrichment config that did not do what the consumer intended.
 *
 * Three validation layers precede this one: structural validation at CLI
 * load (`generatorEnrichments`), the per-leaf Valibot parse at generate
 * time (a wrongly-typed value in a reached leaf throws), and the
 * missing-`'main'` variant throw (`toVariantList`). All three are loud.
 * What they cannot see is *addressing*: a typo'd generator id, path,
 * method, or model name makes `get()` miss silently — defaults apply and
 * the config entry is dead. Unknown leaf keys are equally silent:
 * `v.object` strips them before the generator sees them.
 *
 * `EnrichmentWarning` is the shared shape for both detectors:
 *
 *  - the **consumption audit** (`EnrichmentAudit`) — records every
 *    enrichment lookup the engine performs during the generate walk and,
 *    post-walk, flags configured entries no lookup ever touched;
 *  - **unknown-key detection** (`findUnknownKeys`, run inside
 *    `parseEnrichmentUmbrella`) — flags leaf keys the generator's schema
 *    does not declare.
 *
 * Both are warn-level and fail-open: generation output is never affected.
 * The warnings ride the manifest (`manifest.enrichmentWarnings`) so
 * post-run diagnostics can re-read them without re-running.
 *
 * @module EnrichmentWarning
 */

import * as v from 'valibot'

/**
 * Discriminates what went wrong with an enrichment entry:
 *
 *  - `UNCONSUMED_ENRICHMENT` — a configured routing path no engine lookup
 *    consumed (typo'd path / method / model name, or an entry orphaned by
 *    spec evolution). Warning.
 *  - `UNKNOWN_GENERATOR_ID` — a top-level enrichment key that matches no
 *    generator in the run (and no insert-only peer consumed it). Warning.
 *  - `UNKNOWN_ENRICHMENT_KEY` — a leaf key the generator's enrichment
 *    schema does not declare; Valibot strips it silently. Warning.
 *  - `SKIPPED_SUBJECT_ENRICHMENT` — the entry is addressed correctly but
 *    its subject was excluded by `skip`/`include`. Info: temporary skips
 *    are legitimate, so this is not treated as dead config.
 *  - `SKIPPED_GENERATOR_ENRICHMENT` — the whole generator is skipped
 *    (string entry in `settings.skip`) while enrichments for it exist.
 *    Info, for the same reason.
 */
export type EnrichmentWarningType =
  | 'UNCONSUMED_ENRICHMENT'
  | 'UNKNOWN_GENERATOR_ID'
  | 'UNKNOWN_ENRICHMENT_KEY'
  | 'SKIPPED_SUBJECT_ENRICHMENT'
  | 'SKIPPED_GENERATOR_ENRICHMENT'

export const enrichmentWarningType: v.GenericSchema<EnrichmentWarningType> = v.picklist([
  'UNCONSUMED_ENRICHMENT',
  'UNKNOWN_GENERATOR_ID',
  'UNKNOWN_ENRICHMENT_KEY',
  'SKIPPED_SUBJECT_ENRICHMENT',
  'SKIPPED_GENERATOR_ENRICHMENT'
])

/**
 * One enrichment-config warning. `path` is the routing key sequence under
 * `client.json#settings.enrichments` locating the offending entry —
 * `[generatorId, ...subjectSegments]` for addressing warnings, extended
 * down to the leaf key for `UNKNOWN_ENRICHMENT_KEY`. `suggestion` carries
 * the nearest known key when a close match exists (`submitLabl` →
 * `submitLabel`); the human-readable `message` already folds it in.
 */
export type EnrichmentWarning = {
  level: 'warning' | 'info'
  type: EnrichmentWarningType
  path: string[]
  message: string
  suggestion?: string
}

export const enrichmentWarning: v.GenericSchema<EnrichmentWarning> = v.object({
  level: v.picklist(['warning', 'info']),
  type: enrichmentWarningType,
  path: v.array(v.string()),
  message: v.string(),
  suggestion: v.optional(v.string())
})

/**
 * Render a routing path for warning messages:
 * `['@skmtc/gen-shadcn-form', '/pets', 'post']` →
 * `'@skmtc/gen-shadcn-form → /pets → post'`. The arrow separator keeps
 * segments visually distinct even when they contain dots or slashes.
 */
export const formatEnrichmentPath = (path: readonly string[]): string => path.join(' → ')
