import { Identifier } from '@skmtc/core'

/**
 * Kotlin's declaration-kind vocabulary — the values this package writes
 * into the neutral `Identifier.kind` and the discriminator its renderers
 * narrow against.
 *
 * - `'data-class'` — a `data class Name(…)` DTO container.
 * - `'enum-class'` — an `enum class Name { … }` declaration.
 * - `'sealed-interface'` — a `sealed interface Name` (the `oneOf` idiom;
 *   in the vocabulary now, gen-side mapping is a named follow-up).
 * - `'typealias'` — a `typealias Name = …` declaration.
 * - `'val'` — a top-level `val Name = …` assignment (Kotlin's distinctive
 *   file-scope value, illegal in C#/PHP/Java).
 *
 * Unlike TypeScript, the kind does NOT drive import form — every Kotlin
 * import is `import pkg.Name`. It drives only the declaration shell.
 * Deferred kinds (`object`, `fun`, `interface`, `var`) arrive with the
 * milestones that need them; {@link toKtKeyword} throwing on them is the
 * desired behavior until then.
 */
export type KtEntityKind = 'data-class' | 'enum-class' | 'sealed-interface' | 'typealias' | 'val'

/**
 * Options shared by the identifier factories — every field optional, so
 * the common case stays `createDataClass(name)`.
 */
export type CreateKtIdentifierArgs = {
  /** Whether the identifier is public (Kotlin's default). Defaults to `true`; `false` renders `private`. */
  exported?: boolean
}

/**
 * Options for {@link createValue} — the only factory with a `typeName`
 * slot (the `val x: T = …` annotation).
 */
export type CreateValueArgs = {
  /** Optional type annotation for the `val` declaration. */
  typeName?: string
  /** Whether the identifier is public (Kotlin's default). Defaults to `true`; `false` renders `private`. */
  exported?: boolean
}

/**
 * Creates a `data class` identifier.
 *
 * @example
 * ```typescript
 * const user = createDataClass('User')
 * // KtDefinition renders: data class User(…)
 * ```
 */
export const createDataClass = (name: string, args: CreateKtIdentifierArgs = {}): Identifier => {
  return new Identifier({ name, exported: args.exported, kind: 'data-class' })
}

/**
 * Creates an `enum class` identifier.
 *
 * @example
 * ```typescript
 * const status = createEnumClass('Status')
 * // KtDefinition renders: enum class Status { … }
 * ```
 */
export const createEnumClass = (name: string, args: CreateKtIdentifierArgs = {}): Identifier => {
  return new Identifier({ name, exported: args.exported, kind: 'enum-class' })
}

/**
 * Creates a `sealed interface` identifier.
 *
 * @example
 * ```typescript
 * const animal = createSealedInterface('Animal')
 * // KtDefinition renders: sealed interface Animal
 * ```
 */
export const createSealedInterface = (
  name: string,
  args: CreateKtIdentifierArgs = {}
): Identifier => {
  return new Identifier({ name, exported: args.exported, kind: 'sealed-interface' })
}

/**
 * Creates a `typealias` identifier.
 *
 * @example
 * ```typescript
 * const userList = createTypeAlias('UserList')
 * // KtDefinition renders: typealias UserList = …
 * ```
 */
export const createTypeAlias = (name: string, args: CreateKtIdentifierArgs = {}): Identifier => {
  return new Identifier({ name, exported: args.exported, kind: 'typealias' })
}

/**
 * Creates a top-level `val` identifier — Kotlin's distinctive file-scope
 * value.
 *
 * @example Untyped value
 * ```typescript
 * const maxRetries = createValue('MAX_RETRIES')
 * // KtDefinition renders: val MAX_RETRIES = …
 * ```
 *
 * @example Typed value
 * ```typescript
 * const timeout = createValue('timeout', { typeName: 'Long' })
 * // KtDefinition renders: val timeout: Long = …
 * ```
 */
export const createValue = (name: string, args: CreateValueArgs = {}): Identifier => {
  const { typeName, exported } = args

  return new Identifier({ name, typeName, exported, kind: 'val' })
}

/**
 * Maps an identifier's opaque `kind` to its Kotlin declaration keyword.
 * Throws on a kind outside this language's vocabulary — a loud signal
 * that an identifier built for another language (or with a typo'd kind)
 * reached the Kotlin renderer.
 */
export const toKtKeyword = (kind: string): string => {
  switch (kind) {
    case 'data-class':
      return 'data class'
    case 'enum-class':
      return 'enum class'
    case 'sealed-interface':
      return 'sealed interface'
    case 'typealias':
      return 'typealias'
    case 'val':
      return 'val'
    default:
      throw new Error(`Unknown Kotlin entity kind: ${kind}`)
  }
}
