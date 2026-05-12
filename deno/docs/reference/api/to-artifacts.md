# toArtifacts

> The top-level engine function that runs the SKMTC generation
> pipeline end-to-end: **Parse → Generate → Render**. Returns the
> generated artifacts and the manifest. This is what the Worker
> invokes on `GENERATE` message receipt; direct callers (bench
> scripts, embedded use cases) can also invoke it.

Everything before `toArtifacts` (the CLI, the Worker bootstrap, the
generator map construction) is orchestration. Everything after it
is the engine. The function takes a parsed OAS-or-GQL document, a
client settings object, and a generator map factory — and produces
the artifacts and manifest.

## Source

`skmtc/deno/core/run/toArtifacts.ts`

## Signature

```ts
export async function toArtifacts<E = undefined>(
  args: TransformArgs<E>
): Promise<{
  artifacts: Record<string, string>
  manifest: ManifestContent
}>

export type TransformArgs<E> = {
  traceId: string
  spanId: string
  document: SkmtcDocumentInput
  settings: ClientSettings | undefined
  logsPath?: string
  stackTrail: StackTrail
  toGeneratorConfigMap: () => GeneratorsMapContainer<E>
  startAt: number
  silent: boolean
}
```

## Parameters

### `traceId` and `spanId`

Tracing IDs propagated from the CLI invocation. They thread through
the `StackTrail` and end up in log lines (when logging is enabled),
making it possible to correlate engine output with CLI runs.

The CLI generates a fresh `traceId` per invocation and emits a
`spanId` per child operation. Direct callers can pass any
unique-enough strings (e.g., timestamps + nonces).

### `document`

The parsed input document. Accepts either an OAS document object or
a GraphQL schema string:

```ts
type SkmtcDocumentInput =
  | { type: 'oas'; value: OpenAPIV3.Document<Record<string, never>> }
  | { type: 'gql'; value: string | GraphQLSchema }
```

Both variants carry the source as `value` — the field name is
uniform across protocols. For OAS, `value` is a normalized
`OpenAPIV3.Document` (Swagger 2 / OAS 3.1 inputs are
auto-converted to 3.0 by `@skmtc/convert` before reaching this
boundary). For GraphQL, `value` is either an SDL string (parsed
via `buildSchema` inside the pipeline) or a pre-built
`GraphQLSchema` instance (used as-is).

The post-parse internal shape is the parallel
[`SkmtcParsedDocument`](../../concepts/three-phases.md) union,
which also keys the protocol payload on `value` (`OasDocument` or
`GqlDocument`).

### `settings`

The validated [`ClientSettings`](../settings/client-json-schema.md)
from `client.json`. Carries:

- `basePath` — the output directory (relative to the manifest root)
- `paths` — per-operation path overrides
- `enrichments` — per-generator enrichment payloads
- `skip` — operations to skip
- `exclude` — components to exclude

Pass `undefined` when running without a settings file (rare; most
callers have at least minimal settings).

### `toGeneratorConfigMap`

A **factory function** that returns the generator map. Called by
`toArtifacts` to obtain the current set of installed generators:

```ts
type GeneratorsMapContainer<E> = {
  generators: Record<string, GeneratorConfigInput<E>>
}

toGeneratorConfigMap: () => GeneratorsMapContainer<E>
```

**Why a factory function rather than the map directly?** It defers
construction until the engine is ready to consume it. This lets the
generator-bundling step (which may run lazily) happen at the right
point in the pipeline.

Each generator config carries its `Entry` (the `toOasOperationEntry`
/ `toModelEntry` result) and its enrichment schema. The engine
iterates the map to dispatch work.

### `stackTrail`

A `StackTrail` instance threading through Parse and Generate. Carries
the current "where in the document/generator graph are we" context
for error messages and diagnostics. See [API: StackTrail](stack-trail.md).

The CLI creates an empty `StackTrail` at the top of `toArtifacts`
and passes it down.

### `silent`, `logsPath`

#### `logsPath`

When set, structured logs are written to this path during the run.
When unset, logs are emitted via console only.

The CLI sets `logsPath` to a per-invocation directory under the
project's `.skmtc/logs/`. Direct callers typically omit it.

#### `silent`

When `true`, suppresses log output. The CLI sets `silent: false` for
normal runs; bench scripts and tests typically set `silent: true`.

#### `startAt`

A `performance.now()` (or `Date.now()`) snapshot taken before
`toArtifacts` is called. Used for the duration calculation in the
returned `ManifestContent`. The engine subtracts `startAt` from
`Date.now()` at the end of the run to compute total elapsed time.

## Returns

```ts
Promise<{
  artifacts: Record<string, string>
  manifest: ManifestContent
}>
```

### `artifacts`

Map from absolute artifact path → file contents (string). The path
keys include the basePath prefix when settings provide it; otherwise
they're relative to the artifact root.

The CLI writes each `[path, contents]` pair to disk as the post-engine
step. The engine itself doesn't touch the filesystem — `toArtifacts`
returns a pure value.

### `manifest`

```ts
type ManifestContent = {
  files: Record<string, ManifestFileEntry>
  durationMs: number
  diagnostics: DiagnosticItem[]
  // ...
}
```

The manifest summarizes what was generated:

- **`files`** — per-artifact metadata (generator key, source operation
  or component, generation time)
- **`durationMs`** — total elapsed (using `startAt`)
- **`diagnostics`** — parse and generate issues, severity-ranked

The CLI writes the manifest to `manifest.json` alongside the
artifacts. Direct callers can inspect it for diagnostics or skip
writing it.

## Behavior

