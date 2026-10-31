// @deno-types="npm:@types/lodash-es@4.17.12/set.d.ts"
import set from 'lodash-es/set'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { ResultsItem, ResultType } from '@/types/Results.ts'

/**
 * Records one result per stack trail and builds the `manifest.results` tree.
 *
 * When several results are captured at the same trail, the most severe one
 * wins (see `resultRankings`).
 *
 * @example
 * ```typescript
 * const resultsLog = new ResultsLog()
 *
 * resultsLog.capture(new StackTrail(['generate', '/pets', 'get']), 'success')
 * resultsLog.capture(new StackTrail(['generate', '/pets/{id}:archive', 'post']), 'error')
 *
 * resultsLog.toTree()
 * // { generate: { '/pets': { get: 'success' }, '/pets/{id}:archive': { post: 'error' } } }
 * ```
 */
export class ResultsLog {
  /** Keyed by `StackTrail.toString()`, which is one-to-one with the frames. */
  #results: Map<string, { frames: string[]; result: ResultType }>

  constructor() {
    this.#results = new Map()
  }

  /**
   * Captures `result` at `stackTrail`, unless a more severe result is
   * already recorded there.
   *
   * Stores a copy of the frames: `StackTrail.trace` pops the live array
   * after its callback returns.
   */
  capture(stackTrail: StackTrail, result: ResultType) {
    const key = stackTrail.toString()

    if (this.#incomingResultIsWorse(this.#results.get(key)?.result, result)) {
      this.#results.set(key, { frames: [...stackTrail.stackTrail], result })
    }
  }

  #incomingResultIsWorse(current: ResultType | undefined, incoming: ResultType): boolean {
    if (current === undefined) {
      return true
    }

    return resultRankings[current] < resultRankings[incoming]
  }

  /**
   * Nests the captured results by their frames, one object level per frame.
   * Frames are used as keys verbatim.
   */
  toTree(): ResultsItem {
    const tree: ResultsItem = {}

    this.#results.forEach(({ frames, result }) => {
      set(tree, frames, result)
    })

    return tree
  }
}

/**
 * Severity of each result type. A higher number replaces a lower one
 * captured at the same trail.
 */
const resultRankings: Record<ResultType, number> = {
  error: 50,
  warning: 40,
  success: 30,
  skipped: 20,
  notSupported: 10
}
