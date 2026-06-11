import { DefinitionBase } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType, Identifier } from '@skmtc/core'
import { isKtAnnotated } from './KtAnnotation.ts'
import { isKtConstructed } from './KtConstructed.ts'
import { isKtDocumented } from './KtDocumented.ts'
import { isKtSupertyped } from './KtSupertyped.ts'
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
 * | `class` | `class Name` (+ `(\n…\n)` via the `KtConstructed` protocol; + ` {\n…\n}` when the value renders non-empty) |
 * | `data-class` | `data class Name(\n…\n)` (+ ` : A, B` via the supertype protocol) |
 * | `enum-class` | `enum class Name {\n…\n}` |
 * | `interface` | `interface Name` (+ ` {\n…\n}` when the value renders non-empty) |
 * | `sealed-interface` | `sealed interface Name` (+ ` {\n…\n}` when the value renders non-empty) |
 * | `typealias` | `typealias Name = …` |
 * | `val` | `val Name[: Type] = …` (Kotlin's distinctive file-scope value) |
 *
 * Class-level annotations ride on the VALUE via the
 * {@link import('./KtAnnotation.ts').KtAnnotated} protocol (the neutral
 * `Lang.toDefinition` signature has no annotations slot) and render one
 * per line above the shell; a supertype clause rides the same way via
 * {@link import('./KtSupertyped.ts').KtSupertyped} (rendered for the
 * `data-class` kind only in v1); a `description` renders as a KDoc block
 * above the annotations.
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

    // Constructor description wins; else the value-carried protocol.
    const description =
      this.description ?? (isKtDocumented(this.value) ? this.value.description : undefined)

    return withDescription(declaration, { description })
  }

  private toShell(): string {
    const { name, kind, typeName } = this.identifier

    switch (kind) {
      case 'class': {
        const constructorClause = isKtConstructed(this.value)
          ? `(\n${this.value.constructorParameters}\n)`
          : ''
        const body = `${this.value}`

        return body.length
          ? `class ${name}${constructorClause} {\n${body}\n}`
          : `class ${name}${constructorClause}`
      }
      case 'data-class': {
        const clause =
          isKtSupertyped(this.value) && this.value.supertypes.length
            ? ` : ${this.value.supertypes.join(', ')}`
            : ''

        return `data class ${name}(\n${this.value}\n)${clause}`
      }
      case 'enum-class':
        return `enum class ${name} {\n${this.value}\n}`
      case 'interface': {
        const body = `${this.value}`

        return body.length ? `interface ${name} {\n${body}\n}` : `interface ${name}`
      }
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
