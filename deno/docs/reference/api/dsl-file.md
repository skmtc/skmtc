# File classes: FileBase, CodeFileBase, TsFile, JsonFile

> The in-memory file representations the Generate phase accumulates
> into and the Render phase serializes. Core defines the neutral
> abstract bases (`FileBase`, `CodeFileBase`); the concrete code file
> for TypeScript output is `TsFile` in `@skmtc/lang-typescript`.
> `JsonFile` holds a plain JSON object.

For the design rationale and the dedup rules that govern these
classes, see [files-and-dedup.md](../../concepts/files-and-dedup.md).
This page is the API-level reference.

## Source

- `skmtc/deno/core/dsl/FileBase.ts` — neutral abstract base
- `skmtc/deno/core/dsl/CodeFileBase.ts` — neutral code-file contract
- `skmtc/deno/lang-typescript/src/TsFile.ts` — the concrete TypeScript code file
- `skmtc/deno/core/dsl/JsonFile.ts` — JSON output files

(`core/dsl/MarkdownFile.ts` is a further `FileBase` sibling for
Markdown output; not documented here.)

## `FileBase` (core, abstract)

```ts
abstract class FileBase {
  path: string
  custom: Stringable | undefined

  constructor(args: { path: string })
  abstract toString(): string
}
```

