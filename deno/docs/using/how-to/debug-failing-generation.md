# How to debug a failing generation

> Diagnose why `skmtc generate` produced no output, the wrong
> output, or threw an error.

## When to use this

Generation didn't produce the files you expected, the files have
unexpected contents, or the CLI exited non-zero.

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
(`curl -fsSL https://skm.tc/install | sh`) includes it; if you installed
with a bare `deno install`, overwrite the binary:

```bash
deno install -gAf --unstable-worker-options --name skmtc jsr:@skmtc/cli
```

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

#### `TypeError: this.context.X is not a function` (workspace fallback to JSR)

You see a runtime exception of the form `TypeError:
this.context.insertNormalizedModel is not a function` (or any other
context method) during `skmtc generate`, and `bundle.js` visibly
contains a similar-but-spelled-differently method (e.g.,
`insertNormalisedModel` vs `insertNormalizedModel`, or `toRefName`
vs `getRefName`). The bundle ran something, but the runtime says
the method doesn't exist.

This is almost always **two `@skmtc/core` versions in the same
bundle** — the result of a workspace member silently falling back to
the JSR-published version. Mechanics:

1. `@skmtc/worker` pins `@skmtc/core` with an *exact* version, e.g.,
   `"@skmtc/core@0.4.0"`.
2. Your local workspace member declares a different version, e.g.,
   `@skmtc/core@0.4.4`.
3. Deno's workspace resolution checks `0.4.4` against the exact-pin
   `0.4.0`, doesn't match, and **silently fetches `@skmtc/core@0.4.0`
   from JSR for the worker's transitive use**. The bundle ends up
   containing one `GenerateContext` from the worker (JSR-pinned core)
   and another from the generators (compiled against the local
   workspace core). When the generator calls
   `this.context.someMethod`, `this.context` is the worker's
   GenerateContext at runtime — the wrong one.

Diagnose:

```bash
cat .skmtc/<project>/.settings/error-logs.txt | grep -i "Workspace member"
```

The fallback emits a line like:

```
Warning: Workspace member '@skmtc/core@0.4.4' was not used because
it did not match '@skmtc/core@0.4.0'
    at https://jsr.skmtc.dev/@skmtc/worker/0.2.0/mod.ts:1:58
```

The warning surfaces only in `error-logs.txt` — the `bundle` command
doesn't print it on stdout, the generate run doesn't mention it, and
`doctor` doesn't currently surface it as an error. The log file is
the authoritative diagnostic.

Fix: bring the worker's expected `@skmtc/core` version in line with
the workspace, either by upgrading the worker to a version with a
ranged pin (`^0.4`) or by pinning the workspace member to the
worker's exact-pinned version. The bundle then includes only one
copy of `GenerateContext` and the method exists at runtime.

#### Same-name collision (Driver throws; bare register silent)

Two generators produce a definition with the same `(identifier.name,
exportPath)`. Behavior depends on the insertion path:

- **Driver path** (`insertModel` / `insertOperation` /
  `insertNormalizedModel`): the second writer throws
  `Registered definition mismatch: '<name>' in file '<exportPath>'.
  Cached key '<key>' does not match new key '<key>'`. Loud failure
  via `affirmDefinition`.
- **Bare `register({ definitions })`**: first writer wins; second
  is silently discarded. No warning logged.

Symptoms:
- *Driver path:* generation aborts with the mismatch error — look
  at the file and key in the message to identify the colliding
  generators.
- *Bare register:* a file is missing content you expected. Confirm
  by checking each generator's output independently (uninstall the
  others temporarily).

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
- [`skmtc-debug` skill](../../skills/skmtc-debug/SKILL.md) —
  broader debugging operational guidance