Internally, `toArtifacts` runs three sequential phases:

```
toArtifacts
  ├── 1. Parse:     document → OasDocument | GqlSchema (parsed model)
  ├── 2. Generate:  parsed model → File/Projection/Definition tree
  └── 3. Render:    file tree → artifacts (Record<path, contents>)
```

Each phase creates and tears down its own context (`ParseContext`,
`GenerateContext`, `RenderContext`). See [the three phases concept](../../concepts/the-three-phases.md)
for the detailed flow.

The phases are sequential and synchronous within the engine (the
function is `async` for I/O readiness, not concurrency). Errors from
Parse cascade to Generate via `removeErroredItems` (one-hop pruning);
Generate errors don't cascade to Render — the partial output is
emitted.

## Example

### From a bench script

When you want to measure engine performance without the CLI/worker
overhead:

```ts
import { toArtifacts, StackTrail } from '@skmtc/core'
import { toGeneratorConfigMap } from './my-generators.ts'

const startAt = performance.now()
const result = await toArtifacts({
  traceId: 'bench-001',
  spanId: 'bench-001',
  document: { type: 'oas', value: openApiSpec },
  settings: clientSettings,
  stackTrail: new StackTrail(),
  toGeneratorConfigMap,
  startAt,
  silent: true
})

console.log(
  `Generated ${Object.keys(result.artifacts).length} files in ${result.manifest.durationMs}ms`
)
```

### From the Worker

The standard production path. Worker boots, receives `GENERATE`
message, calls `toArtifacts`, posts result back:

```ts
self.addEventListener('message', async (event) => {
  if (event.data.type === 'GENERATE') {
    const { artifacts, manifest } = await toArtifacts(event.data.args)
    self.postMessage({ type: 'RESULT', artifacts, manifest })
  }
})
```

This is what `skmtc generate` triggers.

### From tests

Tests of generator behavior typically build a minimal `openApiSpec`
fixture, call `toArtifacts`, and assert on
`result.artifacts['some/path.ts']`:

```ts
test('zod generator emits userBody for User schema', async () => {
  const result = await toArtifacts({
    traceId: 't',
    spanId: 't',
    document: { type: 'oas', value: minimalSpec },
    settings: undefined,
    stackTrail: new StackTrail(),
    toGeneratorConfigMap: () => ({ generators: { zod: ZodEntry } }),
    startAt: 0,
    silent: true
  })

  expect(result.artifacts['models/User.generated.ts']).toContain('z.object')
})
```

## Common questions

### Why does `toArtifacts` need a `toGeneratorConfigMap` *function* rather than just a map?

Deferred construction. The map factory is called once, at the top of
the engine run, after Parse has produced the document. This lets
generator initialization happen lazily — useful when generator
construction is expensive, when generator selection depends on
runtime state, or when the engine needs to control the timing of
side effects in generator entry code.

In practice, most callers' factories are simply
`() => ({ generators: {...} })` with a static map. The function
indirection has minimal cost.

### Does `toArtifacts` write to disk?

No. The function is pure: it returns artifacts as in-memory
`Record<path, contents>`. Disk writes happen in the CLI's
worker-result handler, after `toArtifacts` returns.

This separation makes the engine testable (no fs cleanup) and
embeddable (callers can route artifacts to any sink — git commits,
in-memory diffs, S3, etc.).

### What's the relationship between `toArtifacts` and the CLI?

The CLI handles:

1. Bootstrap (load `deno.json`, `client.json`)
2. Pre-parse OAS host-side (for the `structuredClone` reason)
3. Spawn the worker
4. Pass the args (which include the pre-parsed document) to the
   worker
5. Worker calls `toArtifacts`
6. CLI receives the result and persists artifacts + manifest

`toArtifacts` is step 5. Steps 1–4 and 6 are CLI orchestration. See
[the three phases](../../concepts/the-three-phases.md) for the
full lifecycle.

### Why `async` if the phases are synchronous?

The `async` is there for the few I/O moments the engine might invoke
(e.g., dynamic generator loading in some paths). It's not used for
concurrency between phases — the phases run sequentially.

The `async` also gives the function a future-compatible signature:
if any phase later needs awaitable work, the caller signature
doesn't change.

### Can I run multiple `toArtifacts` invocations in parallel?

Yes, but each call should get fresh `StackTrail` and unique
`traceId` instances. The function itself is reentrant — its
in-memory state lives in the contexts it creates, not in module
globals.

In practice, parallelism across invocations is uncommon. The Worker
serves one request at a time, and bench scripts typically run
sequentially.

## Related types

```ts
type SkmtcDocumentInput =
  | { type: 'oas'; value: OpenAPIV3.Document<Record<string, never>> }
  | { type: 'gql'; value: string | GraphQLSchema }

type GeneratorsMapContainer<E> = {
  generators: Record<string, GeneratorConfigInput<E>>
}

type ManifestContent = {
  files: Record<string, ManifestFileEntry>
  durationMs: number
  diagnostics: DiagnosticItem[]
}
```

## See also

- [The three phases concept](../../concepts/the-three-phases.md) — Parse → Generate → Render in detail
- [The worker runtime concept](../../concepts/the-worker-runtime.md) — how toArtifacts is invoked
- [API: ParseContext](parse-context.md) — phase 1
- [API: GenerateContext](generate-context.md) — phase 2
- [API: RenderContext](render-context.md) — phase 3
- [API: StackTrail](stack-trail.md) — tracing parameter
- [Reference: client.json schema](../settings/client-json-schema.md) — what `settings` carries
- [Glossary: toArtifacts, Manifest, Artifact](../glossary.md)
