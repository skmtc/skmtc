import { DefinitionBase } from '@skmtc/core'
import { withDescription } from './withDescription.ts'
import type { GeneratedValue, GenerateContextType, Identifier } from '@skmtc/core'

/**
 * Constructor arguments for {@link TsDefinition}.
 */
export type TsDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: Identifier
  value: Value
  description?: string
  noExport?: boolean
}

/**
 * TypeScript's concrete {@link DefinitionBase}: assembles the `export <kw>
 * Name[: Type] = value;` declaration (with an optional leading JSDoc from
 * `description`). Owns the rendering that previously lived on the engine's
 * `Definition`, byte-for-byte.
 */
export class TsDefinition<Value extends GeneratedValue = GeneratedValue> extends DefinitionBase<Value> {
  description: string | undefined
  noExport: boolean | undefined

  constructor({ context, identifier, value, description, noExport }: TsDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
    this.noExport = noExport
  }

  override toString(): string {
    const identifier = this.identifier.typeName
      ? `${this.identifier.name}: ${this.identifier.typeName}`
      : this.identifier.name

    return withDescription(
      `${this.noExport ? '' : 'export '}${this.identifier.entityType} ${identifier} = ${this.value};\n`,
      { description: this.description }
    )
  }
}
