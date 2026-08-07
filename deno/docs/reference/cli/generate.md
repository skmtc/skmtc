# skmtc generate

> Run the SKMTC generation pipeline against a schema.

The most-used CLI command. Loads the project's bundle, parses the
schema, runs every installed generator, writes output files, writes
the manifest.

## Synopsis

```
skmtc generate <project> [schema] [--watch] [--typecheck] [--tsconfig <path>] [--tsc-cmd <cmd>] [--anchors | --no-anchors] [--debug [--auto]] [--json] [--no-input]
```

## Arguments

### `<project>`

The SKMTC project name — the subdirectory name under
`<root>/.skmtc/`. Required in strict mode.

### `[schema]`

Optional. Path or URL to the schema source. If omitted, resolved
from `.settings/client.json#source`.

If neither is set:

- Interactive mode → prompts for the source via Ink UI
- Strict mode → exits with code 2 and a recipe error

## Options

### `-w, --watch`

Poll the schema source for changes and regenerate. Long-running.
**Mutually exclusive with `--json`** — passing both exits with code
2 and a recipe error.

For watching *generator source code* changes (the case during local
generator development), use [`skmtc dev`](dev.md) instead — it
watches the project tree, not just the schema.

### `--typecheck`

Run `tsc --noEmit` against the consumer's tsconfig after generation,
scoped to the files this run wrote. Adds a `typecheck` field to the
JSON output.

A `failed` typecheck causes exit code 1, even when the run otherwise
succeeded. Generated files stay on disk; the operator can fix the
generator and re-run.

### `--tsconfig <path>`

Override the tsconfig used by `--typecheck`. Default: walk up from
`basePath` looking for the nearest `tsconfig.json`.

### `--tsc-cmd <cmd>`

Override the typecheck command. Default: `npx tsc`. Useful for
projects using pnpm/bun:

```bash
skmtc generate my-api --typecheck --tsc-cmd "pnpm exec tsc"
skmtc generate my-api --typecheck --tsc-cmd "bunx tsc"
```

### `--anchors` / `--no-anchors`

Force gen-maps (attribution) output on or off, overriding
`client.json#settings.anchors.enabled`. When on, the run writes
sidecars plus a generation map under `.skmtc/<project>/.maps/`.

### `--debug`

Run generation under the V8 inspector in source mode (not the
bundle), so a debugger can pause on breakpoints in generator code
and inspect the live files map at each stop. Pairs with the SKMTC
Debug VS Code extension. Routes to a separate debug code path.

### `--auto`

With `--debug`, run generation immediately instead of waiting for a
debugger to attach.

### `--json`

Write a single structured JSON object to stdout. Implies `--no-input`.
Mutually exclusive with `--watch`.

### `--no-input`

Disable interactive prompts. Required arguments must be provided up
front. Failures produce recipe errors on stderr.

Automatically inferred when stdin/stdout is non-TTY (CI, pipes,
agent contexts).

## Behavior

### Schema source resolution

Resolution order:

1. Explicit `[schema]` argument on the command line
2. `client.json#source` — top level, a file path or an `https` URL (not
   `settings.source`)
3. Interactive prompt (TTY only — strict mode fails with recipe)

The first non-undefined value wins.

### Routing

- Explicit `[schema]` OR `client.json#source` set → runs
  `generateLocal` directly (no Ink UI).
- Neither set in interactive mode → mounts the Ink prompt.
- Neither set in strict mode → exits 2 with a recipe error.

### Bundle freshness gate (strict mode)

Before generation, the CLI verifies that `bundle.js` matches the
current `deno.json#imports`. If they've drifted (e.g., from
hand-editing `deno.json` outside the CLI), strict-mode `generate`
refuses with exit 2:

```
Error: bundle.js is out of sync with deno.json — add: @skmtc/gen-X
```

Remediation: `skmtc bundle <project>` then re-run.

Interactive mode skips the gate; bundling issues surface at runtime
instead.

### Worker spawn and protocol

The CLI spawns a Deno Worker from the project's `bundle.js` —
remote-only and hybrid projects alike. Worker permissions:
`read`, `write`, `env=true`; `net=false`, `run=false`.

Three-message protocol: `READY` (worker boot) → `GENERATE` (host →
worker with `{ document, clientSettings }`) → `RESULT` (worker → host
with `{ artifacts, manifest }`). On unrecoverable worker error,
`ERROR` is posted instead.

See [the-worker-runtime concept](../../concepts/the-worker-runtime.md).

### Persisting the manifest

After the worker returns, the CLI writes:

- Every artifact to its resolved destination path under `basePath`
- `.skmtc/<project>/.settings/manifest.json` — the canonical record

The manifest is overwritten on every run. See
[manifest-format](../manifest-format.md).

## JSON output

> **Two JSON shapes — read carefully.** The `--json` stdout shape
> documented here is **different** from the on-disk
> `manifest.json` shape (described in
> [`reference/manifest-format.md`](../manifest-format.md)). Stdout
> flattens `files` to a top-level string array of paths and **does
> not** include the per-item `results` tree. Recipes assuming the
> manifest shape against stdout will silently produce `null`. When
> writing a `jq` recipe, decide first *which JSON* you are
> querying.

