import { KtIdentifier } from './KtIdentifier.ts'

/**
 * Kotlin's declaration-kind vocabulary — the typed `kind` this package
 * writes onto its {@link KtIdentifier} and the discriminator its renderers
 * narrow against.
 *
 * - `'class'` — a concrete `class Name(…) { … }` declaration (the
 *   generated-controller idiom; constructor properties ride the
 *   `KtConstructed` value protocol).
 * - `'data-class'` — a `data class Name(…)` DTO container.
 * - `'enum-class'` — an `enum class Name { … }` declaration.
 * - `'interface'` — an `interface Name { … }` declaration (the Spring
 *   "interfaceOnly" idiom — abstract method signatures the consumer
 *   implements).
 * - `'sealed-interface'` — a `sealed interface Name` (the `oneOf` idiom).
 * - `'typealias'` — a `typealias Name = …` declaration.
 * - `'val'` — a top-level `val Name = …` assignment (Kotlin's distinctive
 *   file-scope value, illegal in C#/PHP/Java).
 *
 * - `'verbatim'` — NO shell: the value renders as-is (multi-declaration
 *   template files, where the identifier serves cache identity only —
 *   the gen-kotlin-sdk static-runtime idiom, note `32` §A5).
 *
 * Unlike TypeScript, the kind does NOT drive import form — every Kotlin
 * import is `import pkg.Name`. It drives only the declaration shell.
 * Deferred kinds (`object`, `fun`, `var`, `const-val`) arrive with the
 * milestones that need them; {@link toKtKeyword} throwing on them is the
 * desired behavior until then.
 */
export type KtEntityKind =
  | 'class'
  | 'data-class'
  | 'enum-class'
  | 'interface'
  | 'sealed-interface'
  | 'typealias'
  | 'val'
  | 'verbatim'

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
 * Creates a concrete `class` identifier.
 *
 * @example
 * ```typescript
 * const controller = createClass('UsersController')
 * // KtDefinition renders: class UsersController(…) { … }
 * ```
 */
export const createClass = (name: string, args: CreateKtIdentifierArgs = {}): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'class' })
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
export const createDataClass = (name: string, args: CreateKtIdentifierArgs = {}): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'data-class' })
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
export const createEnumClass = (name: string, args: CreateKtIdentifierArgs = {}): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'enum-class' })
}

/**
 * Creates an `interface` identifier.
 *
 * @example
 * ```typescript
 * const usersApi = createInterface('UsersApi')
 * // KtDefinition renders: interface UsersApi { … }
 * ```
 */
export const createInterface = (name: string, args: CreateKtIdentifierArgs = {}): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'interface' })
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
): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'sealed-interface' })
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
export const createTypeAlias = (name: string, args: CreateKtIdentifierArgs = {}): KtIdentifier => {
  return new KtIdentifier({ name, exported: args.exported, kind: 'typealias' })
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
export const createValue = (name: string, args: CreateValueArgs = {}): KtIdentifier => {
  const { typeName, exported } = args

  return new KtIdentifier({ name, typeName, exported, kind: 'val' })
}

/**
 * Creates a `verbatim` identifier — the value renders as-is with NO
 * declaration shell, visibility, or annotations. For content whose text
 * is already complete Kotlin (parameterized template files, bodies with
 * several top-level declarations); `name` serves cache identity only
 * and must be unique within the destination file.
 *
 * @example
 * ```typescript
 * const utils = createVerbatim('UtilsFileBody')
 * // KtDefinition renders the value's text untouched
 * ```
 */
export const createVerbatim = (name: string): KtIdentifier => {
  return new KtIdentifier({ name, kind: 'verbatim' })
}

/**
 * Maps an identifier's opaque `kind` to its Kotlin declaration keyword.
 * Throws on a kind outside this language's vocabulary — a loud signal
 * that an identifier built for another language (or with a typo'd kind)
 * reached the Kotlin renderer.
 */
export const toKtKeyword = (kind: string): string => {
  switch (kind) {
    case 'class':
      return 'class'
    case 'data-class':
      return 'data class'
    case 'enum-class':
      return 'enum class'
    case 'interface':
      return 'interface'
    case 'sealed-interface':
      return 'sealed interface'
    case 'typealias':
      return 'typealias'
    case 'val':
      return 'val'
    case 'verbatim':
      return ''
    default:
      throw new Error(`Unknown Kotlin entity kind: ${kind}`)
  }
}

/**
 * Narrow the engine's opaque `kind: string` (from `Lang.toIdentifier`'s
 * neutral args) to this language's {@link KtEntityKind} — cast-free, via a
 * validating switch. Throws on a kind outside the vocabulary, the same loud
 * signal {@link toKtKeyword} gives.
 */
export const toKtEntityKind = (kind: string): KtEntityKind => {
  switch (kind) {
    case 'class':
      return 'class'
    case 'data-class':
      return 'data-class'
    case 'enum-class':
      return 'enum-class'
    case 'interface':
      return 'interface'
    case 'sealed-interface':
      return 'sealed-interface'
    case 'typealias':
      return 'typealias'
    case 'val':
      return 'val'
    case 'verbatim':
      return 'verbatim'
    default:
      throw new Error(`Unknown Kotlin entity kind: ${kind}`)
  }
}
