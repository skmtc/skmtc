import type { GenerateContext } from '../context/GenerateContext.ts'
import { ValueBase } from '../dsl/ValueBase.ts'
import type { Stringable } from '../dsl/Stringable.ts'
import type { GeneratorKey } from './GeneratorKeys.ts'
import type { OasRef } from '../oas/ref/Ref.ts'

type CreateArgs = {
  context: GenerateContext
  value: Stringable
  generatorKey?: GeneratorKey
}

export class CustomValue extends ValueBase {
  type = 'custom' as const
  value: Stringable

  constructor({ context, value, generatorKey }: CreateArgs) {
    super({ context, generatorKey })

    this.value = value
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): CustomValue {
    return this
  }

  resolveOnce(): CustomValue {
    return this
  }

  override toString(): string {
    return `${this.value}`
  }
}

export const isCustomValue = (value: unknown): value is CustomValue => {
  return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'custom')
}
