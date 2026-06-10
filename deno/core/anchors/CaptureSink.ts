/**
 * @fileoverview Render-phase attribution capture.
 *
 * The capture mechanism for gen-maps. A {@link CaptureSink} is owned by
 * {@link import('@/context/RenderContext.ts').RenderContext} for the
 * duration of the single render pass and published to snippets through the
 * shared {@link CaptureChannel}: every `SnippetBase` instance self-wraps
 * its `toString` at construction (own-property wrapper), and the wrapper
 * observes into the channel's sink while the **capture interval** is open
 * — the span while `channel.sink` is set. Each `toString` invocation is
 * observed into an **occurrence tree** — one node per call, keyed by
 * invocation, not by instance. The wrapper is a pure pass-through: it
 * returns the subclass `toString`'s output verbatim and only *observes*
 * it.
 *
 * This replaces the old module-global constructor registry +
 * render-time prototype wrapping: discovery is per-instance (self-wrap at
 * birth — snippets constructed mid-render are captured too), the sink
 * travels by object reference through `this.context` (no duplicate-module
 * silent-failure hazard), and opening/closing the interval is a flag flip
 * (no install/restore pass). Outside the interval there is no state, so a
 * stray `toString()` during the generate phase captures nothing.
 *
 * Offset capture (this is the "store output, locate via `indexOf`" cut —
 * RESUME §3.3 option (a)): each node stores its rendered output; after a
 * file renders, {@link CaptureSink.spansForFile} locates each node's output
 * inside its parent's output (moving cursor) to recover byte ranges. A
 * later memory-efficient cut computes offsets inline as the stack unwinds
 * and frees the strings; the resolver interface ({offset,length,children})
 * is unchanged by that switch.
 *
 * Offsets are UTF-16 code-unit indices (`indexOf` / `String.length`),
 * consistent with the rest of the attribution layer.
 */

import type { SnippetBase } from '@/dsl/SnippetBase.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import type { Span } from './types.ts'

/**
 * The shared slot through which the capture sink travels — created once
 * per run by `CoreContext`, handed to `GenerateContext` (snippets read it
 * via `this.context.captureSink`) and to `RenderContext` (which sets
 * `channel.sink` around the one capturing render and clears it in
 * `finally`). The capture interval is exactly the span while `sink` is
 * set.
 */
export type CaptureChannel = { sink: CaptureSink | undefined }

/**
 * One `toString` invocation captured during the render pass. Keyed by
 * occurrence (not by instance), so a snippet rendered in N places yields N
 * nodes → N spans.
 */
type Occurrence = {
  /** The producing Snippet / Definition (read by `attribute()` post-render). */
  producer: SnippetBase
  /** This node's rendered output (its `toString` return). */
  output: string
  /** Nested occurrences, in render order. */
  children: Occurrence[]
}

/**
 * Transient capture state for one render pass. Owned by `RenderContext`.
 *
 * `active` gates {@link observe}: only while a file is rendering (inside
 * {@link captureFile}) does an observation record; otherwise `observe` is
 * an inert pass-through. This keeps a stray `toString()` between files
 * from polluting the tree even while the capture interval is open.
 */
export class CaptureSink {
  /** Live stack of occurrences currently rendering (innermost last). */
  #stack: Occurrence[] = []
  /** Roots for the file currently rendering; `null` when no file is active. */
  #fileRoots: Occurrence[] | null = null
  /** Whether a file render is in progress (wrapper observes only then). */
  #active = false

  /** True while a file is rendering — {@link observe} checks this. */
  get active(): boolean {
    return this.#active
  }

  /**
   * Render one file with capture active and return its text plus the byte
   * spans for every contributing Definition / Snippet. The wrapper builds
   * the occurrence tree as `render()` runs; spans are resolved from that
   * tree against the returned file text.
   */
  captureFile(render: () => string): { text: string; spans: Span[] } {
    const roots: Occurrence[] = []
    const previousRoots = this.#fileRoots
    const previousActive = this.#active
    const baseDepth = this.#stack.length
    this.#fileRoots = roots
    this.#active = true
    try {
      const text = render()
      return { text, spans: spansFromRoots(text, roots) }
    } finally {
      this.#fileRoots = previousRoots
      this.#active = previousActive
      // Defensive rebalance: a thrown subclass `toString` unwinds via the
      // per-call `finally` below, but guard against any leak.
      this.#stack.length = baseDepth
    }
  }

  /**
   * Observe one `toString` invocation. The per-instance wrapper installed
   * by the `SnippetBase` constructor calls this whenever the capture
   * interval is open. Outside a file render (`active` false) it is a pure
   * pass-through; inside one it pushes an occurrence node, links it to its
   * parent (or the file roots), runs the real `toString`, records the
   * output, and returns it verbatim.
   *
   * @throws when `producer` is already live on the stack — a snippet that
   *   composes itself, which would otherwise infinitely recurse.
   */
  observe(producer: SnippetBase, impl: (this: SnippetBase) => string): string {
    if (!this.#active) {
      return impl.call(producer)
    }

    for (const node of this.#stack) {
      if (node.producer === producer) {
        throw new Error(
          'CaptureSink: render cycle detected — a Snippet recursively ' +
            'includes itself via composition. Break the cycle in your ' +
            'generator (e.g. cache an Identifier and embed it instead).'
        )
      }
    }

    const node: Occurrence = { producer, output: '', children: [] }
    const parent = this.#stack[this.#stack.length - 1]
    ;(parent ? parent.children : (this.#fileRoots ?? [])).push(node)

    this.#stack.push(node)
    try {
      node.output = impl.call(producer)
      return node.output
    } finally {
      this.#stack.pop()
    }
  }
}

/**
 * Resolve byte spans for one file from its captured occurrence roots.
 *
 * Only Definition occurrences are file-level roots (matching the previous
 * resolver, which iterated `file.definitions`); each is located inside the
 * file text via `indexOf` from a moving cursor, then its descendants are
 * located within it. Returns spans in document order (Definitions first,
 * then their inner Snippets depth-first). Children that can't be found
 * (parent reshaped the text) and zero-length nodes are dropped rather than
 * mis-attributed.
 */
const spansFromRoots = (fileText: string, roots: Occurrence[]): Span[] => {
  const spans: Span[] = []
  let cursor = 0

  for (const root of roots) {
    // File-level roots are Definitions; non-Definition file-scope renders
    // (none today) carry no addressable region in the resolver's model.
    // Any language's Definition is a `DefinitionBase` — the engine is
    // language-blind, so this must not name a concrete (`Definition`) class.
    if (!(root.producer instanceof DefinitionBase)) continue

    const defText = root.output
    if (defText.length === 0) continue

    const index = fileText.indexOf(defText, cursor)
    if (index < 0) continue

    spans.push({ from: index, to: index + defText.length, producer: root.producer })
    walkChildren(root, index, spans)
    cursor = index + defText.length
  }

  return spans
}

/**
 * Recurse a node's children, locating each child's output inside the
 * parent's output (moving cursor so identical sibling text — two
 * `z.string()` calls — attributes to its own position) and emitting a span.
 */
const walkChildren = (parent: Occurrence, parentStart: number, out: Span[]): void => {
  let cursor = 0
  for (const child of parent.children) {
    const childText = child.output
    if (childText.length === 0) continue

    const index = parent.output.indexOf(childText, cursor)
    if (index < 0) continue

    const from = parentStart + index
    out.push({ from, to: from + childText.length, producer: child.producer })
    walkChildren(child, from, out)
    cursor = index + childText.length
  }
}
