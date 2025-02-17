import type { GenerateContext } from '../context/GenerateContext.ts'
import type { RegisterArgs } from '../context/GenerateContext.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'

type ValueBaseArgs = {
  context: GenerateContext
  generatorKey?: GeneratorKey
}

export class ValueBase {
  context: GenerateContext
  skipped: boolean = false
  generatorKey: GeneratorKey | undefined

  constructor({ context, generatorKey }: ValueBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
  }

  register(args: RegisterArgs) {
    this.context.register(args)
  }
}
