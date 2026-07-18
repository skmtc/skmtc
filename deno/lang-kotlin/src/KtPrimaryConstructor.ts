import type { Stringable } from '@skmtc/core'

/**
 * Arguments for {@link KtPrimaryConstructor}.
 */
export type KtPrimaryConstructorArgs = {
  /**
   * The parenthesized parameter list — typically a
   * {@link import('./KtParameterList.ts').KtParameterList}, which renders
   * its own `(\n…\n)`.
   */
  parameters: Stringable
  /**
   * Optional modifiers between the class name and the parameter list —
   * constructor annotations and/or a visibility keyword
   * (`@JsonCreator(mode = JsonCreator.Mode.DISABLED) private`). When
   * present, Kotlin REQUIRES the explicit `constructor` keyword; this
   * class adds it (that's the grammar rule the lang owns) —
   * `class Name @Anno private constructor(\n…\n)`. WHAT the modifiers
   * are is generator policy.
   */
  modifiers?: Stringable
}

/**
 * A primary constructor — the clause after the class name, owned by the
 * VALUE: a class value composes
 * `${primaryConstructor}${supertypeClause}${body}` and the definition
 * renders `${head}${value}`. Without modifiers this is just the
 * parameter list; the class exists for the modifier + explicit
 * `constructor`-keyword grammar rule.
 */
export class KtPrimaryConstructor {
  parameters: Stringable
  modifiers: Stringable | undefined

  constructor({ parameters, modifiers }: KtPrimaryConstructorArgs) {
    this.parameters = parameters
    this.modifiers = modifiers
  }

  toString(): string {
    const rendered = this.modifiers === undefined ? '' : `${this.modifiers}`
    const keyword = rendered.length ? ` ${rendered} constructor` : ''

    return `${keyword}${this.parameters}`
  }
}
