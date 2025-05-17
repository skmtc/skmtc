import { ValueBase } from '@skmtc/core'
import { match, P } from 'ts-pattern'
import { applyModifiers } from './applyModifiers.ts'
import type { Modifiers, GeneratorKey, GenerateContext, OasString } from '@skmtc/core'

type TsStringArgs = {
  context: GenerateContext
  stringSchema: OasString
  modifiers: Modifiers
  generatorKey: GeneratorKey
}

export class TsString extends ValueBase {
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers
  constructor({ context, stringSchema, generatorKey, modifiers }: TsStringArgs) {
    super({ context, generatorKey })

    this.enums = stringSchema.enums
    this.format = stringSchema.format
    this.modifiers = modifiers
  }

  override toString(): string {
    const { format, enums } = this

    const content = match({ format, enums })
      // .with({ format: 'date-time' }, () => {
      //   return 'Date'
      // })
      .with({ enums: P.array() }, matched => {
        return matched.enums.length === 1
          ? `'${matched.enums[0]}'`
          : `${matched.enums.map(str => `'${str}'`).join(' | ')}`
      })
      .otherwise(() => `string`)

    return applyModifiers(content, this.modifiers)
  }
}
