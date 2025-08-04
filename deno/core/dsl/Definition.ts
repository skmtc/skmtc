import type { GenerateContext } from '../context/GenerateContext.ts'
import type { Identifier } from './Identifier.ts'
import { ContentBase } from './ContentBase.ts'
import { withDescription } from '../typescript/withDescription.ts'
import type { GeneratedValue } from '../types/GeneratedValue.ts'

type ConstructorArgs<V extends GeneratedValue> = {
  context: GenerateContext
  description?: string
  identifier: Identifier
  value: V
  noExport?: boolean
}

export class Definition<V extends GeneratedValue = GeneratedValue> extends ContentBase {
  identifier: Identifier
  description: string | undefined
  value: V
  noExport?: boolean

  constructor({ context, identifier, value, description, noExport }: ConstructorArgs<V>) {
    super({ context, generatorKey: value.generatorKey })

    this.value = value
    this.identifier = identifier
    this.description = description
    this.noExport = noExport
  }

  override toString(): string {
    const identifier = this.identifier.typeName
      ? `${this.identifier.name}: ${this.identifier.typeName}`
      : this.identifier.name

    // @TODO move syntax to typescript package to enable language agnostic use
    return withDescription(
      `${this.noExport ? '' : 'export '}${this.identifier.entityType} ${identifier} = ${this.value};\n`,
      {
        description: this.description
      }
    )
  }
}
