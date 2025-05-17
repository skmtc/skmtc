import { applyModifiers } from './applyModifiers.ts'
import { type Modifiers, type GeneratorKey, ValueBase, type GenerateContext } from '@skmtc/core'

type ZodBooleanArgs = {
  context: GenerateContext
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class ZodBoolean extends ValueBase {
  type = 'boolean' as const
  modifiers: Modifiers

  constructor({ context, modifiers, generatorKey }: ZodBooleanArgs) {
    super({ context, generatorKey })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(`z.boolean()`, this.modifiers)
  }
}
