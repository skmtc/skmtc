import { ValueBase } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import type { GenerateContext, Modifiers, OasInteger, GeneratorKey } from '@skmtc/core'

import { match, P } from 'ts-pattern'

type ZodIntegerArgs = {
  context: GenerateContext
  integerSchema: OasInteger
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class ZodInteger extends ValueBase {
  type = 'integer' as const
  modifiers: Modifiers
  format?: 'int32' | 'int64'
  enums?: number[] | (number | null)[]

  constructor({ context, integerSchema, modifiers, generatorKey }: ZodIntegerArgs) {
    super({ context, generatorKey })

    this.format = integerSchema.format
    this.enums = integerSchema.enums
    this.modifiers = modifiers
  }

  override toString(): string {
    const { enums } = this

    const content = match({ enums })
      .with({ enums: P.array() }, ({ enums }) => {
        return enums.length === 1
          ? `z.literal(${enums[0]})`
          : `z.union([${enums.map(e => `z.literal(${e})`).join(', ')}])`
      })
      .otherwise(() => {
        return `z.number().int()`
      })

    return applyModifiers(content, this.modifiers)
  }
}
