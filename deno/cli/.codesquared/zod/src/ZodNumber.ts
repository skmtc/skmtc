import { type GenerateContext, ValueBase, type GeneratorKey, type Modifiers } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

type ZodNumberArgs = {
  context: GenerateContext
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class ZodNumber extends ValueBase {
  type = 'number' as const
  modifiers: Modifiers

  constructor({ context, modifiers, generatorKey }: ZodNumberArgs) {
    super({ context, generatorKey })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(`z.number()`, this.modifiers)
  }
}
