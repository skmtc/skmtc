import type { GeneratorKey } from '@skmtc/core'
import { TsClass } from '@skmtc/lang-typescript'

type ApiClientClassArgs = {
  generatorKey: GeneratorKey
}

/**
 * The per-tag accumulator value: a `TsClass` carrying a `generatorKey` so the
 * definition wrapping it is attributed to this generator. Keyed to the first
 * operation that created the tag's class.
 */
export class ApiClientClass extends TsClass {
  generatorKey: GeneratorKey

  constructor({ generatorKey }: ApiClientClassArgs) {
    super()

    this.generatorKey = generatorKey
  }
}
