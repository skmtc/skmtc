import type { GenerateContext } from '../context/GenerateContext.ts'
import type { RegisterArgs } from '../context/GenerateContext.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'

type ContentBaseArgs = {
  context: GenerateContext
  generatorKey?: GeneratorKey
}

export class ContentBase {
  context: GenerateContext
  skipped: boolean = false
  generatorKey: GeneratorKey | undefined

  constructor({ context, generatorKey }: ContentBaseArgs) {
    this.context = context
    this.generatorKey = generatorKey
  }

  register(args: RegisterArgs) {
    this.context.register(args)
  }
}
