/**
 * @fileoverview `OasBase` base class for parsed nodes.
 *
 * Shared base for OAS and GQL classes that carry a source-document
 * position. Stores the `StackTrail` captured at parse time; converts
 * to a JSON Pointer on demand via {@link OasBase.toLocation}.
 *
 * Captured whenever the node is parsed within an active stack-trail
 * scope (always, for parsed nodes). `stackTrail` is `undefined` only
 * for nodes constructed programmatically (no parse context), in which
 * case `toLocation()` returns `undefined`.
 *
 * @module OasBase
 */

import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { JsonPointer } from './JsonPointer.ts'

/**
 * Base class for parsed nodes that carry a source-document position.
 *
 * Each schema / operation class extends this so the parse-position
 * field is declared in one place. Subclass constructors call
 * `super(context)`; `OasBase` reads `context.currentStackTrail` and
 * snapshots it. Pure parse-time metadata — has no spec semantics.
 *
 * Adds **only** the `stackTrail` slot. Schema classes remain a
 * discriminated union with literal `type` / `oasType` fields
 * preserved on each subclass.
 */
export class OasBase {
  /**
   * StackTrail snapshot captured at construction time. Cloned so that
   * subsequent factory traversal doesn't mutate this node's recorded
   * position. `undefined` only when the node was constructed
   * programmatically (no parse context / no active stack-trail scope).
   */
  stackTrail: StackTrail | undefined

  constructor(context?: ParseContextType) {
    // Attribution is always on — capture the position snapshot whenever
    // we're parsing within an active stack-trail scope.
    if (context?.currentStackTrail) {
      this.stackTrail = context.currentStackTrail.clone()
    }
  }

  /**
   * Convert the captured stackTrail to a JSON Pointer. Returns
   * `undefined` only when no stackTrail was captured (the node was
   * constructed programmatically rather than parsed).
   */
  toLocation(): JsonPointer | undefined {
    return this.stackTrail?.toJsonPointer()
  }
}
