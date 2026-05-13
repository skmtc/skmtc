# The manifest

> The structured JSON record of every SKMTC generation run.
> Captures which files were written, which `(generator, item)`
> pairs succeeded, failed, or were skipped, what parse issues
> surfaced, and the source descriptors that tooling uses to map
> generated artifacts back to schema positions. Written after every
> run, regardless of exit code; the CI contract derives from it.

`manifest.json` is the canonical record of a run. The terminal
output is a summary; the manifest is the full story. CI pipelines
read it to decide pass/fail. IDE plugins read it to know what was
generated and where it came from. Agents read it to debug failed
runs without re-running.

This page covers what's in it, how each part is produced during
the pipeline, and what users do with it.

For the runtime mechanism that produces parse-time entries, see
[error-handling-philosophy.md](error-handling-philosophy.md). For
the wire-level Valibot schema, see
[reference/manifest-format.md](../reference/manifest-format.md).

## The one-line definition

A `ManifestContent` is a discriminated record of `{ files, results,
previews, mappings, parseIssues, deploymentId, traceId, spanId,
startAt, endAt }`. Each section is populated by a different point
in the pipeline: parsers contribute to `parseIssues`,
`GenerateContext.toArtifacts` contributes to `results`, generators
contribute to `previews` and `mappings`, the host contributes to
`files`. The
manifest is what lands at
`.skmtc/<project>/.settings/manifest.json` after every
`skmtc generate`, replacing the previous run's manifest.

## Top-level shape

```ts
// core/types/Manifest.ts:147-165
type ManifestContent = {
  deploymentId: string         // identifies the run
  traceId: string              // OpenTelemetry-shaped correlation key
  spanId: string               // sub-trace within deploymentId
  region?: string              // present only for hosted Sandbox API runs
  files: Record<string, ManifestEntry>          // every file written
  previews: Record<string, Preview>             // tooling-facing UI metadata
  mappings?: Record<string, Mapping>            // tooling-facing data mappings
  results: ResultsItem                          // nested tree of per-item outcomes
  parseIssues: ParseIssue[]                     // all parse-time diagnostics
  startAt: number                               // unix ms
  endAt: number                                 // unix ms; (endAt - startAt) = wall time
}
```

Each section is independent in two senses: it's populated by a
distinct phase, and consumers tend to read one or two sections
rather than the whole manifest.

## `files` — what was written

```ts
type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
}
```

One entry per generated file. The key is the file's path under
`basePath`. The value carries metrics about the file's size and
its destination on disk.

The map is populated by the host process — *not* the worker —
after the worker returns its file map. The CLI writes each
artifact and records the metrics. This is the only section the
worker doesn't fully control.

A consumer asking "did SKMTC generate the User type?" reads
`files['./types/User.ts']`. A missing entry means no file was
written, regardless of what `toArtifacts`'s `results` say.

## `results` — what happened per `(generator, item)` pair

```ts
// core/types/Results.ts
type ResultType = 'success' | 'warning' | 'error' | 'skipped' | 'notSupported'

interface ResultsItem {
  [key: string]: ResultType | ResultsItem | null | Array<ResultsItem | null>
}
```

A recursive nested tree. Keys come from `stackTrail.toString()`
captured at each call site. A typical path:

```
trace-1778185255674
└── span-1778185255674
    └── generate
        ├── @skmtc/gen-shadcn-form
        │   ├── mutation_CreateApplicant: "success"
        │   ├── query_GetApplicants:      "notSupported"
        │   └── mutation_UpdateApplicant: "skipped"
        └── @skmtc/gen-zod
            ├── ApplicantModel:           "success"
            └── ErrorResponseModel:       "error"
```

Each leaf is one of five `ResultType` values:

| Result | Meaning |
|---|---|
| `success` | Generator ran for this item; the `transform` returned without throwing |
| `warning` | Generator ran; logged a recoverable issue via `logger.warn` |
| `error` | Generator's `transform` threw, or logged via `logger.error`; output may be missing or partial |
| `skipped` | Item matched the generator's `isSupported` but was filtered out by `client.json#settings.include` or `.skip` |
| `notSupported` | Generator's `isSupported({ operation })` returned `false` for this item — expected, not a failure |

### How results get into the tree

`GenerateContext.toArtifacts` calls `captureCurrentResult(result,
stackTrail)` at four points in each per-item iteration (see
`GenerateContext.ts:390-431`):