Carries only what is common to *every* file — code or not: the
output `path` (the key in `GenerateContext`'s file map), an optional
free-form `custom` content slot, and the `toString()` render
contract. It holds no definitions, imports, or dedup policy — those
are code-file concerns.

`custom` is set through the register vocabulary's `custom` field
(last non-`undefined` write wins). On a code file it is the leading
banner (e.g. a codegen header); on an ad-hoc non-code file it can
carry the body.

## `CodeFileBase` (core, abstract)

```ts
abstract class CodeFileBase extends FileBase {
  abstract addDefinition(definition: DefinitionBase): void
  abstract addImports(imports: ImportBase[]): void
  abstract addReExports(reExports: ReExportBase[]): void
  abstract findDefinitions(query?: { name?: string; type?: string }): DefinitionBase[] | undefined
}
```

The base every language's *code* file extends. Pure contract — no
fields, no merge logic. Storage and the duplication/merge policy are
language-specific and live in the concrete lang subclass; the
language-blind engine speaks only these four neutral operations:
three writers driven by `context.register`, plus `findDefinitions`,
the read seam the cross-generator cache and file inspection use (the
cache resolves a single primary by name via
`findDefinitions({ name })?.[0]`).

Core also exports `matchDefinitions`, the neutral name/type filter
languages implement `findDefinitions` with.

## `TsFile` (`@skmtc/lang-typescript`, concrete)

```ts
class TsFile extends CodeFileBase {
  packages: ModulePackage[] | undefined
  definitions: Map<string, TsDefinition>
  imports: Map<string, TsImport>
  reExports: Map<string, TsReExport>

  constructor(args: { path: string; settings: ClientSettings | undefined })

  override addDefinition(definition: TsDefinition): void
  override addImports(incoming: TsImport[]): void
  override addReExports(incoming: TsReExport[]): void
  override findDefinitions(query?: { name?: string; type?: TsEntityType }): DefinitionBase[] | undefined
  override toString(): string
}
```

A `TsFile` instance lives at one key in `GenerateContext`'s file map
(`Map<path, FileBase>`). Generators do not construct it directly;
the lang package's `register` function
(`lang-typescript/src/register.ts`) creates it on first write to a
`destinationPath`, and the Drivers do the same on their paths.

### Properties

#### `definitions: Map<string, TsDefinition>`

Keyed by each identifier's **declaration slot**
(`TsIdentifier.declarationKey()` — `` `${keyword} ${name}` ``).
`addDefinition` gates writes with `Map.has` —
**first-write-wins per slot**. Subsequent registrations of the same
slot are silently dropped. Definitions that share a name but differ
in declaration type occupy *different* slots and both render — that
is how TypeScript declaration merging (a `class Foo` plus its
`declare namespace Foo`) is represented.

The Driver-side [`affirmDefinition`](../glossary.md#affirmdefinition)
integrity check runs *before* `register` is reached on cache hits;
it catches the case where two different generators land on the same
`(name, exportPath)` cache key.

#### `imports: Map<string, TsImport>`

Keyed by `TsImport.mergeKey()` (the module path). `addImports`
collapses incoming imports that share a key into the existing entry
via `TsImport.merge` — repeated registrations of the same
`(module, name)` pair render one import line.

#### `reExports: Map<string, TsReExport>`

Keyed by `TsReExport.mergeKey()` (the module path); merged via
`TsReExport.merge`. `TsReExport` groups value vs type-only
re-exports (which require different statements under
`verbatimModuleSyntax`).

#### `packages: ModulePackage[] | undefined`

Inherited from `ClientSettings.packages`. Drives
`normalizeModuleName` at render time (see below).

### `toString()`

Renders the file in fixed order:

```
custom (banner, when set)
↓
re-exports
↓
imports
↓
definitions
```

Empty sections are dropped. Non-empty sections join with double
newlines (`\n\n`); each section's items join with single newlines.
Import and re-export module names are re-keyed through
`normalizeModuleName` at render time. Definitions render primaries
first (insertion order), then same-name companions (the
declaration-merging layout: `class Foo … declare namespace Foo`).

The render contract is **no formatter, no Prettier, no Biome**. The
output is unformatted TypeScript by design; consumers run their own
formatter as a post-step. See
[concepts/the-three-phases.md](../../concepts/the-three-phases.md#phase-3-render).

## `JsonFile` (core)

```ts
class JsonFile extends FileBase {
  fileType: 'json'
  content: Record<string, unknown>

  constructor(args: { path: string; content: Record<string, unknown> })
  override toString(): string
}
```

Extends `FileBase` *directly* — a JSON file has a path and
serializes its content, and never touches definitions, imports, or
dedup ("JSON is a degenerate language"). Used for non-code output
(`package.json`, route manifests, configuration files):

- One field (`content`) instead of the three maps.
- `toString()` returns `JSON.stringify(content, null, 2)`.
- No dedup rules. Multi-writer JSON is not a use case the design
  optimizes for.

Populated via `GenerateContext.registerJson({ destinationPath, json })`
(`RegisterJsonArgs`). `registerMarkdown` is the Markdown sibling.

## `normalizeModuleName`

```ts
// lang-typescript/src/normalizeModuleName.ts (internal to the lang package)
type NormalizeModuleNameArgs = {
  destinationPath: string
  exportPath: string
  packages: ModulePackage[] | undefined
}

const normalizeModuleName = (args: NormalizeModuleNameArgs): string
```

Pure function used by `TsFile.toString()` to translate file-system
paths into package-name imports for monorepos. Not part of the
public `@skmtc/lang-typescript` export surface. Three cases:

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
const userFile = context.inspectedFiles.get('./generated/User.ts')
assertEquals(
  userFile!.findDefinitions()?.map(definition => definition.identifier.name),
  ['User']
)
```

(`inspectedFiles` is `GenerateContext`'s read-only view of the file
map; `getFile(path)` is the single-file read primitive.)

`findDefinitions()` with no query returns every definition;
`findDefinitions({ name })` / `findDefinitions({ type: 'class' })`
filter.

## Common gotchas

| Situation | What actually happens |
|---|---|
| Registering the same declaration slot twice in one file | First call wins; second is silently dropped via `Map.has` |
| Registering the same import name twice in one file | `TsImport.merge` collapses; one import line is rendered |
| Same definition name registered by two *different* generators | Driver's [`affirmDefinition`](../glossary.md#affirmdefinition) throws "Registered definition mismatch" before `register` is reached |
| Same name registered under two declaration types | Both render — TypeScript declaration merging (`class Foo` + `declare namespace Foo`), companion laid after the primary |
| Path `./pkg/X.ts` rendering as `@/X.ts` in some files | Same-package translation via `normalizeModuleName` — expected |

## See also

- [Concept: files, deduplication, and integrity](../../concepts/files-and-dedup.md)
- [Concept: how generators produce output](../../concepts/how-generators-produce-output.md)
- [Concept: composing output with Stringable](../../concepts/stringable-composition.md)
- [API: GenerateContext](generate-context.md) — `register`, `addFile`, the file map
- [API: RenderContext](render-context.md) — file iteration at Render time
- [Glossary: File](../glossary.md#file-dsl-class) and
  [JsonFile](../glossary.md#jsonfile)
