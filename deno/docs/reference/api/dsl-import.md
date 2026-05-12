# Import

> The DSL class that renders an `import { X } from '...'` statement
> into a file. Constructed by File from accumulated import requests
> during serialization; rarely instantiated directly by generators.

`Import` is the *output* end of the import system. The *input* end is
the `register({ imports })` call on `GenerateContext` (or via
SnippetBase). Between input and output, the File accumulates import
names into a deduplicated `Map<module, Set<importNameKey>>`, then
materializes one `Import` per module entry at render time.

## Source

`skmtc/deno/core/dsl/Import.ts`

## Constructor

```ts
class Import {
  module: string
  importNames: ImportNameArg[]

  constructor(args: {
    module: string
    importNames: ImportNameArg[]
  })

  toString(): string
  toRecord(): Record<string, string>
}
```

## Properties

### `module`

The module specifier — the right-hand side of the `from` clause. May
be:

- A package name: `'@tanstack/react-query'`, `'zod'`
- A bare-package subpath: `'@tanstack/react-query/types'`
- A relative path: `'./User.generated'`, `'../../shared/types'`
- An alias-prefixed path: `'@/types/User'`

The engine preserves whatever string is passed in. Path resolution
(if any) is the consumer's responsibility — the file emits the
literal string into the import statement.

### `importNames`

The named imports for this statement. Each entry is either:

- A **string** — a plain runtime-value import (`X` → `import { X }`)
- An **object** `{ name, alias?, isType? }` — a flagged import with
  optional alias and/or type-only marking

```ts
type ImportNameArg = string | {
  name: string
  alias?: string
  isType?: boolean
}
```

## Methods

### `toString()`

Renders the import statement. The exact format depends on which
`importNames` are present:

```ts
// Bare names only
import { X, Y } from '@module'

// Aliased import
import { X as MyX } from '@module'

// Type-only import (single)
import { type X } from '@module'

// Mixed value + type imports
import { X, type Y } from '@module'

// All-type imports
import { type X, type Y } from '@module'
```

The rendering rules:

1. If all `importNames` are type-only, the single shared `type`
   keyword may be placed before the brace pair
   (`import type { X, Y } from ...`) — depends on the implementation.
2. If mixed value + type, each type-import is individually marked
   (`import { X, type Y } from ...`).
3. Aliases are emitted with the `as` keyword (`{ X as MyX }`).
4. Names are joined with `, ` inside the braces.

### `toRecord()`

Returns the imports as a plain record, useful for serialization or
diagnostics:

```ts
{ X: '@module', Y: '@module' }
```

Aliases use the alias as the key; type-only-ness is not represented
in the record.

## How `register({ imports })` populates Imports

The end-to-end flow:

### Step 1: Generator code calls `register`

```ts
this.register({
  imports: {
    'zod': ['z'],
    '@tanstack/react-query': [
      'useMutation',
      { name: 'UseMutationResult', isType: true }
    ]
  },
  destinationPath: this.settings.exportPath
})
```

### Step 2: GenerateContext.register routes to File

The context locates (or creates) the `File` at `destinationPath` and
calls `file.addImports(imports)`.

### Step 3: File accumulates into a deduplicated Map

`File.imports` is `Map<string /* module */, Set<string /* importNameKey */>>`.
The Set's key is a normalized string representation of the
`ImportNameArg` (e.g., `'X'`, `'type:Y'`, `'X as MyX'`). Duplicates
are silently elided.

### Step 4: At render time, File constructs Imports

```ts
// In File.toString()
const imports: Import[] = []
for (const [module, nameKeySet] of this.imports) {
  const importNames = Array.from(nameKeySet).map(parseKeyToImportName)
  imports.push(new Import({ module, importNames }))
}

const importsBlock = imports.map(i => i.toString()).join('\n')
return `${importsBlock}\n\n${definitions}`
```

### Step 5: Each Import.toString() emits a line

The final emitted file starts with one `import { ... } from '...';`
line per module the file uses, deduplicated and correctly typed.

## Dedup via `Set<importName>` in File

The Set holds a *normalized key* — not the raw `ImportNameArg`. The
key encodes:

- The name
- Whether it's a type-only import
- Whether it has an alias (and what the alias is)

Two calls registering the same name + same isType + same alias collapse
into one entry. Two calls registering the same name with *different*
isType land as separate entries — meaning a name registered both as
value and as type would appear twice in the import statement (one
with `type`, one without). In practice, the same name is rarely
imported both ways from the same module.

