import { ValueBase } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import type { OasInteger, GeneratorKey, Modifiers, GenerateContext } from '@skmtc/core'
import { match, P } from 'ts-pattern'

type TsIntegerArgs = {
  context: GenerateContext
  integerSchema: OasInteger
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class TsInteger extends ValueBase {
  type = 'integer' as const
  modifiers: Modifiers
  format?: 'int32' | 'int64'
  enums?: number[] | (number | null)[]

  constructor({ context, integerSchema, generatorKey, modifiers }: TsIntegerArgs) {
    super({ context, generatorKey })

    this.format = integerSchema.format
    this.enums = integerSchema.enums
    this.modifiers = modifiers
  }

  override toString(): string {
    const { enums } = this

    const content = match({ enums })
      .with({ enums: P.array() }, ({ enums }) => enums.join(' | '))
      .otherwise(() => `number`)

    return applyModifiers(content, this.modifiers)
  }
}
