/**
 * @fileoverview Post-render span resolution.
 *
 * Walks the producer tree captured by `SnippetBase` instrumentation
 * (Phase B §3.1) and produces a flat list of byte-range spans for
 * every Snippet/Definition that contributed to the rendered File.
 *
 * The mechanism is intentionally simple: each parent's children are
 * located inside the parent's `_rendered` text via `indexOf` from a
 * moving cursor, then their byte offsets are translated up to the
 * outer File's text. This handles identical sibling text in
 * document order, recovers gracefully when a child's text isn't
 * found (e.g., parent re-formatted it), and filters zero-length
 * spans.
 *
 * Requires the File's Definitions to have been rendered (which always
 * populates each Snippet's `_rendered` cache, since attribution
 * instrumentation is always on).
 */

import type { File } from '@/dsl/File.ts'
import type { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { Span } from './types.ts'

/**
 * Walk a rendered File and compute byte spans for each contributing
 * Snippet/Definition. Returns spans in document order (Definitions
 * first, then their inner Snippets depth-first).
 *
 * Pure function — `file.toString()` is called once to anchor offsets,
 * and the producer tree's cached `_rendered` strings are read.
 */
export const resolveSpansForFile = (file: File): Span[] => {
  const fileText = file.toString()
  const spans: Span[] = []
  let cursor = 0

  for (const def of file.definitions.values()) {
    const defText = def._rendered ?? def.toString()
    if (defText.length === 0) continue

    const idx = fileText.indexOf(defText, cursor)
    if (idx < 0) {
      // Definition text not found in the file output — likely the
      // File-level join inserted whitespace or the definition was
      // re-rendered between caching and now. Skip rather than
      // mis-attribute.
      continue
    }

    spans.push({ from: idx, to: idx + defText.length, producer: def })
    walkChildren(def, idx, defText, spans)
    cursor = idx + defText.length
  }

  return spans
}

/**
 * Recurse through a producer's `_children` (populated by the
 * SnippetBase instrumentation), locating each child's `_rendered`
 * substring inside the parent's text and emitting a span.
 *
 * Uses a moving `cursor` so two children that happen to produce
 * identical text (e.g. two `z.string()` calls) get attributed to
 * their respective positions in document order.
 */
const walkChildren = (
  parent: SnippetBase,
  parentStart: number,
  parentText: string,
  out: Span[]
): void => {
  const children = parent._children
  if (!children?.length) return

  let cursor = 0
  for (const child of children) {
    const childText = child._rendered
    if (childText === undefined || childText.length === 0) {
      // Empty children produce no addressable region; skipping keeps
      // the cursor advancing only across visible output.
      continue
    }

    const idx = parentText.indexOf(childText, cursor)
    if (idx < 0) {
      // Child text isn't present in the parent's output — the parent
      // reshaped it (indentation, escaping, etc.). Drop this span
      // rather than report a wrong offset.
      continue
    }

    const from = parentStart + idx
    out.push({ from, to: from + childText.length, producer: child })
    walkChildren(child, from, childText, out)
    cursor = idx + childText.length
  }
}
