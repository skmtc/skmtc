# Identifier & entity types

> Source: `core/dsl/IdentifierBase.ts` (the neutral data class),
> `core/dsl/IdentifierType.ts` (the non-name identifier parts), and
> `lang-typescript/src/createIdentifier.ts` +
> `lang-typescript/src/TsIdentifier.ts` (the TypeScript subclass,
> factories, and type vocabulary). The naming layer lives in the
> lang package; core carries only neutral identifier data.

## IdentifierBase (`@skmtc/core`) — neutral data

```ts
export class IdentifierBase {
  name: string           // the identifier name; toString() returns it
  typeName?: string      // opaque type annotation (lang-interpreted)
  exported: boolean      // neutral visibility fact; defaults to true

  constructor(args: { name: string; typeName?: string; exported?: boolean })
  toString(): string     // -> name
  declarationKey(): string  // -> name (the file's dedup slot; languages override)
}
```

`IdentifierBase` is engine machinery: it rides `ContentSettings`, the
`(name, exportPath)` cross-generator cache key, and `DefinitionBase`.
The engine reads only `name`:

- **`name`** — the only field the engine interprets (the cache-key
  source).
- **`typeName`** — optional type annotation, opaque to the engine.
  TypeScript's `TsDefinition` renders it as `name: typeName`.
- **`exported`** — a language-neutral visibility fact the engine
  never interprets. TypeScript emits/omits `export`; Go capitalizes
  the name (visibility via casing); Rust prefixes `pub`.
- **`declarationKey()`** — the key a file dedups definitions under.
  The neutral default is the bare `name`; a language with a richer
  declaration space overrides it (see `TsIdentifier` below).

Crucially, `IdentifierBase` carries **no declaration-type field** —
no `kind`, no `type`. The per-language declaration vocabulary lives,
typed, on the language subclasses (`TsIdentifier.type`), and its
schema-derived form travels separately as `IdentifierType`.

## IdentifierType (`@skmtc/core`) — the non-name parts

```ts
// core/dsl/IdentifierType.ts
export type IdentifierType = {
  type: string          // per-language declaration type — opaque-boundary string
  typeName?: string
  exported?: boolean
}
```

This is what a projection config's `toIdentifierType` returns: the
non-`name` parts of the identifier, derived from the schema. The
engine assembles the full identifier as
`lang.toIdentifier({ name: toIdentifierName(args), ...toIdentifierType(subject, context) })`
and holds the result as `IdentifierBase`. Core never interprets
`type`; a lang veneer tightens the return to its own named form —
TypeScript's is `TsIdentifierType`
(`IdentifierType & { type: TsEntityType }`).

## TsIdentifier (`@skmtc/lang-typescript`) — the concrete subclass

```ts
export class TsIdentifier extends IdentifierBase {
  type: TsEntityType    // typed declaration vocabulary

  constructor(args: IdentifierBaseArgs & { type: TsEntityType })
  override declarationKey(): string   // -> `${toTsKeyword(type)} ${name}`
}
```

The renderer reads `type` to pick the declaration keyword and the
import form. The `declarationKey` override folds the keyword into
the dedup slot, so a `class Foo` and a `declare namespace Foo` —
distinct declarations the compiler legitimately merges — get
distinct keys instead of colliding.

Generators normally never call the constructor — they use the
factories below. Direct construction is the escape hatch for
language-package authors.

## The TypeScript factories (`@skmtc/lang-typescript`)

```ts
export type TsEntityType = 'variable' | 'type' | 'class' | 'interface' | 'namespace'

createVariable(name: string, args?: { typeName?: string; exported?: boolean }): TsIdentifier
createType(name: string, args?: { exported?: boolean }): TsIdentifier
createClass(name: string, args?: { exported?: boolean }): TsIdentifier
createInterface(name: string, args?: { exported?: boolean }): TsIdentifier
createNamespace(name: string, args?: { exported?: boolean }): TsIdentifier

toTsKeyword(type: string): string   // 'variable' -> 'const', 'namespace' -> 'declare namespace'; throws otherwise
isBlockType(type: TsEntityType): boolean   // class | interface | namespace
isTypeOnly(type: TsEntityType): boolean    // type | interface
```

```ts
import { createVariable, createType } from '@skmtc/lang-typescript'

createVariable('userBody')                                  // export const userBody = ...
createVariable('useCreateUser', { typeName: 'UseMutationResult<...>' })
                                                            // export const useCreateUser: UseMutationResult<...> = ...
createType('UserBody')                                      // export type UserBody = ...
createVariable('helper', { exported: false })               // const helper = ... (no export)
```

The five entity types split two ways:

1. **Declaration form** — `'variable'` and `'type'` are
   assignment-form (`export <kw> Name = value;`); `'class'`,
   `'interface'`, and `'namespace'` are block-form
   (`export <kw> Name <value>` — the value carries heritage and the
   braced body, no `= …`, no trailing `;`). See `isBlockType`.
2. **Import form** — `'type'` and `'interface'` import type-only
   (`import { type X }`), avoiding TS1484 under
   `verbatimModuleSyntax`; `'variable'`, `'class'`, and
   `'namespace'` import as plain named imports. See `isTypeOnly`.

The declaration keyword mapping is a single exhaustive map
(`tsDeclarationKeywords` in `createIdentifier.ts`); `toTsKeyword`
throws on a type outside the vocabulary — the loud signal that an
identifier built for another language reached the TypeScript
renderer.

## Removed API (for readers of older code)

| Old (core 0.8.0 and earlier) | Now |
|---|---|
| `Identifier` class in core carrying a `kind` / entity-type field | `IdentifierBase` (name, typeName, exported — no declaration type) + the lang subclass `TsIdentifier.type` |
| `Identifier.createVariable` / `Identifier.createType` statics | `createVariable` / `createType` (+ `createClass` / `createInterface` / `createNamespace`) functions from `@skmtc/lang-typescript`, returning `TsIdentifier` |
| `Identifier.entityType` (an `EntityType` instance) | `TsIdentifier.type` (typed `TsEntityType`) |
| `EntityType` class / `EntityTypeValue` (core) | `TsEntityType` + `toTsKeyword` in `@skmtc/lang-typescript`; core has no keyword mapping |
| `Identifier.toImport()` | gone (no consumers). Drivers build imports through the lang package; hand-registered imports tag types explicitly: `{ name, type: 'type' }` |
| Private constructor (factory-only construction) | public constructor — language packages construct directly |

## Naming conventions (unchanged)

Derive names deterministically inside `toIdentifierName` — method +
path for operations (via `camelCase` / `capitalize` / `toMethodVerb`
from `@skmtc/core`), `refName` for models — and role-suffix them
(`Form`, `Hook`, `Table`) for cache-key uniqueness — a bare noun
collides as soon as a second generator names the same item. See
`sanitizePropertyName` (from `@skmtc/lang-typescript`) for
schema-supplied object keys.
