import { formatContent } from '@/lib/formatter.ts'

/**
 * An ejected file's state relative to what the generator would produce
 * right now — a live, two-way comparison, computed fresh wherever it's
 * needed (by `generate`, which already has this run's render in
 * memory, and by `status`, which resolves its own fresh render via
 * `resolveFreshArtifacts`). Nothing is persisted between runs: ejected
 * is binary (owned vs. generated), so there's no drift history to
 * track or acknowledge — only "does it currently match."
 */
export type EjectionFileState = {
  /**
   * - `re-adoptable` — disk matches current generated output (edit
   *   reverted, or the generator caught up): suggest `skmtc adopt`.
   * - `owned`        — disk differs from current generated output.
   *   Expected and unremarkable — the file is the user's by design.
   * - `stale`        — no generator produces this path anymore (the
   *   schema item was removed or renamed).
   */
  state: 're-adoptable' | 'owned' | 'stale'
}

/**
 * Classifies one ejected file. `pristine` is this run's fresh render
 * for the owned artifact path, when the engine produced one —
 * `undefined` means nothing renders it (stale).
 */
export const classifyEjectedFile = ({
  pristine,
  diskContent,
  formatterCommand,
  absolutePath,
  appRoot
}: {
  pristine: string | undefined
  diskContent: string | undefined
  formatterCommand: string | undefined
  absolutePath: string
  appRoot: string
}): EjectionFileState => {
  if (pristine === undefined) {
    return { state: 'stale' }
  }

  const matchesGenerated =
    diskContent !== undefined &&
    (formatterCommand
      ? formatContent({
          command: formatterCommand,
          absolutePath,
          content: pristine,
          cwd: appRoot
        }) === diskContent
      : pristine === diskContent)

  return { state: matchesGenerated ? 're-adoptable' : 'owned' }
}
