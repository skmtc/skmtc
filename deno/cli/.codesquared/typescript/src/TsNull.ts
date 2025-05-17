import type { GeneratorKey, GenerateContext } from '@skmtc/core'
import { ValueBase } from '@skmtc/core'

type ConstructorArgs = {
  context: GenerateContext
  generatorKey: GeneratorKey
}

export class TsNull extends ValueBase {
  type = 'null' as const

  constructor({ context, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey })
  }

  override toString(): string {
    return 'null'
  }
}
