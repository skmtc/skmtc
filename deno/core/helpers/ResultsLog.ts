// @deno-types="npm:@types/lodash-es@4.17.12"
import { set } from 'npm:lodash-es@4.17.21'
import type { ResultsItem, ResultType } from '../types/Results.ts'

export class ResultsLog {
  #results: Record<string, ResultType>

  constructor() {
    this.#results = {}
  }

  capture(stackTrail: string, result: ResultType) {
    if (this.#incomingResultIsWorse(this.#results[stackTrail], result)) {
      this.#results[stackTrail] = result
    }
  }

  #incomingResultIsWorse(current: ResultType | undefined, incoming: ResultType): boolean {
    if (current === undefined) {
      return true
    }

    return resultRankings[current] < resultRankings[incoming]
  }

  toTree(): ResultsItem {
    const tree: ResultsItem = {}

    Object.entries(this.#results).forEach(([key, value]) => {
      const keys = key.split(':')

      set(tree, keys, value)
    })

    return tree
  }
}

const resultRankings: Record<ResultType, number> = {
  error: 50,
  warning: 40,
  success: 30,
  skipped: 20,
  notSupported: 10
}
