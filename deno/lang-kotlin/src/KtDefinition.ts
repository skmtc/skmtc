import { DefinitionBase } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType, Stringable } from '@skmtc/core'
import { isKtAnnotated } from './KtAnnotation.ts'
import { isKtConstructed } from './KtConstructed.ts'
import { isKtDocumented } from './KtDocumented.ts'
import { isKtSupertyped } from './KtSupertyped.ts'
import type { KtIdentifier } from './KtIdentifier.ts'
import { withDescription } from './withDescription.ts'

/**
 * Constructor arguments for {@link KtDefinition}.
 */
export type KtDefinitionArgs<Value extends GeneratedValue> = {
  context: GenerateContextType
  identifier: KtIdentifier
  value: Value
  description?: string
  noExport?: boolean
}

/**
 * Kotlin's concrete {@link DefinitionBase}: assembles the declaration
 * shell around the generated value, dispatching on the identifier's typed
 * `type` — exhaustive over this language's vocabulary. The identifier
 * renders its own declaration head (`data class User`, `val timeout:
 * Long` — see {@link KtIdentifier.toString}); each branch here adds only
 * the kind's *arrangement*: parameter parens, supertype clause, braced
 * body. (A foreign identifier is refused earlier, at the
 * `Lang.toDefinition` boundary in `KtLang`; the constructor only accepts
 * a {@link KtIdentifier}.)
 *
 * | type | shell |
 * |---|---|
 * | `class` | `class Name` (+ `(\n…\n)` via the `KtConstructed` protocol; + ` : A, B` via the supertype protocol; + ` {\n…\n}` when the value renders non-empty) |
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
 * {@link import('./KtSupertyped.ts').KtSupertyped} (rendered on the
 * `data-class` and `class` shells); a `description` renders as a KDoc
 * block above the annotations.
 *
 * Visibility: Kotlin defaults to `public`, so the neutral `exported`
 * renders as *nothing* when exported and `private ` (file-local) when
 * not — keyword only to restrict. `noExport` restricts the same way.
 */
export class KtDefinition<
  Value extends GeneratedValue = GeneratedValue
> extends DefinitionBase<Value> {
  /** Narrows the inherited neutral `identifier` to the concrete Kotlin
   *  subclass (the constructor only accepts a {@link KtIdentifier}). */
  declare identifier: KtIdentifier

  description: string | undefined
  noExport: boolean | undefined

  constructor({ context, identifier, value, description, noExport }: KtDefinitionArgs<Value>) {
    super({ context, identifier, value })

    this.description = description
    this.noExport = noExport
  }

  override toString(): string {
    if (this.identifier.type === 'verbatim') {
      // The value IS the declaration text (template files, multi-
      // declaration bodies) — no shell, no visibility, no annotations.
      return `${this.value}`
    }

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
    // The identifier renders its own declaration head (`data class User`,
    // `val timeout: Long`); each branch adds only the kind's arrangement.
    const head = this.identifier

    switch (this.identifier.type) {
      case 'class': {
        const constructorClause = isKtConstructed(this.value)
          ? `${toConstructorKeyword(this.value.constructorModifiers)}(\n${this.value.constructorParameters}\n)`
          : ''
        const supertypeClause =
          isKtSupertyped(this.value) && this.value.supertypes.length
            ? ` : ${this.value.supertypes.join(', ')}`
            : ''
        const body = `${this.value}`

        return body.length
          ? `${head}${constructorClause}${supertypeClause} {\n${body}\n}`
          : `${head}${constructorClause}${supertypeClause}`
      }
      case 'data-class': {
        const clause =
          isKtSupertyped(this.value) && this.value.supertypes.length
            ? ` : ${this.value.supertypes.join(', ')}`
            : ''

        return `${head}(\n${this.value}\n)${clause}`
      }
      case 'enum-class':
        return `${head} {\n${this.value}\n}`
      case 'interface':
      case 'sealed-interface': {
        const body = `${this.value}`

        return body.length ? `${head} {\n${body}\n}` : `${head}`
      }
      case 'typealias':
      case 'val':
        return `${head} = ${this.value}`
      default:
        throw new Error(`Unknown Kotlin entity type: ${this.identifier.type}`)
    }
  }
}

/**
 * Constructor modifiers (annotations / visibility) between the class
 * name and the parameter list require Kotlin's explicit `constructor`
 * keyword — the lang owns that rule; the modifiers' content is
 * generator policy.
 */
const toConstructorKeyword = (modifiers: Stringable | undefined): string => {
  const rendered = modifiers === undefined ? '' : `${modifiers}`

  return rendered.length ? ` ${rendered} constructor` : ''
}