```jsonc
{
  "type": "generated",
  "projectName": "my-api",
  "basePath": "mobile-app/src",            // or null if not configured
  "manifestPath": ".skmtc/my-api/.settings/manifest.json",
  "stats": {
    "tokens": 201029,
    "lines": 1234,
    "files": 753,
    "totalTimeMs": 180
  },
  "files": [
    "mobile-app/src/types/User.generated.ts",
    "mobile-app/src/services/useCustomer.generated.ts",
    "..."
  ],
  "errors": [
    ["trace-1778185255674", "span-1778185255674", "generate",
     "@skmtc/gen-zod", "BrokenModel"]
  ],
  // Each entry is a path through manifest.results ending at an 'error'
  // leaf. Shape: [traceId, spanId, "generate", generatorId, identifier].
  "parseIssues": [
    {
      "protocol": "oas",
      "level": "warning",
      "type": "MISSING_OBJECT_TYPE",
      "location": "components:schemas:User",
      "message": "..."
    }
  ],
  "typecheck": {                           // only present with --typecheck
    "type": "passed",
    "tsconfig": ".../tsconfig.json",
    "filesChecked": 42
  }
}
```

### Field reference

- **`type`**: always `"generated"` on success.
- **`projectName`**: echoed from the argument.
- **`basePath`**: the resolved `basePath` from `client.json` (string)
  or `null` if not configured.
- **`manifestPath`**: where the manifest was written.
- **`stats`**: aggregate counts. `tokens` counts via `gpt-tokenizer`
  on the artifact contents.
- **`files`**: every destination path written by this run.
  Resolved paths (after `basePath` application).
- **`errors`**: An array of *paths* through `manifest.results`. Each
  path terminates at a leaf whose result value is `'error'`. The
  canonical shape is `[traceId, spanId, "generate", generatorId,
  identifier]` (deeper for nested aggregator results). The generator
  whose item failed is the second-to-last element; the failing
  identifier is the last. `errors[i][0]` is **not** a file path — to
  find the file an error corresponds to, look up the identifier
  via the generator's `toExportPath`.
- **`parseIssues`**: forwarded verbatim from
  `manifest.parseIssues`. Each issue has `protocol`, `level`,
  `type`, `location`, `message`, optional `cause`.
- **`typecheck`**: present only with `--typecheck`. See subsection.

### `--typecheck` output shape

Discriminated on `type`:

```jsonc
// All good
{
  "type": "passed",
  "tsconfig": ".../tsconfig.json",
  "filesChecked": 42
}

// Errors in this run's files
{
  "type": "failed",
  "tsconfig": "...",
  "filesChecked": 42,
  "diagnostics": [
    {
      "file": "mobile-app/src/forms/Customer.generated.tsx",
      "line": 23,
      "column": 7,
      "code": 2322,
      "category": "error",
      "message": "Type 'string | undefined' is not assignable to type 'string'."
    }
  ]
}

// Couldn't find a tsconfig walking up from basePath
{ "type": "no-tsconfig", "message": "...", "hint": "..." }

// tsc command itself failed (no npx, no tsc installed, etc.)
{ "type": "tsc-error", "message": "...", "hint": "..." }

// Nothing to check (no files written)
{ "type": "skipped", "reason": "no-files", "message": "..." }
```

Only `type: "failed"` causes exit 1. The other outcomes are
informational.

## Examples

### Basic generation

```bash
skmtc generate my-api ./schema.json
```

### Agent / CI invocation

```bash
skmtc generate my-api --json --no-input
```

### With typecheck

```bash
skmtc generate my-api --json --typecheck --tsc-cmd "pnpm exec tsc"
```

### Watch mode (interactive)

```bash
skmtc generate my-api --watch
```

Long-running. Polls the schema URL/path for changes; regenerates on
modification.

### Source pinned in client.json

After setting `"source": "./schema.json"` in client.json:

```bash
skmtc generate my-api
```

No schema argument needed.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — no fatal parse issues, typecheck (if requested) passed |
| `1` | Fatal parseIssue at level `error`, OR `--typecheck` returned `type: "failed"`, OR worker error |
| `2` | Required argument missing (recipe error on stderr), OR `--json` and `--watch` both passed, OR bundle freshness gate triggered |

## Worker-side failures

When the worker encounters an unrecoverable error
(`toArtifacts` throws), it synthesizes an `INVALID_SCHEMA` issue
at `location: "toArtifacts"` with `level: "error"` and posts it via
the manifest. The CLI sees the issue, writes the manifest as
normal, and exits 1.

This means: **fatal failures still produce a manifest with
diagnostic information**. Even when the CLI exits 1, the manifest
exists and the operator can inspect `parseIssues` for the cause.

## See also

- [`skmtc bundle`](bundle.md) — required if you've hand-edited `deno.json`
- [`skmtc dev`](dev.md) — watch-mode for generator source changes
- [`skmtc doctor`](doctor.md) — diagnose setup before generating
- [manifest format](../manifest-format.md) — what the run produced
- [error codes](../error-codes.md) — interpret `parseIssues`
- [CLI overview](overview.md) — shared conventions and workflow
- [How to debug a failing generation](../../using/how-to/debug-failing-generation.md) — when generation fails
