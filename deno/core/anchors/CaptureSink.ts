/**
 * @fileoverview Render-phase attribution capture.
 *
 * The capture mechanism for gen-maps. A {@link CaptureSink} is owned by
 * {@link import('@/context/RenderContext.ts').RenderContext} for the
 * duration of the single render pass. {@link installCapture} wraps the
 * `toString` of every concrete `SnippetBase` subclass seen during generate
 * (discovered via `seenSnippetCtors`) so that, while the sink is active,
 * each `toString` invocation is observed into an **occurrence tree** — one
 * node per call, keyed by invocation, not by instance. The wrapper is a
 * pure pass-through: it returns the subclass `toString`'s output verbatim
 * and only *observes* it.
 *
 * This replaces the old always-on, instance-level capture (`_rendered` /
 * `_children` on `SnippetBase` + a module-global render stack). All capture
 * state now lives here, transiently, and is discarded once sidecars are
 * built. Outside the render pass there is no wrapper and no state, so a
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

import { SnippetBase, seenSnippetConstructors } from '@/dsl/SnippetBase.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import type { Span } from './types.ts'

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
 * `active` gates the installed wrapper: only while a file is rendering
 * (inside {@link captureFile}) does the wrapper observe; otherwise it is an
 * inert pass-through. This keeps a stray `toString()` between files (or
 * between install and the first `captureFile`) from polluting the tree.
 */
export class CaptureSink {
  /** Live stack of occurrences currently rendering (innermost last). */
  #stack: Occurrence[] = []
  /** Roots for the file currently rendering; `null` when no file is active. */
  #fileRoots: Occurrence[] | null = null
  /** Whether a file render is in progress (wrapper observes only then). */
  #active = false

  /** True while a file is rendering — the installed wrapper checks this. */
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
   * Observe one `toString` invocation. Installed wrapper calls this while
   * the sink is active. Pushes an occurrence node, links it to its parent
   * (or the file roots), runs the original `toString`, records the output,
   * and returns it verbatim.
   *
   * @throws when `instance` is already live on the stack — a snippet that
   *   composes itself, which would otherwise infinitely recurse.
   */
  capture(instance: SnippetBase, original: () => string): string {
    for (const node of this.#stack) {
      if (node.producer === instance) {
        throw new Error(
          'CaptureSink: render cycle detected — a Snippet recursively ' +
            'includes itself via composition. Break the cycle in your ' +
            'generator (e.g. cache an Identifier and embed it instead).'
        )
      }
    }

    const node: Occurrence = { producer: instance, output: '', children: [] }
    const parent = this.#stack[this.#stack.length - 1]
    ;(parent ? parent.children : (this.#fileRoots ?? [])).push(node)

    this.#stack.push(node)
    try {
      node.output = original.call(instance)
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

/**
 * Structural view of a `toString`-bearing prototype, for the reflective
 * wrap. The cast to this shape is the one unavoidable bit of prototype
 * metaprogramming.
 */
type ToStringHost = { toString: (this: SnippetBase) => string }

/**
 * Install the capture wrapper for a render pass and return a restore
 * function (call it in `finally`).
 *
 * For each concrete subclass seen during generate, find the prototype its
 * instances' `toString` resolves to (walking up to, but not past,
 * `SnippetBase.prototype`) and replace that prototype's `toString` with a
 * wrapper closing over `sink`. The wrapper observes via `sink.capture` only
 * while the sink is active, else passes through. Each prototype is wrapped
 * once even if several leaves resolve to it.
 *
 * Wrapping the *resolved* prototype (not blindly every prototype in the
 * chain) means an inner call reaches the real method, not another wrapper —
 * there is no `super.toString()` in the corpus, so no double-capture.
 */
export const installCapture = (sink: CaptureSink): (() => void) => {
  const restores: Array<() => void> = []
  const wrapped = new Set<object>()

  for (const subclass of seenSnippetConstructors) {
    let prototype: object | null = subclass.prototype
    while (
      prototype &&
      prototype !== SnippetBase.prototype &&
      !Object.hasOwn(prototype, 'toString')
    ) {
      prototype = Object.getPrototypeOf(prototype)
    }

    if (!prototype || wrapped.has(prototype) || !Object.hasOwn(prototype, 'toString')) {
      continue
    }
    wrapped.add(prototype)

    // Reflective wrap: read and replace the prototype's own `toString`.
    const host = prototype as ToStringHost
    const original = host.toString
    host.toString = function (this: SnippetBase): string {
      return sink.active ? sink.capture(this, original) : original.call(this)
    }
    restores.push(() => {
      host.toString = original
    })
  }

  return () => {
    for (const restore of restores) restore()
  }
}
