/**
 * Constructor arguments for {@link Identifier}.
 */
type ConstructorArgs = {
  /** The identifier name */
  name: string
  /** Optional type annotation, opaque to the engine (lang-interpreted) */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
  /** Opaque per-language declaration kind */
  kind: string
}

/**
 * A named entity in generated code — pure neutral data.
 *
 * `Identifier` is engine machinery: it rides `ContentSettings`, the
 * `(name, exportPath)` cross-generator cache key, and `DefinitionBase`.
 * Core never interprets its fields beyond `name`; everything
 * language-shaped lives in the language packages:
 *
 * - **Construction** goes through a language package's factory functions
 *   (e.g. `createVariable` / `createType` from `@skmtc/lang-typescript`),
 *   which pick the `kind` vocabulary for their language. Direct
 *   `new Identifier({ ... })` is the escape hatch for language authors.
 * - **`kind`** is an opaque per-language declaration discriminant — the
 *   language's `Definition` subclass maps it to a keyword (TypeScript:
 *   `'variable'` → `const`, `'type'` → `type`; Rust would add `struct` /
 *   `enum`; Kotlin `val` / `data class`).
 * - **`exported`** is a language-neutral visibility fact — TypeScript
 *   emits/omits `export`, Go capitalizes the name, Rust prefixes `pub`.
 * - **`typeName`** is an optional type annotation the engine never reads;
 *   TypeScript's `TsDefinition` renders it as `name: typeName`.
 *
 * @example Through a language factory (the normal path)
 * ```typescript
 * // createVariable / createType are exported by the language package
 * // (for TypeScript: the lang-typescript package)
 * const userName = createVariable('userName');
 * const userType = createType('User');
 *
 * console.log(userName.toString()); // 'userName'
 * console.log(userType.kind);       // 'type'
 * ```
 *
 * @example Direct construction (language-package authors)
 * ```typescript
 * import { Identifier } from '@skmtc/core';
 *
 * const structId = new Identifier({ name: 'User', kind: 'struct' });
 * ```
 */
export class Identifier {
  /** The identifier name */
  name: string

  /** Optional type annotation, opaque to the engine (lang-interpreted) */
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

  /**
   * Opaque per-language declaration kind — the discriminant a language's
   * `Definition` subclass reads to pick its declaration keyword.
   *
   * Sibling to {@link exported}: a language-neutral fact the engine never
   * interprets. Each language package owns its vocabulary and assigns
   * `kind` in its identifier factories. Rust is the forcing case for
   * opacity — `struct`, `enum` (native tagged = `oneOf`), and `type`
   * alias are all type-level entities, yet render with three different
   * keywords; only an opaque `kind` distinguishes them.
   */
  kind: string

  constructor({ name, typeName, exported, kind }: ConstructorArgs) {
    this.name = name
    this.typeName = typeName
    this.exported = exported ?? true
    this.kind = kind
  }

  /**
   * Returns the identifier name — the most common usage when the
   * identifier is interpolated into generated code.
   */
  toString(): string {
    return this.name
  }
}
