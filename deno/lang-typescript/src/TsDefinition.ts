import { DefinitionBase } from '@skmtc/core'
import invariant from 'npm:tiny-invariant@1.3.3'
import { withDescription } from './withDescription.ts'
import { toTsKeyword } from './createIdentifier.ts'
import { isTsIdentifier } from './TsIdentifier.ts'
import type { GeneratedValue, GenerateContextType, IdentifierBase } from '@skmtc/core'

/**
 * Constructor arguments for {@link TsDefinition}.
 */
export type TsDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: IdentifierBase
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
    invariant(
      isTsIdentifier(this.identifier),
      `TsDefinition needs a TsIdentifier to render '${this.identifier.name}', got a foreign identifier`
    )

    const identifier = this.identifier.typeName
      ? `${this.identifier.name}: ${this.identifier.typeName}`
      : this.identifier.name

    return withDescription(
      `${this.noExport ? '' : 'export '}${toTsKeyword(this.identifier.kind)} ${identifier} = ${this.value};\n`,
      { description: this.description }
    )
  }
}
