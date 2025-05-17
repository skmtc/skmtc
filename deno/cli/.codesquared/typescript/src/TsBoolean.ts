import type { GeneratorKey, Modifiers, GenerateContext } from '@skmtc/core'
import { ValueBase } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'

type TsBooleanArgs = {
  context: GenerateContext
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class TsBoolean extends ValueBase {
  type = 'boolean' as const
  modifiers: Modifiers

  constructor({ context, modifiers, generatorKey }: TsBooleanArgs) {
    super({ context, generatorKey })

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(`boolean`, this.modifiers)
  }
}
