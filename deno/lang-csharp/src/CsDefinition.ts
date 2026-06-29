import { DefinitionBase } from '@skmtc/core'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { GeneratedValue, GenerateContextType, IdentifierBase } from '@skmtc/core'
import { toCsKeyword } from './createIdentifier.ts'
import { isCsAttributed } from './CsAttribute.ts'
import { isCsBased } from './CsBased.ts'
import { isCsConstructed } from './CsConstructed.ts'
import { isCsDocumented } from './CsDocumented.ts'
import { isCsIdentifier } from './CsIdentifier.ts'
import type { CsIdentifier } from './CsIdentifier.ts'
import { withDescription } from './withDescription.ts'

/**
 * Constructor arguments for {@link CsDefinition}.
 */
export type CsDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: IdentifierBase
  value: Value
  description?: string
  noExport?: boolean
}

/**
 * C#'s concrete {@link DefinitionBase}: assembles the declaration shell
 * around the generated value, dispatching on the identifier's opaque
 * `type` — exhaustive over this language's vocabulary, throwing outside
 * it (no silent fallback; {@link toCsKeyword} is the single source for
 * both the throw and the keyword chain).
 *
 * | type | shell |
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
    // The engine holds the identifier as the neutral `IdentifierBase`;
    // narrow to `CsIdentifier` cast-free to read the typed `type`.
    const identifier = this.identifier
    invariant(
      isCsIdentifier(identifier),
      `CsDefinition needs a CsIdentifier to render '${identifier.name}', got a foreign identifier`
    )

    const restricted = this.noExport === true || identifier.exported === false
    const visibility = restricted ? 'internal ' : 'public '

    const attributes = isCsAttributed(this.value)
      ? this.value.attributes.map(attribute => `${attribute}\n`).join('')
      : ''

    const declaration = `${attributes}${visibility}${this.toShell(identifier)}`

    // Constructor description wins; else the value-carried protocol.
    const description =
      this.description ?? (isCsDocumented(this.value) ? this.value.description : undefined)

    return withDescription(declaration, { description })
  }

  private toShell(identifier: CsIdentifier): string {
    const { name, type } = identifier

    const keyword = toCsKeyword(type)

    switch (type) {
      case 'record':
      case 'abstract-record':
      case 'class':
      case 'interface': {
        const constructorClause =
          type === 'class' && isCsConstructed(this.value)
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
        throw new Error(`Unknown C# entity type: ${type}`)
    }
  }
}
