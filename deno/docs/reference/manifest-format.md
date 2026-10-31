# Manifest format

> The shape and contents of `manifest.json` — the canonical record of
> every Skmtc generation run.

The manifest is overwritten on every `skmtc generate` (and every
`skmtc dev` rebuild). It records every file written, every
`(generator, item)` outcome, parse issues, timing, and per-projection
previews. Treat it as the **source of truth** for what happened in
the last run.

> **Two JSON shapes — read carefully.** Skmtc produces two
> structurally different JSON outputs. This document describes the
> **on-disk manifest** at
> `.skmtc/<project>/.settings/manifest.json`. The **`skmtc generate
> --json` stdout output** is a *different* shape (documented in
> [`reference/cli/generate.md`](cli/generate.md#json-output)). They
> overlap but are not identical: stdout flattens `files` to a top-level
> string array and does not include the per-item `results` tree.
> Recipes assuming this manifest shape against stdout JSON will
> silently produce `null`. When writing a `jq` recipe, decide first
> *which JSON* you are querying.

## Location

```
<root>/.skmtc/<project>/.settings/manifest.json
```

Written by the CLI host after the Worker posts its `RESULT` message.
The host writes the manifest to disk alongside the generated
artifacts.

## Top-level shape

The type is `ManifestContent` (`core/types/Manifest.ts`, with a
companion Valibot schema `manifestContent`):

```ts
type ManifestContent = {
  /** Unique identifier for this run */
  deploymentId: string

  /** Trace correlation IDs */
  traceId: string
  spanId: string

  /** Optional region identifier (for hosted Sandbox API runs) */
  region?: string

  /** Unix-millisecond timestamps. (endAt - startAt) = wall-clock time */
  startAt: number
  endAt: number

  /** Every file written by this run, keyed by destination path */
  files: Record<string, {
    lines: number
    characters: number
    destinationPath: string
  }>

  /** Per-Projection preview metadata for UI surfaces */
  previews: Record<string, Preview>

  /** Per-(generator × item) outcome — see "results" below */
  results: ResultsItem

  /** Parse-time diagnostics. Always present; empty array means no parse issues. */
  parseIssues: ParseIssue[]

  /** Generate-phase enrichment config warnings. Optional (older cores omit it). */
  enrichmentWarnings?: EnrichmentWarning[]
}
```

## Fields in detail

### `deploymentId`, `traceId`, `spanId`

Unique identifiers for the run. Useful when correlating manifests
across multiple `generate` invocations or matching log entries to
their source run.

### `region`

Present only when the run executed via the hosted Sandbox API.
Identifies which deployment region handled the request. Absent for
local Worker runs.

### `startAt`, `endAt`

Unix-millisecond timestamps. `endAt - startAt` is the wall-clock
duration of the entire pipeline (parse + generate + render + host
I/O).

### `files`

Every file written, keyed by the resolved destination path (after
`basePath` resolution). Each entry:

- `lines` — line count of the rendered content
- `characters` — character count
- `destinationPath` — same as the key; redundant but useful for
  iterating values

To get the list of files this run produced:

```bash
jq '.files | keys' manifest.json
```

### `previews`

Per-Projection metadata for UI surfaces (dashboard, editor
previews). Each `Preview` pairs a `module` (`{ name, exportPath }` —
the identifier name and export path of the previewable artifact)
with a `source` descriptor pointing back at the operation, webhook,
or model it was generated from. Populated only by entries that
supply `toPreviewModule`.

This field is most useful to tooling that wraps Skmtc (the Sandbox
API dashboard, for example). For everyday agent work, it can be
ignored.

### `results`

The most-consulted field for debugging. A deeply nested record
keyed by trace → span → phase → generator package ID → item → variant.
Each frame of the engine's stack trail is one level, and each key
is the frame text as it is. Skmtc does not escape it:

```jsonc
{
  "trace-1763060002688": {
    "span-1763060002688": {
      "generate": {
        "@skmtc/gen-express": {
          "/accounts": {
            "get": { "variant": { "main": "success" } },
            "post": { "variant": { "main": "success", "admin": "success" } }
          },
          "/pets/{id}:archive": {
            "post": { "variant": { "main": "success" } }
          }
        },
        "@skmtc/gen-valibot": {
          "ApplicantModel": { "variant": { "main": "success" } },
          "BrokenModel": { "variant": { "main": "error" } }
        }
      },
      "render": {
        "@/accounts/routes.generated.ts": "success",
        "@/deployments/routes.generated.ts": "success"
      }
    }
  }
}
```

Two **phase keys** sit under `span-…`:
- **`generate`** — per-(generator × item) outcome from the Generate phase
- **`render`** — per-output-file outcome from the Render phase, keyed by `exportPath`

Each leaf is a `ResultType` string:

| Value | Meaning |
|---|---|
| `success` | Generator ran and produced output for this item |
| `warning` | Output produced, with a recoverable issue logged |
| `error` | Generator threw or returned failure; output may be missing or partial |
| `skipped` | Item matched but deliberately skipped (via `client.json` filters) |
| `notSupported` | Generator's `isSupported` returned false — *expected* for items outside the generator's scope |

#### `error` leaves do not carry the exception text

`ResultType` is a literal string union in `@skmtc/core` — `'success' |
'warning' | 'error' | 'skipped' | 'notSupported'`. There is no
companion `message`, `stack`, or `cause` field on an errored leaf.
When you see `"identifier": "error"` in the tree, the manifest is
telling you *that* the item failed, not *why*. The *why* is in the
log lines of the run (see [`logs` beside the manifest](#logs-beside-the-manifest)).

Where the exception text lives, by failure phase:

| Phase that failed | Where the message and stack appear |
|---|---|
| **Bundle** (the build at the start of `generate`, `skmtc bundle`, or the build inside `clone` / `install` / `dev`) | `.skmtc/<project>/.settings/error-logs.txt`. The CLI writes the `deno bundle` subprocess stderr there on every build |
| **Generate** (`skmtc generate` / `skmtc dev` re-run) | `.skmtc/<project>/.settings/logs.ndjson`, one `ERROR` line for each item that failed, and the live stderr of the invocation |
| **`@skmtc/server` run** | The `logs` array of the `POST /artifacts` response |
| **Hosted Sandbox API run** | `skmtc workspaces runtime-logs <project>` fetches them from the service using `manifest.spanId` |

Item-identifier formats under `generate`:

- **OAS operation generators**: `[path][method]['variant'][variant]`.
  The OpenAPI path and the lowercase HTTP method are two levels.
  Example: `["/accounts"]["get"]["variant"]["main"]`. A colon in the
  path stays as it is: `["/pets/{id}:archive"]["post"]["variant"]["main"]`.
- **Webhook generators**: `['webhook'][name][method]['variant'][variant]`.
  Example: `["webhook"]["newPet"]["post"]["variant"]["main"]`.
- **GraphQL operation generators**: `[rootKind][fieldName]['variant'][variant]`.
  Example: `["query"]["getApplicants"]["variant"]["main"]`,
  `["mutation"]["createApplicant"]["variant"]["main"]`.
- **Model generators**: `[refName]['variant'][variant]`. Example:
  `["UserModel"]["variant"]["main"]`.

A generator with no variants configured has the one variant `main`.

When a generator logs a warning or error through `context.logger`
inside its transform, the engine records it at the leaf of that item.
Thus an item that logs a warning and then completes has the result
`'warning'`. A line logged outside an item records no result.

### `parseIssues`

Array of parse-time diagnostics. **Always present** in the
manifest — an empty array means no parse issues, not "old core
version".

`ParseIssue` is a discriminated union of six shapes, keyed by
`(protocol, level)` — two protocols (`'oas'`, `'gql'`) × three
levels (`'error'`, `'warning'`, `'debug'`):

```ts
type ParseIssue =
  | { protocol: 'oas'; level: 'error';   type: OasIssueType; location: string; message: string; cause?: SerializedError }
  | { protocol: 'oas'; level: 'warning'; type: OasIssueType; location: string; message: string }
  | { protocol: 'oas'; level: 'debug';   type: OasIssueType; location: string; message: string }
  | { protocol: 'gql'; level: 'error';   type: GqlIssueType; location: string; message: string; cause?: SerializedError }
  | { protocol: 'gql'; level: 'warning'; type: GqlIssueType; location: string; message: string }
  | { protocol: 'gql'; level: 'debug';   type: GqlIssueType; location: string; message: string }
```

Note that `cause` exists **only** on `level: 'error'` shapes (and
is optional there) — warnings and debug entries never carry it.

`cause` is the error that caused the issue, as data. Its name,
message and stack stay in the JSON:

```ts
type SerializedError = {
  name: string
  message: string
  stack?: string
  cause?: SerializedError
}
```

`cause.cause` holds the cause of that error, to a depth of five. A
thrown value that is not an `Error` has the name `'NonError'`. Its
`message` is the value as a string or as JSON. Core exports the type,
the `serializedError` schema and `toSerializedError` from
`@skmtc/core/SerializedError`.

A manifest from an earlier core can hold `cause: {}` or a string.
The `manifestContent` schema reads such a value and changes it to a
`SerializedError` with the name `'NonError'`.
`debug` is informational: the parser handled the input gracefully
and is recording what it did. The `type` field is constrained to
the protocol's `OasIssueType` or `GqlIssueType` literal union — see
[reference/error-codes.md](error-codes.md) for the full lists.

The CLI exits with code `1` when any `parseIssues[].level ===
'error'` is present; an array containing only warnings and debug
entries (or an empty array) exits cleanly.

### `enrichmentWarnings`

Generate-phase warnings about enrichment config that did not do what
the consumer intended. Three loud checks precede this surface
(structural config validation at load, the per-leaf schema parse, the
missing-`main` variant throw); `enrichmentWarnings` covers what those
cannot see — *addressing*. The engine records every enrichment lookup
it performs during the walk and flags configured entries no lookup
consumed, plus leaf keys the generator's schema silently drops.

The field is **optional**: manifests written by cores older than the
feature omit it. New cores always write it (empty array for a clean
run). Warnings never affect generation output or the exit code —
the surface is fail-open by design.

```ts
type EnrichmentWarning = {
  level: 'warning' | 'info'
  type:
    | 'UNCONSUMED_ENRICHMENT'        // routing path never consumed (typo'd path/method/model name, or orphaned by spec evolution)
    | 'UNKNOWN_GENERATOR_ID'         // top-level key matches no generator in the run
    | 'UNKNOWN_ENRICHMENT_KEY'       // leaf key the generator's schema doesn't declare (silently dropped)
    | 'SKIPPED_SUBJECT_ENRICHMENT'   // info: enrichment targets a skip/include-excluded item
    | 'SKIPPED_GENERATOR_ENRICHMENT' // info: whole generator skipped while enrichments exist
  /** Routing key sequence under client.json#settings.enrichments */
  path: string[]
  message: string
  /** Nearest known key, when a close match exists (e.g. 'submitLabel' for 'submitLabl') */
  suggestion?: string
}
```

Addressing mistakes are `level: 'warning'` — the entry is dead
config. Enrichments on skipped items are `level: 'info'` — the entry
is addressed correctly and a temporary skip is legitimate. To list
only the actionable ones:

```bash
jq '.enrichmentWarnings // [] | map(select(.level == "warning"))' manifest.json
```

## `logs` beside the manifest

`toArtifacts` returns the log lines of the run in `logs`, next to the
manifest and not in it. The manifest stays a small record of
statuses. The lines hold the detail: messages, and errors with their
stacks.

```ts
type LogLine = {
  /** Position of the line in the run, from 0 */
  seq: number
  /** A CRITICAL record is recorded as 'ERROR' */
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  /** The trail of the subject that logged the line. Absent outside a subject */
  trail?: string
  message: string
  /** The first Error that the line was logged with (see SerializedError above) */
  error?: SerializedError
  /** Unix milliseconds */
  time: number
}
```

`logs` keeps the lines at the `logLevel` of `toArtifacts` and above.
The default is `'WARN'`. When a transform throws, the engine logs one
`ERROR` line with the message of the error and the error itself.

The CLI writes the lines to
`.skmtc/<project>/.settings/logs.ndjson`, one JSON object on each line.
Each run replaces the file. A bundle that pins a core without `logs`
gives no lines, and the CLI then removes the old file. `skmtc deploy`
does not upload the file, because the stacks hold local paths.
`@skmtc/server` returns the lines in the `logs` array of its
`POST /artifacts` response.

The `trail` of a line is its key in `results`. Split it on `:` (with
`StackTrail.fromString`), and use the frames in sequence as keys into
`results`. The frames of an `ERROR` line end at a leaf
that is `'error'`. To list the errors with their items:

```bash
jq -c 'select(.level == "ERROR") | {trail, message}' .skmtc/<project>/.settings/logs.ndjson
```

## Diagnostic workflow against the manifest

The most common diagnostic paths:

### "It generated nothing"

```bash
jq '[.. | strings] | group_by(.) | map({status: .[0], n: length})' manifest.json
```

If every leaf is `notSupported`, no generator's `isSupported` matched
any operation/model. Check that the schema has the operations
expected and that the right generators are installed.

### "It generated less than expected"

```bash
jq '.results[][].generate["@skmtc/gen-X"]
    | [paths(type == "string") as $p | {path: $p, status: getpath($p)}]
    | map(select(.status != "success"))' manifest.json
```

Replace `@skmtc/gen-X` with the generator of interest. Returns the
path and status of each item under that generator that is not
`success`, for example
`{"path": ["/accounts", "get", "variant", "main"], "status": "error"}`.

### "A specific output is missing"

Check `files` first. If the expected `destinationPath` isn't there,
find the corresponding identifier in `results`. `error` means the
generator failed; `notSupported` means the engine never reached it.

### "Cost / size accounting"

`files` has `lines` and `characters` per output. `(endAt - startAt)`
is wall-clock duration. To group files by output subdirectory:

```bash
jq '.files | to_entries | group_by(.value.destinationPath | split("/")[1])
    | map({dir: .[0].value.destinationPath, n: length})' manifest.json
```

### "Fatal parse issues only"

```bash
jq '.parseIssues // [] | map(select(.level == "error"))' manifest.json
```

The presence of any `level: "error"` entry causes the CLI to exit
non-zero (typically code 1).

## Update behavior

The manifest is **overwritten** on every `generate` and `dev`
rebuild. The previous run's contents are not preserved.

If you need to compare across runs:

- Copy the manifest before re-running:
  `cp .skmtc/<project>/.settings/manifest.json manifest-before.json`
- Then re-run, then `diff`

In CI, archive the manifest as a build artifact for forensic
analysis of failed runs.

## Exit code derivation

The CLI exits non-zero when:

- Any `parseIssue.level === 'error'` is present → exit 1
- `--typecheck` was passed and the typecheck failed → exit 1
- Required arguments were missing in strict mode → exit 2

Exit 0 means: no fatal parse issues, no typecheck failures, and (if
typecheck was requested) the consumer's `tsc --noEmit` passed for
the files this run wrote.

The manifest persists regardless of exit code. Even a failed run
writes the manifest — the diagnostic record survives.

## Common questions

### Can I get a streaming view of generation?

No. The Worker computes the full result in memory and posts it back
to the host as a single message. The host then writes the manifest
and the files. There's no incremental streaming.

For watch-mode-style behavior, use `skmtc dev`, which auto-reruns
the whole pipeline on file changes. Each rerun overwrites the
manifest.

### Why does the `results` structure have trace/span keys?

Future-proofing for distributed traces. Today there's a single
trace/span per run, but the structure leaves room for nested spans
(e.g., if a run aggregates multiple sub-pipelines). For now, treat
`manifest.results[traceId][spanId].generate` as a constant prefix
and slice into the `generate` object.

### How big does the manifest get?

For a typical run of a few hundred operations, the manifest is on
the order of 100KB-1MB. Each entry in `files` and `results` is
small (~100 bytes), but they accumulate. For very large schemas
(thousands of operations), the manifest can reach several MB. There's
no rotation or trimming; the file just grows with the schema.

### Where do I see real-time progress?

In stdout/stderr from the `skmtc generate` invocation, not in the
manifest. The manifest is the post-hoc record. For real-time, watch
the CLI's output stream.

## Cross-references

- [Error handling philosophy](../explanation/error-handling-philosophy.md) — why the manifest is canonical
- [Error codes](error-codes.md) — full list of `parseIssue.type` values
- [How to debug a failing generation](../using/how-to/debug-failing-generation.md) — diagnostic workflows over this format
- [`skmtc generate` reference](cli/generate.md) — the command that writes the manifest
- [Use Skmtc in CI/CD](../using/how-to/use-in-ci-cd.md) — archiving the manifest in CI
