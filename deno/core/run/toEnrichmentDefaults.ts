import { CoreContext } from '../context/CoreContext.ts'
import type { ClientSettings } from '../types/Settings.ts'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { StackTrail } from '../context/StackTrail.ts'
import type { SkmtcDocumentInput } from '../types/SkmtcDocument.ts'
import type { EnrichmentDefaults } from '../types/EnrichmentDefaults.ts'
import type { ParseIssue } from '../context/ParseIssue.ts'

/**
 * Arguments for {@link toEnrichmentDefaults}. The seed-values counterpart of
 * `SupportedSubjectsArgs` — same parse-then-capability shape, no attribution.
 */
type EnrichmentDefaultsArgs = {
  /** Unique identifier for the trace */
  traceId: string
  /** Unique identifier for this span */
  spanId: string
  /**
   * Source document. OAS variant carries the OpenAPI v3 JSON; GQL variant
   * carries the SDL string. Protocol-specific parsing runs inside the pipeline.
   */
  document: SkmtcDocumentInput
  /** Client settings (only `include` / `skip` affect which generators run). */
  settings: ClientSettings | undefined
  /** Stack trail for distributed tracing */
  stackTrail: StackTrail
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Whether to suppress console output */
  silent: boolean
  /** Optional path for writing log files */
  logsPath?: string
}

/**
 * Compute the seed enrichment values each configured generator derives from a
 * document — the "Generate fields from schema" payload the CMS persists and the
 * user then edits.
 *
 * Runs Parse + a values pass: every generator that advertises
 * `toEnrichmentDefaults` is called over the subjects it supports, with no
 * transform and no render. The result mirrors the
 * `client.json#settings.enrichments` subtree (subject scope only) so a host can
 * fold it straight into settings.
 *
 * Like {@link toSupportedSubjects} it fails open: a bad schema surfaces as a
 * `parseIssue`, not a throw, and the defaults map is returned empty.
 */
export const toEnrichmentDefaults = ({
  spanId,
  document,
  settings,
  toGeneratorConfigMap,
  stackTrail,
  silent,
  logsPath
}: EnrichmentDefaultsArgs): {
  enrichmentDefaults: EnrichmentDefaults
  parseIssues: ParseIssue[]
} => {
  const context = new CoreContext({ spanId, logsPath, silent })

  return context.toEnrichmentDefaults({
    document,
    settings,
    toGeneratorConfigMap,
    stackTrail
  })
}