If the first registration is `{ name: 'X', isType: true }` and a
subsequent call registers plain `'X'`, both keys land in the Set:

- `'type:X'`
- `'X'`

And the rendered output would be `import { X, type X } from ...` —
likely a bug in the calling code (it imported X two ways), but the
engine emits faithfully.

## Type-only import emission

The `EntityTypeValue` distinction (`'const'` vs `'type'`) drives the
`isType` flag on `ImportNameArg`. See [API: Identifier](dsl-identifier.md)
for how identifiers carry this distinction.

`Identifier.toImport()` produces the correct `ImportNameArg`:

```ts
Identifier.createVariable('useUser').toImport()
// → 'useUser'    (plain string, runtime value)

Identifier.createType('UserBody').toImport()
// → { name: 'UserBody', isType: true }
```

When a generator passes the result of `toImport()` to `register`, the
type-only-ness is preserved through the file's accumulation and
appears as `import { type UserBody }` in the rendered output.

This is **load-bearing under `verbatimModuleSyntax: true`** — the
TypeScript compile mode that requires type-only imports to be
explicitly marked. Generated artifacts that misclassify a type as a
value (or vice versa) fail compilation under verbatim mode.

## Examples

### Single value import

```ts
new Import({
  module: 'zod',
  importNames: ['z']
}).toString()
// → "import { z } from 'zod'"
```

### Mixed value + type from one module

```ts
new Import({
  module: '@tanstack/react-query',
  importNames: [
    'useMutation',
    { name: 'UseMutationResult', isType: true }
  ]
}).toString()
// → "import { useMutation, type UseMutationResult } from '@tanstack/react-query'"
```

### Aliased import

```ts
new Import({
  module: 'lodash',
  importNames: [{ name: 'merge', alias: 'lodashMerge' }]
}).toString()
// → "import { merge as lodashMerge } from 'lodash'"
```

### From a generator's `register` call

```ts
this.register({
  imports: {
    'zod': ['z'],
    '@/generated/User': [
      this.userBody.identifier.toImport(),   // 'userBody' (value)
      this.UserBody.identifier.toImport()    // { name: 'UserBody', isType: true }
    ]
  },
  destinationPath: this.settings.exportPath
})

// At render time, file emits:
//   import { z } from 'zod'
//   import { userBody, type UserBody } from '@/generated/User'
```

## Common questions

### Why is `Import` a class rather than just a string template?

Three reasons:

1. **Deduplication**: a class instance carries the parsed structure,
   so the File can deduplicate by content rather than by literal
   string.
2. **Type vs value flag**: the `isType` flag is a per-name property,
   not a per-module property. Mixed imports require structural
   representation.
3. **Future flexibility**: tracking imports as structured data lets
   the engine adjust the output format (e.g., sort, group, switch
   between `import { type X }` and `import type { X }`) without
   touching call sites.

### Can I create an Import directly?

You can, but you almost never should. The accepted path is to call
`register({ imports })` and let the File materialize Imports during
render. Direct construction skips the deduplication step and may
result in duplicate import lines in the output.

The one valid reason for direct construction is in low-level testing
of the Import rendering itself.

### What's an "alias" used for?

When the imported name collides with a name already in scope:

```ts
import { merge as lodashMerge } from 'lodash'
// because there's already a `merge` from somewhere else
```

Generators rarely need aliases — the names they generate are derived
from `operationId`/`refName`, which are unique within the file. But
when integrating with hand-written user code that already defines a
name, aliasing is a clean way to disambiguate.

### Does Import support default imports?

The standard `register` flow handles named imports. Default imports
(`import X from '...'`) are emitted via `defaultImports` on
`register`, which goes through a separate channel in File. The
default-import flow is similar to named imports but produces
`import X from '...'` syntax.

### Does Import support side-effect imports?

`import '@some/css-side-effect'` is supported via a slightly different
path on `register`. The Import class itself focuses on named imports;
the File's serialization step handles the side-effect-only case
separately.

## Related types

```ts
type ImportNameArg = string | {
  name: string
  alias?: string
  isType?: boolean
}

// Used by register on GenerateContext / SnippetBase
type RegisterArgsImports = Record<string /* module */, ImportNameArg[]>
```

## See also

- [API: Identifier](dsl-identifier.md) — produces ImportNameArgs via `toImport()`
- [API: GenerateContext](generate-context.md) — `register({ imports })` is the entry point
- [API: SnippetBase](dsl-snippet-base.md) — the `register` helper inherited by Snippets and Projections
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — register's role
- [Glossary: Import, EntityType, verbatimModuleSyntax](../glossary.md)
