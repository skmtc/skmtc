import { KtIdentifier } from './KtIdentifier.ts'

/**
 * Kotlin's declaration-type vocabulary — the typed `type` this package
 * writes onto its {@link KtIdentifier} and the discriminator its renderers
 * narrow against.
 *
 * - `'class'` — a concrete `class Name(…) { … }` declaration (the
 *   generated-controller idiom; the value composes its
 *   `KtPrimaryConstructor` and braced body).
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
 * Every kind names a REAL declaration — an identifier that never appears
 * in code is a contradiction. Raw whole-file content (static template
 * files) is a FILE fact, not a definition: it goes through the register
 * vocabulary's `custom` field (`FileBase.custom`), with no identifier
 * involved.
 *
 * Unlike TypeScript, the type does NOT drive import form — every Kotlin
 * import is `import pkg.Name`. It drives only the declaration shell.
 * Deferred kinds (`object`, `fun`, `var`, `const-val`) arrive with the
 * milestones that need them; {@link toKtEntityType} throwing on them is
 * the desired behavior until then.
 */
export type KtEntityType = (typeof ktEntityTypes)[number]

/**
 * Single source of truth for the vocabulary — {@link KtEntityType} derives
 * from it, so the type and the {@link isKtEntityType} guard cannot drift.
 */
const ktEntityTypes = [
  'class',
  'data-class',
  'enum-class',
  'interface',
  'sealed-interface',
  'typealias',
  'val'
] as const

const ktEntityTypeSet: ReadonlySet<string> = new Set(ktEntityTypes)

/**
 * Type guard — whether an opaque `type` string is one this language knows.
 */
export const isKtEntityType = (type: string): type is KtEntityType => ktEntityTypeSet.has(type)

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
  return new KtIdentifier({ name, exported: args.exported, type: 'class' })
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
  return new KtIdentifier({ name, exported: args.exported, type: 'data-class' })
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
  return new KtIdentifier({ name, exported: args.exported, type: 'enum-class' })
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
  return new KtIdentifier({ name, exported: args.exported, type: 'interface' })
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
  return new KtIdentifier({ name, exported: args.exported, type: 'sealed-interface' })
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
  return new KtIdentifier({ name, exported: args.exported, type: 'typealias' })
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

  return new KtIdentifier({ name, typeName, exported, type: 'val' })
}

/**
 * Narrow the engine's opaque `type: string` (from `Lang.toIdentifier`'s
 * neutral args) to this language's {@link KtEntityType} — cast-free, via
 * {@link isKtEntityType}. Throws on a type outside the vocabulary, a loud
 * signal that an identifier built for another language (or with a typo'd
 * type) reached the Kotlin renderer. (Unlike TypeScript there is no
 * keyword map here — the declaration keywords live on
 * {@link import('./KtIdentifier.ts').KtIdentifier}'s declaration-head
 * render, the only place they are used.)
 */
export const toKtEntityType = (type: string): KtEntityType => {
  if (!isKtEntityType(type)) {
    throw new Error(`Unknown Kotlin entity type: ${type}`)
  }

  return type
}
