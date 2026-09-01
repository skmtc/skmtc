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
  /** Optional default (` = …`) — e.g. `'null'` on optional seam params,
   * enabling named-args-only call sites. */
  defaultValue?: Stringable
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
  defaultValue: Stringable | undefined
  annotations: KtAnnotation[] | undefined

  constructor({ name, type, nullable, defaultValue, annotations }: KtFunctionParameterArgs) {
    this.name = name
    this.type = type
    this.nullable = nullable
    this.defaultValue = defaultValue
    this.annotations = annotations
  }

  toString(): string {
    const annotations = this.annotations?.length
      ? this.annotations.map(annotation => `${annotation} `).join('')
      : ''
    const nullable = this.nullable ? '?' : ''
    const defaultValue = this.defaultValue !== undefined ? ` = ${this.defaultValue}` : ''

    return `${annotations}${this.name}: ${this.type}${nullable}${defaultValue}`
  }
}

/**
 * A modifier rendered before `fun`. `suspend` is deliberately absent —
 * coroutine handlers are a WebFlux concern this grammar does not cover.
 */
export type KtFunctionModifier = 'override' | 'open' | 'private' | 'internal' | 'protected'

/**
 * Constructor arguments for {@link KtFunctionSignature}.
 */
export type KtFunctionSignatureArgs = {
  /** The FINAL method name — already derived/sanitized by the generator. */
  name: string
  /**
   * Modifiers rendered before `fun`, in the order given — Kotlin's own
   * convention is visibility first (`private override fun`).
   */
  modifiers?: KtFunctionModifier[]
  parameters: KtFunctionParameterArgs[]
  /** Omitted → no `: T` (Kotlin's implicit `Unit`). */
  returnType?: Stringable
  /** Annotations rendered one per line above the signature (e.g. `@GetMapping("…")`). */
  annotations?: KtAnnotation[]
  /** KDoc rendered above the annotations, indented with the signature. */
  description?: string
  /**
   * Expression body (` = …`), e.g. a delegation
   * (`service.getUsersId(id, verbose)`). Absent → the abstract form.
   * Block bodies are deliberately unsupported.
   */
  body?: Stringable
}

/**
 * Renders a Kotlin method signature — the building block of an
 * `interface` or `class` body:
 *
 * ```kotlin
 *     @GetMapping("/users/{id}")
 *     fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User
 * ```
 *
 * Indented one level (it lives inside a declaration body); parameters on
 * one line (formatting is the consumer's formatter's job). Abstract by
 * default; an expression `body` renders the delegation form (` = …` —
 * block bodies deliberately unsupported). Optional KDoc `description`
 * above the annotations and per-parameter `= default`. `modifiers`
 * renders `override fun` and friends. Grammar only — no `suspend`; the
 * mapping annotations are generator policy.
 */
export class KtFunctionSignature {
  name: string
  modifiers: KtFunctionModifier[] | undefined
  parameters: KtFunctionParameter[]
  returnType: Stringable | undefined
  annotations: KtAnnotation[] | undefined
  description: string | undefined
  body: Stringable | undefined

  constructor({
    name,
    modifiers,
    parameters,
    returnType,
    annotations,
    description,
    body
  }: KtFunctionSignatureArgs) {
    this.name = name
    this.modifiers = modifiers
    this.parameters = parameters.map(parameter => new KtFunctionParameter(parameter))
    this.returnType = returnType
    this.annotations = annotations
    this.description = description
    this.body = body
  }

  toString(): string {
    const kdoc = this.description ? `    /** ${this.description} */\n` : ''
    const annotations = this.annotations?.length
      ? this.annotations.map(annotation => `    ${annotation}\n`).join('')
      : ''
    const parameters = this.parameters.join(', ')
    const returns = this.returnType !== undefined ? `: ${this.returnType}` : ''
    const body = this.body !== undefined ? ` = ${this.body}` : ''
    const modifiers = this.modifiers?.length ? `${this.modifiers.join(' ')} ` : ''

    return `${kdoc}${annotations}    ${modifiers}fun ${this.name}(${parameters})${returns}${body}`
  }
}
