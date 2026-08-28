# How to debug a failing generation

> Diagnose why `skmtc generate` produced no output, the wrong
> output, or threw an error.

## When to use this

Generation didn't produce the files you expected, the files have
unexpected contents, or the CLI exited non-zero.

One thing to trust from the start: a failed item never kills the
run. Everything unaffected still generates, and the manifest names
exactly what was skipped or errored and why. This page is about
reading that account.

## Prerequisites

- A SKMTC project with the generator(s) installed.
- The schema source reachable.

## Steps

### Re-run with `--json`, capture stderr separately

```bash
skmtc generate <project> --json >generate-output.json 2>generate-stderr.log
```

The JSON form has the same data as the human output but
machine-parseable. Pipe into `jq` for targeted inspection.

**Capture stderr too.** The manifest's `results` tree stores only
status per item (`success` / `warning` / `error` / `skipped` /
`notSupported`) — it does *not* carry the exception message or
stack for errored items. The human-readable error text appears on
the generate command's stderr stream only. Without redirecting
stderr, you see "this operation errored" without seeing why. Two
related logs to know about:

- `.skmtc/<project>/.settings/error-logs.txt` — written by the
  `bundle` step (including the implicit rebundles inside `clone`,
  `install`, and `dev`). Contains the `deno bundle` subprocess
  stderr. **Generate-time worker errors do not land here**; only
  bundle-time errors do.
- Stderr from `skmtc generate` — the live stream is where
  generate-time exceptions are reported. Persist it via shell
  redirection if you want it later.

### Inspect parseIssues

```bash
jq '.manifest.parseIssues' generate-output.json
```

Parse issues are non-fatal but indicate the schema model is
incomplete. Common sources: missing required fields, unresolvable
`$ref`s, type-array shapes that didn't normalize cleanly.

If `diagnostics` is empty, the parse phase succeeded — the issue
is downstream.

### Check enrichment warnings

```bash
jq '.manifest.enrichmentWarnings' generate-output.json
```

If a customization silently didn't land, this is where the engine
says why: typo'd routing keys, unknown enrichment keys (with
nearest-key suggestions), and entries orphaned by schema changes all
surface here. See the
[enrichment warnings reference](../../reference/error-codes.md#enrichment-warnings).

### Check per-operation results in the manifest

```bash
jq '.manifest.files[] | { path: .destinationPath, result: .result }' generate-output.json
```

Each file has a `result` field — `success`, `warning`, `error`,
or `skipped`. Skipped operations are usually filtered by
`isSupported` or `skip`/`include` settings.

### Cases

#### Missing unstable-worker-options flag

The first `skmtc generate` on a machine exits at runtime with:

```
Unstable API 'Worker.deno.permissions'. The --unstable-worker-options
flag must be provided.
```

`@skmtc/worker` constructs each per-project Worker via the Deno-specific
`Worker.deno.permissions` API, which sits behind the
`--unstable-worker-options` flag. The flag is baked into the `skmtc`
binary at install time, so a binary installed without it fails here.

Fix: reinstall the CLI with the flag. The `curl` installer
(`curl -fsSL https://skmtc.dev/install | sh`) includes it; if you installed
with a bare `deno install`, overwrite the binary:

```bash
deno install -gAf --minimum-dependency-age=0 --unstable-worker-options \
  --name skmtc jsr:@skmtc/cli
```

Deno holds back any version published in the last 24 hours, and
`@skmtc/*` publishes on every merge — so without
`--minimum-dependency-age=0` an unpinned install resolves the *previous*
CLI, reports success, and leaves you on the version you were trying to
replace. If a stale `~/.deno/bin/.skmtc/deno.lock` is also pinning that
version, delete it first (`rm -f ~/.deno/bin/.skmtc/deno.lock`).
`skmtc doctor` reports both conditions.

On Deno ≤ 2.5.4, drop the flag — the gate doesn't exist there and the
argument is unknown, so the install fails with
`error: unexpected argument '--minimum-dependency-age' found`. The flag
parses from 2.5.5 onward, where it is an accepted no-op until the gate
itself arrives in 2.9. (The CLI does this for you wherever it builds the
command itself.)

#### No output for an operation

Check, in order:

1. **Is it being skipped?**
   `jq '.manifest.files[] | select(.result == "skipped")'` — the
   path and skip reason should be informative.
2. **Is it filtered out by `isSupported`?** Read the generator's
   `mod.ts` — its `isSupported` function decides which operations
   to run for. Common gates: method must be POST (`gen-shadcn-form`),
   response must be a list (`gen-shadcn-select`/`gen-shadcn-table`).
3. **Is its schema component pruned?** Schema components with
   parse errors get pruned, and their dependent operations may be
   too. Look in `diagnostics` for parse errors on the relevant
   refs.

#### Wrong output

Read the generated file. The output is whatever the generator's
Projection produced. If it's wrong:

- **Hardcoded values?** The generator's source has hardcoded peer
  imports, paths, or other values. Those are clone seams — see
  [tutorial: cloning a generator](../../authoring/tutorials/01-cloning-a-generator.md).
- **Missing fields?** The schema model may not have what you
  expect. Inspect via `skmtc generate --json` and look at how
  the parser interpreted your spec.

#### Module not found in generated code

Two common causes:

1. **Cross-generator import to a generator not installed.** E.g.,
   `gen-shadcn-form` imports from `@skmtc/gen-tanstack-query-supabase-zod`.
   If you have the fetch variant installed instead, the generated
   import won't resolve. Either install the expected peer or
   clone `gen-shadcn-form` and swap the import.
2. **Stale bundle.** If you cloned a generator and edited it, but
   didn't `skmtc bundle`, the old bundle is used. `skmtc doctor`
   flags this.

## Verification

After the fix, regenerate and confirm:

- Parse diagnostics are empty (or only the expected ones)
- Per-operation results match expectations
- The output content matches what the generator should produce

## Troubleshooting

- **`skmtc generate` exits non-zero but artifacts look fine** —
  Likely a parse warning at error severity. Check `manifest.parseIssues`.
- **Different output on each run** — Should be impossible; the
  engine is deterministic. If you see this, file an issue —
  likely a memoization or impurity bug.
- **The error trace points at SKMTC source** — Usually a real
  engine bug. Capture the trace, manifest, and minimal repro.

## Related

- [Manifest format reference](../../reference/manifest-format.md)
- [Error codes reference](../../reference/error-codes.md)
- [`skmtc doctor` reference](../../reference/cli/doctor.md)
- [`skmtc agent-context` reference](../../reference/cli/agent-context.md)
