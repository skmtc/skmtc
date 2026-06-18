/**
 * Constructor arguments for {@link IdentifierBase}.
 */
export type IdentifierBaseArgs = {
  /** The identifier name */
  name: string
  /** Optional type annotation, opaque to the engine (lang-interpreted) */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * The language-neutral coordination surface of a named entity in generated
 * code — the minimal data the engine reads.
 *
 * `IdentifierBase` is engine machinery: it rides `ContentSettings`, the
 * `(name, exportPath)` cross-generator cache key, and `DefinitionBase`. The
 * engine reads ONLY `.name` (the cache-key source); `typeName` and
 * `exported` are language-neutral facts it threads but never interprets.
 * Crucially it carries NO `kind` — the per-language declaration vocabulary
 * lives, typed, on the language subclasses.
 *
 * It completes the neutral `*Base` family
 * (`CodeFileBase` / `DefinitionBase` / `ImportBase`): the concrete,
 * kind-carrying subclasses (`TsIdentifier`, `KtIdentifier`) live in the
 * `@skmtc/lang-*` packages and **extend** this base. Construction goes
 * through a language package's factories (`createVariable` / `createType`
 * for TypeScript; `createDataClass` / `createEnumClass` / … for Kotlin) or
 * the engine's assembly seam `lang.toIdentifier({ name, ...identifierType })`.
 * The engine holds the result as `IdentifierBase`; the language's `kind` is
 * read only by the language renderers, which narrow via an `instanceof`
 * guard (`isTsIdentifier` / `isKtIdentifier`).
 */
export class IdentifierBase {
  /** The identifier name — the only field the engine reads. */
  name: string

  /** Optional type annotation, opaque to the engine (lang-interpreted). */
  typeName?: string

  /**
   * Whether this identifier is exported.
   *
   * A language-neutral fact the engine never interprets — each language's
   * renderer decides what it means syntactically: TypeScript emits/omits
   * `export`, Go capitalizes the name (visibility via casing), others may
   * ignore it. Defaults to `true`.
   */
  exported: boolean

  constructor({ name, typeName, exported }: IdentifierBaseArgs) {
    this.name = name
    this.typeName = typeName
    this.exported = exported ?? true
  }

  /**
   * Returns the identifier name — the most common usage when the
   * identifier is interpolated into generated code.
   */
  toString(): string {
    return this.name
  }
}
