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

```ts
type Manifest = {
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

  /** Optional per-Projection mapping data */
  mappings?: Record<string, Mapping>

  /** Per-(generator × item) outcome — see "results" below */
  results: ResultsItem

  /** Parse-time diagnostics. Always present; empty array means no parse issues. */
  parseIssues: ParseIssue[]
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

### `previews` and `mappings`

Per-Projection metadata for UI surfaces (dashboard, editor previews).
Most generators populate one preview entry per Projection (the
identifier name, exportPath, and any preview-specific data). `mappings`
is similar but for any project that needs to track origin
relationships.

These fields are most useful to tooling that wraps SKMTC (the
Sandbox API dashboard, for example). For everyday agent work, they
can be ignored.

### `results`

The most-consulted field for debugging. A deeply nested record
keyed by trace → span → `"generate"` → generator package ID →
identifier:

```jsonc
{
  "trace-1778185255674": {
    "span-1778185255674": {
      "generate": {
        "@skmtc/gen-shadcn-form": {
          "mutation_CreateApplicant": "success",
          "query_GetApplicants": "notSupported"
        },
        "@skmtc/gen-zod": {
          "ApplicantModel": "success",
          "BrokenModel": "error"
        }
      }
    }
  }
}
```

Each leaf is a `ResultType`:

| Value | Meaning |
|---|---|
| `success` | Generator ran and produced output for this item |
| `warning` | Output produced, with a recoverable issue logged |
| `error` | Generator threw or returned failure; output may be missing or partial |
| `skipped` | Item matched but deliberately skipped (via `client.json` filters) |
| `notSupported` | Generator's `isSupported` returned false — *expected* for items outside the generator's scope |

The identifier format depends on the generator type:

- **Operation generators**: `<protocol>_<operationId>` — e.g.,
  `query_GetApplicants`, `mutation_CreateApplicant`, `post_users`,
  `get_users_userId`. The protocol prefix maps to the HTTP method
  category for OAS or to the GraphQL operation type for GQL.
- **Model generators**: the refName directly — e.g., `UserModel`,
  `ApplicantModel`.

### `parseIssues`

Array of parse-time diagnostics. **Always present** in the
manifest — an empty array means no parse issues, not "old core
version".

`ParseIssue` is a discriminated union of four shapes, keyed by
`(protocol, level)`:

```ts
type ParseIssue =
  | { protocol: 'oas'; level: 'error';   type: OasIssueType; location: string; message: string; cause: unknown }
  | { protocol: 'oas'; level: 'warning'; type: OasIssueType; location: string; message: string }
  | { protocol: 'gql'; level: 'error';   type: GqlIssueType; location: string; message: string; cause: unknown }
  | { protocol: 'gql'; level: 'warning'; type: GqlIssueType; location: string; message: string }
```

Note that `cause` is present **only** on `level: 'error'`
shapes — it's truly absent on warnings, not just optional. The
`type` field is constrained to the protocol's `OasIssueType` or
`GqlIssueType` literal union — see
[reference/error-codes.md](error-codes.md) for the full lists.

The CLI exits with code `1` when any `parseIssues[].level ===
'error'` is present; an array containing only warnings (or an
empty array) exits cleanly.

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

- [Error handling philosophy](../concepts/error-handling-philosophy.md) — why the manifest is canonical
- [Error codes](error-codes.md) — full list of `parseIssue.type` values
- [`skmtc-debug` skill](../skills/skmtc-debug/SKILL.md) — operational diagnostic workflows
- [`skmtc generate` reference](cli/generate.md) — the command that writes the manifest
- [`skmtc-cli` skill §10 (CI task card)](../skills/skmtc-cli/SKILL.md) — archiving the manifest in CI
