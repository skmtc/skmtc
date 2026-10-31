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
  /**
   * Keyed by `StackTrail.toString()`. The key is one-to-one with the frames,
   * except that `[]` and `['']` both give `''`.
   */
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
   * Frames are used as own-property keys verbatim, so a frame such as
   * `constructor`, `toString` or `0` is a key like any other. A result
   * captured at the empty trail has no key and is left out.
   */
  toTree(): ResultsItem {
    const tree: ResultsItem = {}

    this.#results.forEach(({ frames, result }) => {
      const leafFrame = frames.at(-1)

      if (leafFrame === undefined) {
        return
      }

      const parent = frames.slice(0, -1).reduce<ResultsItem>((node, frame) => {
        const existing = Object.hasOwn(node, frame) ? node[frame] : undefined

        if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
          return existing
        }

        const child: ResultsItem = {}
        defineOwn(node, frame, child)

        return child
      }, tree)

      defineOwn(parent, leafFrame, result)
    })

    return tree
  }
}

/** Writes an own, enumerable property, even for keys such as `__proto__`. */
const defineOwn = (node: ResultsItem, key: string, value: ResultsItem | ResultType) => {
  Object.defineProperty(node, key, { value, enumerable: true, writable: true, configurable: true })
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
