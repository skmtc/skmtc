import { DefinitionBase } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType, Identifier } from '@skmtc/core'
import { toCsKeyword } from './createIdentifier.ts'
import { isCsAttributed } from './CsAttribute.ts'
import { isCsBased } from './CsBased.ts'
import { isCsConstructed } from './CsConstructed.ts'
import { isCsDocumented } from './CsDocumented.ts'
import { withDescription } from './withDescription.ts'

/**
 * Constructor arguments for {@link CsDefinition}.
 */
export type CsDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: Identifier
  value: Value
  description?: string
  noExport?: boolean
}

/**
 * C#'s concrete {@link DefinitionBase}: assembles the declaration shell
 * around the generated value, dispatching on the identifier's opaque
 * `kind` — exhaustive over this language's vocabulary, throwing outside
 * it (no silent fallback; {@link toCsKeyword} is the single source for
 * both the throw and the keyword chain).
 *
 * | kind | shell |
 * |---|---|
 * | `record` | `sealed partial record Name[ : A, B]\n{\n…\n}` (bodyless collapse to `…Name[ : A, B];` when the value renders empty) |
 * | `abstract-record` | `abstract partial record Name[ : A, B]\n{\n…\n}` (same bodyless collapse — the polymorphic parent is normally bodyless) |
 * | `class` | `sealed partial class Name[(…)][ : A, B]\n{\n…\n}` — the primary constructor rides the `CsConstructed` protocol, inline (C# 12) |
 * | `interface` | `interface Name[ : A, B]\n{\n…\n}` (same bodyless collapse) |
 * | `enum` | `enum Name\n{\n…\n}` |
 *
 * Class-level attributes ride on the VALUE via the
 * {@link import('./CsAttribute.ts').CsAttributed} protocol (the neutral
 * `Lang.toDefinition` signature has no attributes slot) and render one
 * per line above the shell; a `description` renders as an XML-doc
 * `<summary>` block above the attributes (C#'s conventional order:
 * doc comment, attributes, declaration); the record-family shells read
 * the {@link import('./CsBased.ts').CsBased} base-type clause
 * (` : Animal` between the name and the body — or before the `;` on
 * the bodyless collapse).
 *
 * Visibility: C# types default to `internal`, so BOTH `exported` states
 * render a keyword — `public ` when exported, `internal ` when not (the
 * fifth distinct `exported` behavior, spike-proved). `noExport`
 * restricts the same way.
 */
export class CsDefinition<Value extends GeneratedValue = GeneratedValue> extends DefinitionBase<Value> {
  description: string | undefined
  noExport: boolean | undefined

  constructor({ context, identifier, value, description, noExport }: CsDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
    this.noExport = noExport
  }

  override toString(): string {
    const restricted = this.noExport === true || this.identifier.exported === false
    const visibility = restricted ? 'internal ' : 'public '

    const attributes = isCsAttributed(this.value)
      ? this.value.attributes.map(attribute => `${attribute}\n`).join('')
      : ''

    const declaration = `${attributes}${visibility}${this.toShell()}`

    // Constructor description wins; else the value-carried protocol.
    const description =
      this.description ?? (isCsDocumented(this.value) ? this.value.description : undefined)

    return withDescription(declaration, { description })
  }

  private toShell(): string {
    const { name, kind } = this.identifier

    const keyword = toCsKeyword(kind)

    switch (kind) {
      case 'record':
      case 'abstract-record':
      case 'class':
      case 'interface': {
        const constructorClause =
          kind === 'class' && isCsConstructed(this.value)
            ? `(${this.value.constructorParameters})`
            : ''
        const clause =
          isCsBased(this.value) && this.value.baseTypes.length
            ? ` : ${this.value.baseTypes.join(', ')}`
            : ''
        const body = `${this.value}`

        return body.length
          ? `${keyword} ${name}${constructorClause}${clause}\n{\n${body}\n}`
          : `${keyword} ${name}${constructorClause}${clause};`
      }
      case 'enum':
        return `${keyword} ${name}\n{\n${this.value}\n}`
      default:
        throw new Error(`Unknown C# entity kind: ${kind}`)
    }
  }
}
