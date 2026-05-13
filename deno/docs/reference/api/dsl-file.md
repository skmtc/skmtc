# File and JsonFile

> The in-memory file representations the Generate phase accumulates
> into and the Render phase serializes. `File` holds TypeScript
> output as three deduped maps; `JsonFile` holds a plain JSON
> object.

For the design rationale and the dedup rules that govern these
maps, see [files-and-dedup.md](../../concepts/files-and-dedup.md).
This page is the API-level reference.

## Source

- `skmtc/deno/core/dsl/File.ts`
- `skmtc/deno/core/dsl/JsonFile.ts`

## `File`

```ts
class File {
  path: string
  reExports: Map<string, Record<string, Set<string>>>
  imports: Map<string, Set<string>>
  definitions: Map<string, Definition>
  packages: ModulePackage[] | undefined

  constructor(args: { path: string; settings: ClientSettings | undefined })
  toString(): string
}
```

A `File` instance lives at one key in
`GenerateContext.#files: Map<path, File | JsonFile>`. Generators
do not construct it directly; `GenerateContext.#addFile` does, on
first registration.

### Properties

#### `path: string`

The output path. Same value as the key in `#files`. Passed to
`normalizeModuleName` when other files import from this one — so
that monorepo path remapping works (see "Cross-package translation"
below).

#### `imports: Map<string, Set<string>>`

Outer keys are source module specifiers (`'zod'`, `'./types/User.ts'`,
`'@/api/client'`); inner sets are the names imported from each
module. Populated by `context.register({ imports, destinationPath })`.

Dedup: `Set.add` collapses repeated registrations of the same
`(module, name)` pair. Two calls registering `{ zod: ['z'] }`
produce one entry in `Set<'z'>`.

#### `reExports: Map<string, Record<string, Set<string>>>`

Outer key: source module. Inner key: entity-type discriminator
(`'variable'` or `'type'`). Inner value: `Set` of re-exported
names. The two-level structure separates value re-exports from
type-only re-exports (which require different statements under
`verbatimModuleSyntax`).

Dedup: per-module-and-entity-type via `Set`.

#### `definitions: Map<string, Definition>`

Keyed by definition name. Populated by
`context.register({ definitions, destinationPath })`. The
`register` body uses `Map.has` to gate writes —
**first-write-wins**. Subsequent attempts to register a
definition with the same name are silently dropped.

The Driver-side [`affirmDefinition`](../glossary.md#affirmdefinition)
integrity check runs *before* `register` is reached on cache hits;
it catches the case where two different generators land on the
same `(name, exportPath)` cache key.

#### `packages: ModulePackage[] | undefined`

Inherited from `ClientSettings.packages`. Drives
`normalizeModuleName` at serialization time.

### `toString()`

Renders the file in fixed order:

```
re-exports
↓
imports
↓
definitions
```

Empty sections are dropped. Non-empty sections join with double
newlines (`\n\n`). Each section's items join with single newlines.

The render contract is **no formatter, no Prettier, no Biome**. The
output is unformatted TypeScript by design; consumers run their
own formatter as a post-step. See
[concepts/the-three-phases.md](../../concepts/the-three-phases.md#render-phase).

## `JsonFile`

```ts
class JsonFile {
  readonly fileType: 'json'
  path: string
  content: Record<string, unknown>

  constructor(args: { path: string; content: Record<string, unknown> })
  toString(): string
}
```

Sibling to `File` for non-code output (`package.json`,
`route-manifest.json`, configuration files). Far simpler:

- One field (`content`) instead of three maps.
- `toString()` returns `JSON.stringify(content, null, 2)`.
- No dedup rules — last-write-wins on conflicts. Multi-writer JSON
  is not a use case the design optimizes for.

Populated via `GenerateContext.register({ json, destinationPath })`
(the `RegisterJsonArgs` path).

## `normalizeModuleName`

```ts
type NormalizeModuleNameArgs = {
  destinationPath: string
  exportPath: string
  packages: ModulePackage[] | undefined
}

const normalizeModuleName = (args: NormalizeModuleNameArgs): string
```

Pure function used by `File.toString()` to translate file-system
paths into package-name imports for monorepos. Three cases:

| Situation | Result |
|---|---|
| `exportPath` lies inside a configured package, and `destinationPath` lies in the same package | `rootPath` is replaced with `@`, so `./packages/types/models/User.ts` becomes `@/models/User.ts` |
| `exportPath` lies inside a configured package, but `destinationPath` does not | the package's `moduleName` is returned (e.g., `@company/types`) |
| No package match | `exportPath` is returned unchanged |

Throws if a package matches by `rootPath` but has no `moduleName`
configured. See
[clone-vs-install.md](../../concepts/clone-vs-install.md) for how
`packages: ModulePackage[]` is configured.

## Examples

### Inspecting a file post-generation

Tests sometimes need to inspect the file map directly:

```ts
const context = new GenerateContext({ ... })
context.toArtifacts(stackTrail)
const userFile = context.files.get('./generated/User.ts')
assertEquals([...userFile!.definitions.keys()], ['User'])
```

### Computing path translations outside Render

```ts
import { normalizeModuleName } from '@skmtc/core'

const moduleSpecifier = normalizeModuleName({
  destinationPath: './packages/client/src/api.ts',
  exportPath: './packages/types/models/User.ts',
  packages: [
    { rootPath: './packages/types', moduleName: '@company/types' },
    { rootPath: './packages/client', moduleName: '@company/client' }
  ]
})
// → '@company/types'
```

## Common gotchas

| Situation | What actually happens |
|---|---|
| Registering the same `Definition` name twice in one file | First call wins; second is silently dropped via `Map.has` |
| Registering the same import name twice in one file | `Set.add` collapses; one import line is rendered |
| Same definition name registered by two *different* generators | Driver's [`affirmDefinition`](../glossary.md#affirmdefinition) throws "Registered definition mismatch" before `register` is reached |
| Multiple writers to the same `JsonFile.content` key | Last-write-wins; no dedup |
| Path `./pkg/X.ts` rendering as `@/X.ts` in some files | Same-package translation via `normalizeModuleName` — expected |

## See also

- [Concept: files, deduplication, and integrity](../../concepts/files-and-dedup.md)
- [Concept: how generators produce output](../../concepts/how-generators-produce-output.md)
- [Concept: composing output with Stringable](../../concepts/stringable-composition.md)
- [API: GenerateContext](generate-context.md) — `register`, `addFile`, the `#files` map
- [API: RenderContext](render-context.md) — file iteration at Render time
- [Glossary: File](../glossary.md#file-dsl-class) and
  [JsonFile](../glossary.md#jsonfile)