- On `isSupported` returning false → `'notSupported'`
- On `include` filter rejecting → `'skipped'`
- On `skip` filter matching → `'skipped'`
- On `transform` returning normally → `'success'`
- On `transform` throwing → `'error'` (in the catch block)

Additionally, the `ResultsHandler` (a Deno log handler attached to
the pipeline's logger) converts any `logger.warn` call to a
`'warning'` result and any `logger.error` call to an `'error'`
result. So a generator that logs a warning mid-execution
contributes a `'warning'` leaf alongside whatever final state
`toArtifacts` captures.

Two mental models worth keeping clear:

- **`success` does not mean "produced output".** It means
  "transform executed without throwing." A generator whose
  `transform` doesn't call `register` or `insert*` will still log
  `'success'`. Diagnose silent no-output bugs by checking `files`
  for the expected path, not the `results` tree.
- **`notSupported` is normal.** If five generators are configured
  and three apply to a given operation, the other two write
  `'notSupported'` for it. This is the expected shape, not a
  failure.

## `previews` and `mappings` — for tooling

```ts
// core/types/Preview.ts
type Preview = { module: PreviewModule; source: Source }
type Mapping = { module: MappingModule; source: Source }

type PreviewModule = { name: string; exportPath: string }
type MappingModule = { name: string; exportPath: string; schema: string }

type Source =
  | { type: 'oasOperation'; generatorId: string; operationPath: string; operationMethod: Method }
  | { type: 'gqlOperation'; generatorId: string; rootKind: GqlRootKind; fieldName: string }
  | { type: 'model'; generatorId: string; refName: string }
```

Both maps are populated by `toArtifacts` after each per-item
`transform` call. `toArtifacts` invokes the generator's optional
`toPreviewModule({ context, operation })` and
`toMappingModule({ context, operation })` (or the model/gql
variants) and pairs the returned module with a source descriptor
identifying which `(generator, item)` produced it.

A `Preview` says: "Generator `X` produced a UI-renderable artifact
named `Y` at file `Z`, derived from this `(path, method)` of the
source schema." `Mapping` adds a `schema` field — typically used
to declare input adapters or formatters keyed to a specific schema
type.

Most stock generators don't implement these hooks. The ones that
do (the form, table, and select generators) feed the SKMTC UI and
IDE plugins so users can visually link a generated form back to
its `POST /users` operation. If your toolchain doesn't have such
a UI, you can ignore these sections — they don't affect file
output or exit codes.

## `parseIssues` — what happened during Parse

```ts
type ParseIssue =
  | { protocol: 'oas' | 'gql'; level: 'error'; type, location, message, cause? }
  | { protocol: 'oas' | 'gql'; level: 'warning'; type, location, message }
```

The full diagnostic stream from the Parse phase. Includes:

- Schema-level errors (`INVALID_SCHEMA`, `INVALID_OPERATION`, etc.)
- Cascade-pruning entries (`INVALID_DEPENDENCY_REF`)
- Type-inference warnings (`MISSING_OBJECT_TYPE`, etc.)
- Unknown-property warnings (`UNEXPECTED_PROPERTY`)

For the full list of `type` values, see
[reference/error-codes.md](../reference/error-codes.md).

`location` is the StackTrail's `toString()` output — a
colon-separated path to where the issue originated. See
[the-stack-trail.md](the-stack-trail.md#tostring--colons-with-3a-escape).

This array is the **exit-code source of truth**: the CLI returns
exit 1 if `parseIssues.some(i => i.level === 'error')` is true,
exit 0 otherwise (unless `--typecheck` failed). Whole-run failure
is achieved by logging an error-level parse issue.

## Lifecycle

```
1. Worker starts                         → manifest fields not yet
                                            allocated
2. Parse phase runs                      → context.issues fills with
                                            ParseIssue entries
3. Generate phase runs                   → toArtifacts captures results
                                            and previews/mappings
4. Worker returns                        → host receives files +
                                            manifest scaffolding
5. Host writes artifacts                 → host fills `files` map
                                            with metrics
6. Host writes manifest                  → `.settings/manifest.json`
                                            overwritten with this run
7. CLI exits                             → exit code derives from
                                            parseIssues
```

**The manifest is always written, even on failure.** A run where
the worker throws still produces a manifest with whatever was
captured before the throw, plus the parse issues that triggered
it. The diagnostic record survives every failure mode short of
the host process itself crashing.

**One manifest per run, no history.** Each `skmtc generate`
overwrites the previous manifest. If you need run history, capture
the manifest before re-running (e.g., to a CI artifact store).

## Consumer integration points

### CI

```bash
skmtc generate my-project
# Exit code 0: parseIssues had no error-level entries
# Exit code 1: any error-level parseIssue, or --typecheck failed
# Exit code 2: missing required CLI args in strict mode
```

A CI script that wants per-item granularity reads `results` and
filters for `'error'` leaves:

```bash
jq '.results | .. | objects | to_entries[] | select(.value == "error")' \
  .skmtc/my-project/.settings/manifest.json
```

### IDE plugins / SKMTC UI

The UI reads `previews` and `mappings` to render "this form was
generated from `POST /contacts`." Each preview's `source` field
tells it the operation; each module's `exportPath` tells it where
the generated artifact lives.

### Agents

An agent debugging a generation issue typically reads:

1. `parseIssues` — any errors at the schema level?
2. `results` — for each `(generator, item)`, what was the outcome?
3. `files` — was the expected file produced?

Three lookups answer most diagnosis questions without re-running.

## Common questions

### Why isn't `parseIssues` keyed like `results`?

`parseIssues` is a flat array; `results` is a nested tree. The
difference matches their producers: parsers log a stream of
diagnostics (an array is the natural shape), while `toArtifacts`
captures per-`(generator, item)` outcomes (a tree keyed by
`(stackTrail-position)` is natural).

### Can a single item appear multiple times in `results`?

Yes. `toArtifacts` captures a final outcome at the end of each
iteration. But `ResultsHandler` may capture intermediate
`warning` / `error` results if the generator logged via the
logger during its run. The two land at different positions in the
tree (the intermediate ones get a `'SKIPPED'` placeholder trail —
see `ResultsHandler.ts:116`).

### What if a generator produces no output but doesn't throw?

`results` shows `'success'`. `files` won't include the expected
path. The combination is the signal that the generator ran but
didn't `register` or `insert*`. See
[how-generators-produce-output.md](how-generators-produce-output.md#silent-failure-modes)
for the diagnosis.

### Does the manifest record what generators ran?

Indirectly. The `results` tree contains an entry for every
`(generatorId, item)` pair that was iterated. A generator that
applied to zero items doesn't show up at all — its absence from
results is the signal that nothing was iterated for it.

### Why is `endAt` separate from `startAt`?

To compute wall time without timezone math: `endAt - startAt`
gives milliseconds. The two are unix-millisecond timestamps so
sorting by either makes sense.

### What does `region` mean?

Only set for runs that went through the hosted Sandbox API. The
local-worker path leaves it `undefined`.

### Are `previews` and `mappings` required?

No. A generator without `toPreviewModule` / `toMappingModule`
contributes nothing to those maps. The tooling layer just doesn't
get UI metadata for that generator's output. File generation and
exit codes are unaffected.

### Can I add custom fields to the manifest?

No public API for it. The shape is fixed by `manifestContent`'s
Valibot schema. Custom data goes in `JsonFile` outputs instead
(generators can write side-channel JSON files like
`route-manifest.json`).

### Why is `endAt` written by the worker if the host writes `files` afterward?

`endAt` is set just before the worker posts its `RESULT` message,
so it reflects worker wall-clock. The host's persistence step
isn't included — host I/O isn't part of the generation contract.
If you need end-to-end CLI wall-time, measure it externally.

## Further reading

- [Error handling philosophy](error-handling-philosophy.md) —
  parsers contribute to `parseIssues`; the philosophy that drives
  "parse fails open, manifest is canonical"
- [How generators produce output](how-generators-produce-output.md)
  — `GenerateContext.toArtifacts` contributes to `results`
- [The StackTrail](the-stack-trail.md) — how `results` keys and
  `parseIssue.location` strings are produced
- [Files, deduplication, and integrity](files-and-dedup.md) — how
  the file map (which becomes `files`) is built during Generate
- [Reference: manifest format](../reference/manifest-format.md) —
  full Valibot schema and field-by-field documentation
- [Reference: error codes](../reference/error-codes.md) — the
  `parseIssue.type` enum values
- [`skmtc-debug` skill](../skills/skmtc-debug/SKILL.md) —
  operational diagnosis using the manifest
