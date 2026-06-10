import { DefinitionBase } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType, Identifier } from '@skmtc/core'
import { isKtAnnotated } from './KtAnnotation.ts'
import { withDescription } from './withDescription.ts'

/**
 * Constructor arguments for {@link KtDefinition}.
 */
export type KtDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: Identifier
  value: Value
  description?: string
  noExport?: boolean
}

/**
 * Kotlin's concrete {@link DefinitionBase}: assembles the declaration
 * shell around the generated value, dispatching on the identifier's
 * opaque `kind` — exhaustive over this language's vocabulary, throwing
 * outside it (no silent fallback).
 *
 * | kind | shell |
 * |---|---|
 * | `data-class` | `data class Name(\n…\n)` |
 * | `enum-class` | `enum class Name {\n…\n}` |
 * | `sealed-interface` | `sealed interface Name` (+ ` {\n…\n}` when the value renders non-empty) |
 * | `typealias` | `typealias Name = …` |
 * | `val` | `val Name[: Type] = …` (Kotlin's distinctive file-scope value) |
 *
 * Class-level annotations ride on the VALUE via the
 * {@link import('./KtAnnotation.ts').KtAnnotated} protocol (the neutral
 * `Lang.toDefinition` signature has no annotations slot) and render one
 * per line above the shell; a `description` renders as a KDoc block above
 * the annotations.
 *
 * Visibility: Kotlin defaults to `public`, so the neutral `exported`
 * renders as *nothing* when exported and `private ` (file-local) when
 * not — keyword only to restrict. `noExport` restricts the same way.
 */
export class KtDefinition<Value extends GeneratedValue = GeneratedValue> extends DefinitionBase<Value> {
  description: string | undefined
  noExport: boolean | undefined

  constructor({ context, identifier, value, description, noExport }: KtDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
    this.noExport = noExport
  }

  override toString(): string {
    const restricted = this.noExport === true || this.identifier.exported === false
    const visibility = restricted ? 'private ' : ''

    const annotations = isKtAnnotated(this.value)
      ? this.value.annotations.map(annotation => `${annotation}\n`).join('')
      : ''

    const declaration = `${annotations}${visibility}${this.toShell()}`

    return withDescription(declaration, { description: this.description })
  }

  private toShell(): string {
    const { name, kind, typeName } = this.identifier

    switch (kind) {
      case 'data-class':
        return `data class ${name}(\n${this.value}\n)`
      case 'enum-class':
        return `enum class ${name} {\n${this.value}\n}`
      case 'sealed-interface': {
        const body = `${this.value}`

        return body.length ? `sealed interface ${name} {\n${body}\n}` : `sealed interface ${name}`
      }
      case 'typealias':
        return `typealias ${name} = ${this.value}`
      case 'val':
        return `val ${name}${typeName ? `: ${typeName}` : ''} = ${this.value}`
      default:
        throw new Error(`Unknown Kotlin entity kind: ${kind}`)
    }
  }
}
