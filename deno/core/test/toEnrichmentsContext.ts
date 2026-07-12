import type { EnrichmentWarning } from '@/enrichments/EnrichmentWarning.ts'

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null

/**
 * The enrichment read/report seam for hand-built context doubles.
 *
 * `readEnrichment` resolves segments against `toSettings().enrichments`
 * lazily, so tests that assign `context.settings` after construction (a
 * common pattern in the Driver suites) still read the fresh value.
 * Reported warnings are captured on `warnings` for assertions.
 *
 * Spread the result into a mock context:
 *
 * ```ts
 * const mockContext = {
 *   register: registerSpy,
 *   ...toEnrichmentReaders(() => (mockContext as { settings?: unknown }).settings)
 * } as unknown as GenerateContextType
 * ```
 */
export const toEnrichmentReaders = (toSettings: () => unknown) => {
  const warnings: EnrichmentWarning[] = []

  return {
    warnings,
    readEnrichment: (segments: readonly string[]): unknown => {
      const settings = toSettings()
      return segments.reduce<unknown>(
        (node, key) => (isRecord(node) ? node[key] : undefined),
        isRecord(settings) ? settings.enrichments : undefined
      )
    },
    reportEnrichmentWarning: (warning: EnrichmentWarning): void => {
      warnings.push(warning)
    }
  }
}

/**
 * Minimal context double for exercising projection statics
 * (`toEnrichments`) in isolation: `settings` plus the enrichment
 * read/report seam from {@link toEnrichmentReaders}. Cast to
 * `GenerateContextType` at the call site (tests only).
 */
export const toEnrichmentsContext = (settings?: unknown) => ({
  settings,
  ...toEnrichmentReaders(() => settings)
})
