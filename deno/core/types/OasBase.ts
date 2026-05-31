/**
 * @fileoverview `OasBase` base class for parsed nodes.
 *
 * Shared base for OAS and GQL classes that carry a source-document
 * position, stored as a `StackTrail`. The trail is **total**: a parsed
 * node snapshots the visitor position; a programmatically-constructed
 * (synthetic) node gets `StackTrail.empty()`. Callers convert to a JSON
 * Pointer on demand via `stackTrail.toJsonPointer()`, gating on
 * `stackTrail.isEmpty()` for synthetic nodes — there is no `undefined`.
 *
 * @module OasBase
 */

import type { ParseContextType } from '@/context/parseTypes.ts'
import { StackTrail } from '@/context/StackTrail.ts'

/**
 * Base class for parsed nodes that carry a source-document position.
 *
 * Each schema / operation class extends this so the parse-position
 * field is declared in one place. Subclass constructors call
 * `super(context)`; `OasBase` reads `context.currentStackTrail` and
 * snapshots it, or records `StackTrail.empty()` when there is none.
 * Pure parse-time metadata — has no spec semantics.
 *
 * Adds **only** the `stackTrail` slot. Schema classes remain a
 * discriminated union with literal `type` / `oasType` fields
 * preserved on each subclass.
 */
export class OasBase {
  /**
   * StackTrail snapshot captured at construction time. Cloned so that
   * subsequent factory traversal doesn't mutate this node's recorded
   * position. `StackTrail.empty()` when the node was constructed
   * programmatically (no parse context / no active stack-trail scope) —
   * a synthetic node with no source position. No parsed node is ever
   * at the empty trail, so `isEmpty()` cleanly means "synthetic".
   */
  stackTrail: StackTrail

  constructor(context?: ParseContextType) {
    // Attribution is always on — snapshot the position when parsing
    // within an active stack-trail scope; otherwise the node is
    // synthetic and carries the empty (positionless) trail.
    this.stackTrail = context?.currentStackTrail?.clone() ?? StackTrail.empty()
  }
}
