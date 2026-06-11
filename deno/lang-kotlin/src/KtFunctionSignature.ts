import type { Stringable } from '@skmtc/core'
import type { KtAnnotation } from './KtAnnotation.ts'

/** A single parameter of a Kotlin function signature. */
export type KtFunctionParameterArgs = {
  /**
   * The FINAL parameter name — already sanitized by the generator
   * (`sanitizePropertyName(camelCase(wireName))`); may be backticked.
   */
  name: string
  type: Stringable
  /** Whether the type is nullable (`Type?`). */
  nullable?: boolean
  /** Inline annotations rendered before the name (e.g. `@PathVariable("…")`). */
  annotations?: KtAnnotation[]
}

/**
 * Renders a Kotlin function parameter: `@PathVariable("id") id: String`,
 * `verbose: Boolean?`.
 *
 * Grammar only — WHICH annotations to attach (`@PathVariable`,
 * `@RequestParam`, `@RequestBody`) is generator policy riding
 * {@link import('./KtAnnotation.ts').KtAnnotation}. Distinct from
 * {@link import('./KtParameterList.ts').KtParameterArgs} (primary-constructor
 * parameters, `val` prefix + defaults) — the two are different productions.
 */
export class KtFunctionParameter {
  name: string
  type: Stringable
  nullable: boolean | undefined
  annotations: KtAnnotation[] | undefined

  constructor({ name, type, nullable, annotations }: KtFunctionParameterArgs) {
    this.name = name
    this.type = type
    this.nullable = nullable
    this.annotations = annotations
  }

  toString(): string {
    const annotations = this.annotations?.length
      ? this.annotations.map(annotation => `${annotation} `).join('')
      : ''
    const nullable = this.nullable ? '?' : ''

    return `${annotations}${this.name}: ${this.type}${nullable}`
  }
}

/**
 * Constructor arguments for {@link KtFunctionSignature}.
 */
export type KtFunctionSignatureArgs = {
  /** The FINAL method name — already derived/sanitized by the generator. */
  name: string
  parameters: KtFunctionParameterArgs[]
  /** Omitted → no `: T` (Kotlin's implicit `Unit`). */
  returnType?: Stringable
  /** Annotations rendered one per line above the signature (e.g. `@GetMapping("…")`). */
  annotations?: KtAnnotation[]
}

/**
 * Renders a Kotlin abstract-method signature — the building block of an
 * `interface` body (the Spring "interfaceOnly" idiom):
 *
 * ```kotlin
 *     @GetMapping("/users/{id}")
 *     fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User
 * ```
 *
 * Indented one level (it lives inside an interface body); parameters on
 * one line (formatting is the consumer's formatter's job). Grammar only —
 * no body support (abstract methods), no `suspend`, no default values in
 * v1; the mapping annotations are generator policy.
 */
export class KtFunctionSignature {
  name: string
  parameters: KtFunctionParameter[]
  returnType: Stringable | undefined
  annotations: KtAnnotation[] | undefined

  constructor({ name, parameters, returnType, annotations }: KtFunctionSignatureArgs) {
    this.name = name
    this.parameters = parameters.map(parameter => new KtFunctionParameter(parameter))
    this.returnType = returnType
    this.annotations = annotations
  }

  toString(): string {
    const annotations = this.annotations?.length
      ? this.annotations.map(annotation => `    ${annotation}\n`).join('')
      : ''
    const parameters = this.parameters.join(', ')
    const returns = this.returnType !== undefined ? `: ${this.returnType}` : ''

    return `${annotations}    fun ${this.name}(${parameters})${returns}`
  }
}
