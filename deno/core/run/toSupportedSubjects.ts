import { CoreContext } from '../context/CoreContext.ts'
import type { ClientSettings } from '../types/Settings.ts'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { StackTrail } from '../context/StackTrail.ts'
import type { SkmtcDocumentInput } from '../types/SkmtcDocument.ts'
import type { SupportedSubjects } from '../types/SupportedSubjects.ts'
import type { ParseIssue } from '../context/ParseIssue.ts'

/**
 * Arguments for {@link toSupportedSubjects}. The capability-only counterpart of
 * `TransformArgs` — no attribution, since nothing is rendered.
 */
type SupportedSubjectsArgs = {
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
 * Report the subjects each configured generator supports for a document.
 *
 * Runs only Parse + a capability pass — every generator's `isSupported` is
 * evaluated over the document's operations / models, with no transform and no
 * render. Use this to drive a UI that needs to know, ahead of a run, which
 * operations / models each generator would process.
 *
 * Like {@link toArtifacts} it fails open: a bad schema surfaces as a
 * `parseIssue`, not a throw, and the supported map is returned empty.
 */
export const toSupportedSubjects = ({
  spanId,
  document,
  settings,
  toGeneratorConfigMap,
  stackTrail,
  silent,
  logsPath
}: SupportedSubjectsArgs): { subjects: SupportedSubjects; parseIssues: ParseIssue[] } => {
  const context = new CoreContext({ spanId, logsPath, silent })

  return context.toSupportedSubjects({
    document,
    settings,
    toGeneratorConfigMap,
    stackTrail
  })
}
