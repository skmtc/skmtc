# Manifest format

> The shape and contents of `manifest.json` — the canonical record of
> every SKMTC generation run.

The manifest is overwritten on every `skmtc generate` (and every
`skmtc dev` rebuild). It records every file written, every
`(generator, item)` outcome, parse issues, timing, and per-projection
previews. Treat it as the **source of truth** for what happened in
the last run.

> **Two JSON shapes — read carefully.** SKMTC produces two
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

This field is most useful to tooling that wraps SKMTC (the Sandbox
API dashboard, for example). For everyday agent work, it can be
ignored.

### `results`

The most-consulted field for debugging. A deeply nested record
keyed by trace → span → phase → generator package ID → item
identifier (verified against real manifests, not extrapolated):

```jsonc
{
  "trace-1763060002688": {
    "span-1763060002688": {
      "generate": {
        "@skmtc/gen-express": {
          "/accounts%3Aget": "success",
          "/accounts%3Apost": "success",
          "/deployments/{deploymentId}%3Aget": "success"
        },
        "@skmtc/gen-valibot": {
          "ApplicantModel": "success",
          "BrokenModel": "error"
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
telling you *that* the item failed, not *why*.

Where the exception text lives, by failure phase:

| Phase that failed | Where the message and stack appear |
|---|---|
| **Bundle** (`skmtc bundle`, or the implicit rebundle inside `clone` / `install` / `dev`) | `.skmtc/<project>/.settings/error-logs.txt`. The CLI's `GenerateBundleTask` writes the `deno bundle` subprocess stderr there on every bundle run |
| **Generate** (`skmtc generate` / `skmtc dev` re-run) | Live stderr of the invocation only. The host does not persist generate-time worker errors to disk |
| **Hosted Sandbox API run** | `skmtc workspaces runtime-logs <project>` fetches them from the service using `manifest.spanId` |

Operational consequence for agentic `--json` workflows: `--json`
sends the structured result to stdout but stderr still carries the
human-readable message for any item that errored. Capture both:
`skmtc generate <project> --json 2>generate.stderr.log`. Parsing the
JSON tells you *which* identifiers errored; the stderr file tells
you *what each exception said*. The manifest's `results` tree is not
self-sufficient for this.

Item-identifier formats under `generate`:

- **OAS operation generators**: `<path>%3A<method>` — URL-encoded colon
  separates the OpenAPI path from the lowercase HTTP method (matches
  the `StackTrail.toString()` format used throughout the engine).
  Examples: `/accounts%3Aget`, `/deployments/{deploymentId}%3Aput`,
  `/users/{userId}/avatar%3Apost`.
- **GraphQL operation generators**: `<rootKind>%3A<fieldName>` — e.g.,
  `query%3AgetApplicants`, `mutation%3AcreateApplicant`.
- **Model generators**: the refName directly — e.g., `UserModel`,
  `ApplicantModel`.

#### Edge case: no matches at all

When nothing the engine generated produced a result (no generators
matched any item), the tree collapses to a flat `SKIPPED` marker
instead of the nested trace/span shape:

```jsonc
{
  "results": {
    "SKIPPED": "error"
  }
}
```

Recipes that walk the tree should handle both forms — for example,
checking `.results.SKIPPED` first before descending into trace keys.

### `parseIssues`

Array of parse-time diagnostics. **Always present** in the
manifest — an empty array means no parse issues, not "old core
version".

`ParseIssue` is a discriminated union of six shapes, keyed by
`(protocol, level)` — two protocols (`'oas'`, `'gql'`) × three
levels (`'error'`, `'warning'`, `'debug'`):

```ts
type ParseIssue =
  | { protocol: 'oas'; level: 'error';   type: OasIssueType; location: string; message: string; cause?: unknown }
  | { protocol: 'oas'; level: 'warning'; type: OasIssueType; location: string; message: string }
  | { protocol: 'oas'; level: 'debug';   type: OasIssueType; location: string; message: string }
  | { protocol: 'gql'; level: 'error';   type: GqlIssueType; location: string; message: string; cause?: unknown }
  | { protocol: 'gql'; level: 'warning'; type: GqlIssueType; location: string; message: string }
  | { protocol: 'gql'; level: 'debug';   type: GqlIssueType; location: string; message: string }
```

Note that `cause` exists **only** on `level: 'error'` shapes (and
is optional there) — warnings and debug entries never carry it.
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
    | to_entries | map(select(.value != "success"))' manifest.json
```

Replace `@skmtc/gen-X` with the generator of interest. Returns every
identifier under that generator that wasn't `success`, with its
status.

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
- [Use SKMTC in CI/CD](../using/how-to/use-in-ci-cd.md) — archiving the manifest in CI
