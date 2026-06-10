# Import (ImportBase & TsImport)

> The import seam, split across the language boundary: core's neutral
> `ImportBase` (merge contract only) and `@skmtc/lang-typescript`'s
> `TsImport` (the concrete class that renders
> `import { X } from '...'` statements). Built by the lang package's
> register function and by Drivers; rarely instantiated directly.

The *input* end of the import system is the concise
`register({ imports })` call (typed by the lang package's
`TsRegisterArgs`). The conversion to structured `TsImport`s happens at
the register boundary; the file accumulates them in a neutral
`Map<mergeKey, ImportBase>` and renders them at serialization time.

## Source

- `skmtc/deno/core/dsl/ImportBase.ts` — the neutral contract
- `skmtc/deno/lang-typescript/src/TsImport.ts` — the TypeScript class

(The engine's legacy `core/dsl/Import.ts` was deleted when the lang
seam landed; `TsImport` renders identically.)

## ImportBase (`@skmtc/core`)

```ts
abstract class ImportBase {
  abstract mergeKey(): string                    // imports with the same key merge
  abstract merge(other: ImportBase): ImportBase  // combine two same-key imports
  abstract toString(): string                    // render the statement
}
```

Core stores and merges imports without interpreting them. Each
language ships its own subclass; the import-section *arrangement* is
the language file's concern (`TsFile.toString()`).

## TsImport (`@skmtc/lang-typescript`)

```ts
type TsImportSpecifier = {
  name: string        // '*' (with alias) is a namespace import
  alias?: string
  typeOnly: boolean   // drives `type X` / statement-level `import type`
}

class TsImport extends ImportBase {
  module: string
  specifiers: TsImportSpecifier[]

  constructor(module: string, specifiers: TsImportSpecifier[])

  static fromConcise(module: string, names: ImportNameArg[]): TsImport
  static fromIdentifier(module: string, identifier: Identifier): TsImport
}
```

- **`fromConcise`** converts the ergonomic form a generator passes to
  `register({ imports })` — the concise vocabulary lives only at this
  boundary.
- **`fromIdentifier`** builds the cross-file import a Driver registers
  when a generator references a peer's Definition; the identifier's
  `kind` drives `typeOnly` (`kind === 'type'` → `import { type X }`).
- **`merge`** dedups on the rendered specifier (matching the engine's
  legacy `Set<string>` semantics, where `type Foo` and `Foo` are
  distinct entries).

## ImportNameArg — the concise form

```ts
// lang-typescript/src/TsImport.ts
type ImportNameArg =
  | string                                            // 'X' — plain value import
  | { [name: string]: string }                        // { merge: 'lodashMerge' } — rename form
  | { name: string; alias?: string; type?: TsEntityKind }  // full form

type TsEntityKind = 'variable' | 'type'
```

Owned by `@skmtc/lang-typescript` (each language defines its own
concise vocabulary; the neutral engine never sees it). Set
`type: 'type'` for a type-only import; omitting `type` means a value
import.

## Rendering rules

- Per-name `type` tags render inline:
  `import { useForm, type UseFormProps } from 'react-hook-form'`
- When **every** specifier is type-only, the statement collapses to
  the statement-level form: `import type { A, B } from './types'`
- Aliases render as `X as Y` (`type X as Y` when type-only)
- `name: '*'` with an alias renders a namespace import:
  `import * as X from '...'`
- Module specifiers pass through literally; `@/...` paths resolve
  against the consumer's bundler alias (per-package when
  `client.json#settings.packages` is configured — cross-package
  imports render the target's `moduleName`)

This is **load-bearing under `verbatimModuleSyntax: true`** — the
compile mode that rejects bare value imports of types (TS1484).
Generated artifacts that misclassify a type as a value fail the
consumer's build.

## Examples

### From a generator's `register` call (the normal path)

```ts
this.register({
  imports: {
    'zod': ['z'],
    '@tanstack/react-query': [
      'useMutation',
      { name: 'UseMutationResult', type: 'type' }
    ],
    'lodash': [{ merge: 'lodashMerge' }]
  }
})

// Rendered:
//   import { z } from 'zod'
//   import { useMutation, type UseMutationResult } from '@tanstack/react-query'
//   import { merge as lodashMerge } from 'lodash'
```

### Deriving the tag from an Identifier you hold

```ts
this.register({
  imports: {
    '@/generated/User': [
      identifier.kind === 'type'
        ? { name: identifier.name, type: 'type' }
        : identifier.name
    ]
  }
})
```

(For peer Definitions inserted via `insertOperation` / `insertModel`
the Driver already registers the import with the right form via
`TsImport.fromIdentifier` — you only hand-tag imports you register
yourself.)

## See also

- [API: Identifier](dsl-identifier.md) — `kind` drives type-only imports
- [API: GenerateContext](generate-context.md) — the neutral `register` primitive
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
- [Glossary: Import, verbatimModuleSyntax](../glossary.md)
