/**
 * @fileoverview `Located` base class for parsed nodes.
 *
 * Shared base for OAS and GQL classes that carry a source-document
 * position. Stores the `StackTrail` captured at parse time; converts
 * to a JSON Pointer on demand via {@link Located.toLocation}.
 *
 * Captured only when attribution (gen-maps) is enabled on the parse
 * context. When disabled, `stackTrail` is `undefined` and
 * `toLocation()` returns `undefined`.
 *
 * @module Located
 */

import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { JsonPointer } from './JsonPointer.ts'

/**
 * Base class for parsed nodes that carry a source-document position.
 *
 * Each schema / operation class extends this so the parse-position
 * field is declared in one place. Subclass constructors call
 * `super(context)`; `Located` reads `context.currentStackTrail` and
 * snapshots it. Pure parse-time metadata — has no spec semantics.
 *
 * Adds **only** the `stackTrail` slot. Schema classes remain a
 * discriminated union with literal `type` / `oasType` fields
 * preserved on each subclass.
 */
export class Located {
  /**
   * StackTrail snapshot captured at construction time. Cloned so that
   * subsequent factory traversal doesn't mutate this node's recorded
   * position. `undefined` when attribution is off (no snapshot
   * taken).
   */
  stackTrail: StackTrail | undefined

  constructor(context?: ParseContextType) {
    if (context?.attribution?.enabled && context.currentStackTrail) {
      this.stackTrail = context.currentStackTrail.clone()
    }
  }

  /**
   * Convert the captured stackTrail to a JSON Pointer. Returns
   * `undefined` if no stackTrail was captured (attribution was off
   * or the node was constructed programmatically rather than parsed).
   */
  toLocation(): JsonPointer | undefined {
    return this.stackTrail?.toJsonPointer()
  }
}
