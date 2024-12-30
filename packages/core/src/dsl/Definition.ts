import type { GenerateContext } from '../context/GenerateContext.js'
import type { Identifier } from './Identifier.js'
import { ValueBase } from './ValueBase.js'
import { withDescription } from '../typescript/withDescription.js'
import type { GeneratedValue } from '../types/GeneratedValue.js'

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
    return withDescription(`export ${this.identifier.entityType} ${identifier} = ${this.value};`, {
      description: this.description
    })
  }
}
