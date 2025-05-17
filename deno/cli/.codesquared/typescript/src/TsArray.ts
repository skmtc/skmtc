import { ValueBase } from '@skmtc/core'
import type { TypeSystemValue, OasSchema, Modifiers, GeneratorKey, GenerateContext, OasRef, RefName } from '@skmtc/core'
import { toTsValue } from './Ts.ts'
import { applyModifiers } from './applyModifiers.ts'

type TsArrayArgs = {
  context: GenerateContext
  destinationPath: string
  items: OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef: RefName
}

export class TsArray extends ValueBase {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, items, modifiers, rootRef }: TsArrayArgs) {
    super({ context, generatorKey })

    this.modifiers = modifiers

    this.items = toTsValue({ destinationPath, schema: items, required: true, context, rootRef })
  }

  override toString(): string {
    return applyModifiers(`Array<${this.items}>`, this.modifiers)
  }
}
