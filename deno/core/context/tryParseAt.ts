/**
 * Shared helper for "run a per-item parse inside a stack-trail trace,
 * isolate failures, log an error issue and continue."
 *
 * Both protocols use this pattern at the boundary where a single bad
 * input shouldn't abort the whole parse phase:
 *
 *   - OAS: `toSchemasV3`, `toOperationsV3`, `toResponseV3`,
 *     `toParameterV3` each iterate a record / map and call the
 *     per-item parser. A throw inside one item should isolate to that
 *     item, log an `INVALID_<KIND>` issue, and let the rest of the
 *     record continue.
 *
 *   - GQL: `parseGqlDocument` iterates the GraphQL type map and calls
 *     `toObjectType` / `toInputType` / etc. per type. Same isolation
 *     requirement.
 *
 * The helper threads the stack trail descent + try/catch + issue
 * logging into one call so both surfaces share the failure-handling
 * shape verbatim.
 */

import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { OasIssueType } from '@/context/generateTypes.ts'
import type { GqlIssueType } from '@/context/ParseIssue.ts'

export type TryParseAtArgs<T> = {
  /** Stack trail of the parent — child trace is pushed via `key`. */
  stackTrail: StackTrail
  /** Trace key for this item (e.g. the schema name, operation method, type name). */
  key: string
  /** Parse context. */
  context: ParseContextType
  /**
   * Issue type to log when the per-item parser throws. Use a
   * protocol-appropriate value from `OasIssueType` (e.g.
   * `'INVALID_SCHEMA'`) or `GqlIssueType` (e.g.
   * `'INVALID_TYPE_DEFINITION'`).
   */
  type: OasIssueType | GqlIssueType
  /**
   * Optional parent object — forwarded to the logger so log readers
   * see the surrounding context for the failing item.
   */
  parent?: unknown
  /**
   * Optional ref key under which to register a `registerRefError` so
   * cross-references to this item can be pruned by
   * `removeErroredItems`. OAS callers usually leave this undefined —
   * `logIssueNoKey` auto-registers via `stackTrail.toStackRef()` when
   * the trail is at a components position. GQL callers pass the type
   * name explicitly.
   */
  refKey?: string
  /**
   * The actual parser, invoked inside the child trace.
   */
  fn: (childStack: StackTrail) => T
}

/**
 * Run `fn(childStack)` inside `stackTrail.trace(key, ...)`. On throw:
 *
 *   - logs a `level: 'error'` issue at the child location with the
 *     given `type` and the thrown value as `cause`
 *   - registers a ref error if `refKey` is provided
 *   - returns `undefined`
 *
 * On success, returns whatever `fn` returned.
 */
export const tryParseAt = <T>({
  stackTrail,
  key,
  context,
  type,
  parent,
  refKey,
  fn
}: TryParseAtArgs<T>): T | undefined => {
  try {
    return stackTrail.trace(key, childStack => fn(childStack))
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    if (refKey !== undefined) {
      context.registerRefError(error, refKey)
    }
    stackTrail.trace(key, childStack => {
      context.logIssueNoKey({
        level: 'error',
        stackTrail: childStack,
        parent,
        message: normalized.message,
        cause: normalized,
        type
      })
    })
    return undefined
  }
}
