# Identifier & entity kinds

> Source: `core/dsl/Identifier.ts` (the neutral data class) and
> `lang-typescript/src/createIdentifier.ts` (the TypeScript factories +
> kind vocabulary). The naming layer moved out of core under F5/F6 —
> `notes/lang/17-naming-layer-and-helpers-move.md`.

## Identifier (`@skmtc/core`) — neutral data

```ts
export class Identifier {
  name: string          // the identifier name; toString() returns it
  kind: string          // opaque per-language declaration kind
  exported: boolean     // neutral visibility fact; defaults to true
  typeName?: string     // opaque type annotation (lang-interpreted)

  constructor(args: { name: string; kind: string; exported?: boolean; typeName?: string })
  toString(): string    // -> name
}
```

`Identifier` is engine machinery: it rides `ContentSettings`, the
`(name, exportPath)` cross-generator cache key, and `DefinitionBase`.
Core never interprets any field beyond `name`:

- **`kind`** — each language package owns its vocabulary and assigns it
  in its factories. TypeScript uses `'variable' | 'type'`; Rust would
  use `'struct' | 'enum' | 'type'`; Kotlin `'data-class' | 'val'`, etc.
  The language's `Definition` subclass maps `kind` to a declaration
  keyword at render time.
- **`exported`** — a language-neutral visibility fact. TypeScript
  emits/omits `export`; Go capitalizes the name (visibility via
  casing); Rust prefixes `pub`.
- **`typeName`** — optional type annotation, opaque to the engine.
  TypeScript's `TsDefinition` renders it as `name: typeName`.

Generators normally never call the constructor — they use a language
package's factories. Direct construction is the escape hatch for
language-package authors (`new Identifier({ name: 'User', kind: 'struct' })`).

## The TypeScript factories (`@skmtc/lang-typescript`)

```ts
export type TsEntityKind = 'variable' | 'type'

createVariable(name: string, args?: { typeName?: string; exported?: boolean }): Identifier
createType(name: string, args?: { exported?: boolean }): Identifier
toTsKeyword(kind: string): string   // 'variable' -> 'const', 'type' -> 'type'; throws otherwise
```

```ts
import { createVariable, createType } from '@skmtc/lang-typescript'

createVariable('userBody')                                  // export const userBody = ...
createVariable('useCreateUser', { typeName: 'UseMutationResult<...>' })
                                                            // export const useCreateUser: UseMutationResult<...> = ...
createType('UserBody')                                      // export type UserBody = ...
createVariable('helper', { exported: false })               // const helper = ... (no export)
```

The kind a factory writes drives two things downstream:

1. **Declaration keyword** — `TsDefinition.toString()` calls
   `toTsKeyword(identifier.kind)`. A kind outside the TypeScript
   vocabulary throws — the loud signal that an identifier built for
   another language reached the TypeScript renderer.
2. **Import form** — `TsImport.fromIdentifier` (the Driver's
   cross-file import path) emits a type-only specifier
   (`import { type X }`) when `kind === 'type'`, avoiding TS1484
   under `verbatimModuleSyntax`. `TsReExport` likewise groups
   `export { x }` vs `export type { x }` by `kind`.

## Removed API (F6 — for readers of older code)

| Old (core 0.8.0 and earlier) | Now |
|---|---|
| `Identifier.createVariable` / `Identifier.createType` statics | `createVariable` / `createType` functions from `@skmtc/lang-typescript` (same call shape) |
| `Identifier.entityType` (an `EntityType` instance) | `Identifier.kind` (opaque string) |
| `EntityType` class / `EntityTypeValue` (core) | `TsEntityKind` + `toTsKeyword` in `@skmtc/lang-typescript`; core has no keyword mapping |
| `Identifier.toImport()` | gone (no consumers). Drivers use `TsImport.fromIdentifier`; hand-registered imports tag types explicitly: `{ name, type: 'type' }` |
| Private constructor (factory-only construction) | public constructor — language packages construct directly |

## Naming conventions (unchanged)

Derive names deterministically inside `toIdentifier` — method + path
for operations (via `camelCase` / `capitalize` / `toMethodVerb` from
`@skmtc/core`), `refName` for models — and role-suffix them (`Form`,
`Hook`, `Table`) for cache-key uniqueness. See the `skmtc-generator`
skill section on bare-noun identifiers, and `sanitizePropertyName`
(from `@skmtc/lang-typescript`) for schema-supplied object keys.
