import { DefinitionBase } from '@skmtc/core'
import { withDescription } from './withDescription.ts'
import { toTsKeyword, isBlockType } from './createIdentifier.ts'
import type { GeneratedValue, GenerateContextType } from '@skmtc/core'
import type { TsIdentifier } from './TsIdentifier.ts'

/**
 * Constructor arguments for {@link TsDefinition}.
 */
export type TsDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: TsIdentifier
  value: Value
  description?: string
  /**
   * A `//` line comment rendered verbatim on its own line directly above the
   * declaration (and above any JSDoc `description`). Each newline starts a
   * fresh `// ` line. Use for terse leading notes that aren't JSDoc.
   */
  leadingComment?: string
  noExport?: boolean
}

/**
 * TypeScript's concrete {@link DefinitionBase}: assembles the `export <kw>
 * Name[: Type] = value;` declaration (with an optional leading JSDoc from
 * `description`). Owns the rendering that previously lived on the engine's
 * `Definition`, byte-for-byte.
 */
export class TsDefinition<
  Value extends GeneratedValue = GeneratedValue
> extends DefinitionBase<Value> {
  /** Narrows the inherited neutral `identifier` to the concrete TS subclass
   *  (the constructor only accepts a {@link TsIdentifier}). */
  declare identifier: TsIdentifier

  description: string | undefined
  leadingComment: string | undefined
  noExport: boolean | undefined

  constructor({
    context,
    identifier,
    value,
    description,
    leadingComment,
    noExport
  }: TsDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
    this.leadingComment = leadingComment
    this.noExport = noExport
  }

  override toString(): string {
    const { type, name, typeName } = this.identifier
    const exportPrefix = this.noExport ? '' : 'export '
    const keyword = toTsKeyword(type)

    const leadingComment = this.leadingComment
      ? this.leadingComment
          .split('\n')
          .map(line => `// ${line}\n`)
          .join('')
      : ''

    // Block-form declarations (class / interface / declare namespace) take no
    // `= value` and no trailing `;` — the value carries the heritage and the
    // braced body.
    if (isBlockType(type)) {
      return (
        leadingComment +
        withDescription(`${exportPrefix}${keyword} ${name} ${this.value}\n`, {
          description: this.description
        })
      )
    }

    const identifier = typeName ? `${name}: ${typeName}` : name

    return (
      leadingComment +
      withDescription(`${exportPrefix}${keyword} ${identifier} = ${this.value};\n`, {
        description: this.description
      })
    )
  }
}
