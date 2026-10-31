const escapes: Record<string, string> = { '%': '%25', ':': '%3A' }

/** Joins trail frames with `:`, escaping `%` as `%25` and `:` as `%3A` inside a frame. */
export const toTrailString = (frames: string[]): string =>
  frames.map(frame => frame.replace(/[%:]/g, character => escapes[character])).join(':')

/**
 * The frames of a trail that address the input document: everything after
 * the first phase frame, or every frame when there is no phase frame.
 */
export const toDocumentFrames = (frames: string[]): string[] => {
  // Phase frames seeded by `CoreContext.toArtifacts` (PhaseType plus the
  // `post-pass` trace). The operational phase always sits before any
  // document key, so the FIRST match is the boundary — a document key
  // that happens to share a phase name (e.g. a schema literally named
  // `parse`) appears later and is unaffected.
  const phaseFrames = new Set(['parse', 'generate', 'render', 'post-pass'])
  const phaseIndex = frames.findIndex(frame => phaseFrames.has(frame))

  return phaseIndex === -1 ? frames : frames.slice(phaseIndex + 1)
}

/**
 * The document-relative trail in `StackTrail.toString` form.
 *
 * @example
 * ```typescript
 * toDocumentString(['trace-1', 'span-1', 'parse', 'paths', '/pets', 'parameters', '0'])
 * // 'paths:/pets:parameters:0'
 * ```
 */
export const toDocumentString = (frames: string[]): string =>
  toTrailString(toDocumentFrames(frames))
