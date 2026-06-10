# RenderContext

> The Render-phase context. Serializes the file map produced by
> GenerateContext into `{ path: content }` artifact strings. Thin
> wrapper around `file.toString()` and path resolution.

## Source

`skmtc/deno/core/context/RenderContext.ts`

## Class

```ts
class RenderContext {
  files: Map<string, File | JsonFile>
  previews: Record<string, Preview>
  mappings: Record<string, Mapping>
  basePath: string | undefined
  logger: Logger
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void

  constructor(args: {
    files: Map<string, File | JsonFile>
    previews: Record<string, Preview>
    mappings: Record<string, Mapping>
    basePath: string | undefined
    logger: Logger
    captureCurrentResult: ...
  })

  render(stackTrail: StackTrail): Omit<RenderResult, 'results'>
  collate(stackTrail: StackTrail): FilesRenderResult
  getFile(filePath: string): File | JsonFile
  pick(args: PickArgs): Definition | undefined
}
```

## Output is unformatted by design

Render does not invoke any formatter. The `renderFile` helper takes
the `content` produced by `file.toString()`, resolves the artifact
path, and returns the metadata-wrapped result without modification:

```ts
const renderFile = ({ content, destinationPath, basePath }: RenderFileArgs): FileObject => {
  const path = toResolvedArtifactPath({ basePath, destinationPath })
  return {
    content,                            // ← unmodified
    path,
    destinationPath,
    lines: content.split('\n').length,
    characters: content.length
  }
}
```

Generated output is **unformatted** by design. Consumers run their
own formatter (Prettier, Biome, `deno fmt`) as a separate step —
typically in a pre-commit hook or build script.

## Constructor

Constructed internally by `toArtifacts`. Not typically instantiated
by generators.

## Properties

### `files: Map<string, File | JsonFile>`

The file map produced by GenerateContext. Keys are unresolved
destination paths (before `basePath` application). Values are
`File` or `JsonFile` instances depending on extension.

### `previews: Record<string, Preview>`, `mappings: Record<string, Mapping>`

Per-Projection preview and mapping metadata, forwarded from the
Generate phase. Render passes these through unchanged.

### `basePath: string | undefined`

The base path under which generated files land. Pulled from
`client.json#settings.basePath`. Applied by `toResolvedArtifactPath`
to compute final on-disk paths.

### `logger: Logger`

Structured logger.

### `captureCurrentResult: (result, stackTrail) => void`

Records per-file render outcomes into the manifest. Render-phase
results are typically all `'success'` because the heavy lifting
happened in Generate.

## Methods

### `render(stackTrail: StackTrail): Omit<RenderResult, 'results'>`

The Render-phase entry point. Calls `collate`, packages the result
with `previews` and `mappings`. Returns:

```ts
type RenderResult = {
  artifacts: Record<string, string>      // resolved path → content
  files: Record<string, {                // resolved path → metadata
    destinationPath: string
    lines: number
    characters: number
  }>
  previews: Record<string, Preview>
  mappings: Record<string, Mapping>
}
```

(The omitted `results` field comes from the manifest layer above.)

### `collate(stackTrail: StackTrail): FilesRenderResult`

The core serialization loop. Iterates `files`, calls
`file.toString()` on each, computes line/character metadata,
resolves paths against `basePath`.

```ts
type FilesRenderResult = {
  artifacts: Record<string, string>
  files: Record<string, FileMetadata>
}
```

Each file is stringified independently. There's no cross-file
operation in Render — by the time Render runs, every file's content
is fully determined by `file.toString()`.

### `getFile(filePath: string): File | JsonFile`

Look up a file by its (normalized) destination path. Throws if the
file isn't in the map.

```ts
const file = renderContext.getFile('./src/types/User.ts')
console.log(file.toString())  // the rendered content
```

### `pick({ name, exportPath }: PickArgs): Definition | undefined`

Look up a specific Definition by name within a file. Convenience
for inspecting generated content from outside the standard flow.

```ts
const userDef = renderContext.pick({
  name: 'User',
  exportPath: './src/models/User.ts'
})
```

## Examples

### What Render actually does (conceptually)

```ts
// Pseudocode of the core Render loop
for (const [path, file] of files) {
  const content = file.toString()  // ← imports + reExports + definitions joined
  const resolvedPath = join(basePath, path)
  artifacts[resolvedPath] = content
}
```

That's the entire transformation. No analysis, no per-file
optimization, no formatting.

### `file.toString()` shape

A `File.toString()` produces the assembled file content:

```ts
[reExports, imports, definitions]
  .filter(section => section.length > 0)
  .map(section => section.join('\n'))
  .join('\n\n')
```

Three sections separated by blank lines, in order: re-exports, then
imports, then definitions. Each section is empty-skipped if it has
no entries.

## Common questions

### Why doesn't Render run Prettier?

Two reasons:

1. **Format is the consumer's concern.** SKMTC produces syntactically
   valid TypeScript; aesthetic choices (semis, trailing commas,
   quote style) belong to the consumer's existing tooling.
2. **Coupling to a specific formatter would create friction.**
   Different consumer projects use different formatters (Prettier,
   Biome, dprint, custom). Picking one in SKMTC would force every
   consumer to either accept SKMTC's choice or post-process anyway.

The pragmatic stance is "produce valid, let the consumer format."

### Can I add formatting back into the pipeline?

You could — call Prettier in the host after `writeGeneratedFiles`.
The CLI doesn't do this, but a consumer running the engine
programmatically could. The cleanest pattern is a pre-commit hook
on the generated output directory, which runs Prettier independent
of SKMTC.

### Why is Render a separate phase if it's so simple?

For the same reason Parse and Generate are separate: the phase
boundary creates an invariant. Once Generate finishes, the file
map is the source of truth — no further mutation. Render reads;
Render doesn't transform.

This makes the manifest's structure consistent (every file in the
output was in the map at the end of Generate). It also makes
debugging easier — you can inspect the file map after Generate and
predict what Render will produce.

### Can I inject content during Render?

No — by design. If you want to inject content, do it during
Generate via `register({ ... })` calls. Render reads the file map
and serializes; it doesn't accept new contributions.

### How does `JsonFile` differ from `File`?

`JsonFile` is used for paths ending in `.json`. Its `toString()`
returns `JSON.stringify(content, null, 2)` rather than the
`reExports + imports + definitions` join. Generators register JSON
content via `registerJson` rather than `register`.

`File` is the default for everything else (`.ts`, `.tsx`, `.js`,
etc.).

## Related types

```ts
type RenderFileArgs = {
  content: string
  destinationPath: string
  basePath?: string
}

type FileObject = {
  content: string
  path: string
  destinationPath: string
  lines: number
  characters: number
}

type PickArgs = {
  name: string
  exportPath: string
}
```

## See also

- [The three phases concept](../../concepts/the-three-phases.md) — Render in context
- [API: GenerateContext](generate-context.md) — what produces the file map Render serializes
- [API: ParseContext](parse-context.md) — what runs before Generate
- [API: SnippetBase](dsl-snippet-base.md) — the `toString()` contract Render relies on
- [API: Definition](dsl-definition.md) — what `File.definitions` holds
- [Design philosophy](../../explanation/design-philosophy.md) — the "format is consumer's concern" principle
