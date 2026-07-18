import type { GenerateContextType, Stringable } from '@skmtc/core'
import { register } from './register.ts'

/**
 * Constructor arguments for {@link KtAnnotation}.
 */
export type KtAnnotationArgs = {
  context: GenerateContextType
  name: string
  /** Pre-quoted argument list rendered inside `(…)`; omitted → bare `@Name`. */
  args?: Stringable[]
  /**
   * Dotted package the annotation class lives in — self-registers
   * `import <packageName>.<name>` into `destinationPath`. Omitted for
   * default-scope annotations (`@Deprecated`, `@Suppress` — `kotlin.*`
   * needs no import): the annotation then only renders.
   */
  packageName?: string
  /**
   * The file the annotation renders into — where its import registers.
   * Always explicit, like every snippet: the parent knows its target
   * file, so every combination of these args is valid.
   */
  destinationPath: string
}

/**
 * Renders a Kotlin annotation: `@Serializable`, `@SerialName("user_id")`.
 *
 * A registering LEAF entity (the `TsHeritage` precedent): given a
 * `packageName` it registers its own class's import into
 * `destinationPath`, so the annotation and its import are one statement
 * that cannot drift apart. It registers unconditionally — a same-package
 * annotation's import is dropped centrally by `KtFile`'s render-time
 * suppression, so callers need no such check. Container renderers
 * ({@link KtAnnotations}, `KtParameterList`, `KtFunctionSignature`) stay
 * pure and just interpolate.
 *
 * NOT a `KtSnippet` subclass: `KtDefinition` imports {@link toKtAnnotations}
 * from this module, so extending `KtSnippet` would close a load-time module
 * cycle (`KtSnippet → KtLang → KtDefinition → KtAnnotation → KtSnippet`).
 * It calls this package's {@link register} function directly instead — the
 * same write path `KtSnippet.register` delegates to.
 *
 * Generic grammar only — args are {@link Stringable} and pre-quoted by the
 * caller. WHICH annotation to emit is generator policy (the serialization
 * seam lives in `gen-kotlin`); this package only renders what it is handed.
 */
export class KtAnnotation {
  name: string
  args: Stringable[]

  constructor({ context, name, args = [], packageName, destinationPath }: KtAnnotationArgs) {
    this.name = name
    this.args = args

    if (packageName !== undefined) {
      register(context, {
        imports: { [packageName]: [name] },
        destinationPath
      })
    }
  }

  toString(): string {
    return this.args.length ? `@${this.name}(${this.args.join(', ')})` : `@${this.name}`
  }
}

/**
 * The protocol by which a Definition's VALUE supplies class-level
 * annotations to {@link import('./KtDefinition.ts').KtDefinition}.
 *
 * `Lang.toDefinition`'s neutral signature has no annotations slot, so
 * annotations ride on the value: a generator's projection sets an
 * `annotations` field, and `KtDefinition.toString()` collects it via
 * {@link toKtAnnotations} and renders the annotations above the
 * declaration head.
 */
export type KtAnnotated = {
  annotations: KtAnnotation[]
}

const isKtAnnotated = (value: unknown): value is KtAnnotated => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (!('annotations' in value)) {
    return false
  }

  return (
    Array.isArray(value.annotations) &&
    value.annotations.every(item => item instanceof KtAnnotation)
  )
}

/**
 * A class-level annotation block — zero or more {@link KtAnnotation}s,
 * rendered one per line above a declaration head. Empty renders the empty
 * string, so it interpolates unconditionally
 * (`${annotations}${head}${value}`).
 */
export class KtAnnotations {
  annotations: KtAnnotation[]

  constructor(annotations: KtAnnotation[] = []) {
    this.annotations = annotations
  }

  toString(): string {
    return this.annotations.map(annotation => `${annotation}\n`).join('')
  }
}

/**
 * Collect a value's {@link KtAnnotated} protocol field into a
 * {@link KtAnnotations} block — empty when the value carries none, so the
 * caller renders it without a guard.
 */
export const toKtAnnotations = (value: unknown): KtAnnotations => {
  return new KtAnnotations(isKtAnnotated(value) ? value.annotations : [])
}
