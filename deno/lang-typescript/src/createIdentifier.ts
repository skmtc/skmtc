import { Identifier } from '@skmtc/core'

/**
 * TypeScript's declaration-kind vocabulary — the values this package
 * writes into the neutral `Identifier.kind` and the discriminator its
 * renderers narrow against.
 *
 * - `'variable'` — value entities: `const` declarations and plain
 *   (`import { Foo }`) imports.
 * - `'type'` — type-level entities: `type` declarations and type-only
 *   (`import { type Foo }` / `import type { Foo }`) imports.
 *
 * (Formerly core's `EntityTypeValue` — moved here under F5/F6: each
 * language package owns its kind vocabulary; core keeps only the opaque
 * `kind` string.)
 */
export type TsEntityKind = 'variable' | 'type'

/**
 * Options for {@link createVariable} — every field optional, so the
 * common case stays `createVariable(name)`.
 */
export type CreateVariableArgs = {
  /** Optional type annotation for typed variables. */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * Options for {@link createType} — every field optional, so the common
 * case stays `createType(name)`.
 */
export type CreateTypeArgs = {
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}

/**
 * Creates a variable identifier — a value entity that declares with
 * `const` and imports as a plain named import.
 *
 * @example Untyped variable
 * ```typescript
 * const count = createVariable('count');
 * console.log(count.name); // 'count'
 * console.log(count.kind); // 'variable'
 * ```
 *
 * @example Typed variable
 * ```typescript
 * const userId = createVariable('userId', { typeName: 'string' });
 * // TsDefinition renders: export const userId: string = …;
 * ```
 */
export const createVariable = (name: string, args: CreateVariableArgs = {}): Identifier => {
  const { typeName, exported } = args

  return new Identifier({ name, typeName, exported, kind: 'variable' })
}

/**
 * Creates a type identifier — a type-level entity that declares with
 * `type` and imports type-only (`import { type Foo }`).
 *
 * @example
 * ```typescript
 * const userType = createType('User');
 * // TsDefinition renders: export type User = …;
 * ```
 */
export const createType = (name: string, args: CreateTypeArgs = {}): Identifier => {
  const { exported } = args

  return new Identifier({ name, exported, kind: 'type' })
}

/**
 * Maps an identifier's opaque `kind` to its TypeScript declaration
 * keyword. Throws on a kind outside this language's vocabulary — a
 * loud signal that an identifier built for another language (or with a
 * typo'd kind) reached the TypeScript renderer.
 */
export const toTsKeyword = (kind: string): string => {
  switch (kind) {
    case 'variable':
      return 'const'
    case 'type':
      return 'type'
    default:
      throw new Error(`Unknown TypeScript entity kind: ${kind}`)
  }
}
