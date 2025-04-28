import type { GenerateContext } from '../context/GenerateContext.ts'
import type { Identifier } from './Identifier.ts'
import { ValueBase } from './ValueBase.ts'
import { withDescription } from '../typescript/withDescription.ts'
import type { GeneratedValue } from '../types/GeneratedValue.ts'

type ConstructorArgs<V extends GeneratedValue> = {
  context: GenerateContext
  description?: string
  identifier: Identifier
  value: V
}

export class Definition<V extends GeneratedValue = GeneratedValue> extends ValueBase {
  identifier: Identifier
  description: string | undefined
  value: V

  constructor({ context, identifier, value, description }: ConstructorArgs<V>) {
    super({ context, generatorKey: value.generatorKey })

    this.value = value
    this.identifier = identifier
    this.description = description
  }

  override toString(): string {
    const identifier = this.identifier.typeName
      ? `${this.identifier.name}: ${this.identifier.typeName}`
      : this.identifier.name

    // @TODO move syntax to typescript package to enable language agnostic use
    return withDescription(
      `export ${this.identifier.entityType} ${identifier} = ${this.value};\n`,
      {
        description: this.description
      }
    )
  }
}
