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

### Re-run with `--json`

```bash
skmtc generate <project> --json > generate-output.json
```

The JSON form has the same data as the human output but
machine-parseable. Pipe into `jq` for targeted inspection.

### Inspect parseIssues

```bash
jq '.manifest.diagnostics' generate-output.json
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

#### No output for an operation

Check, in order:

1. **Is it being skipped?**
   `jq '.manifest.files[] | select(.result == "skipped")'` — the
   path and skip reason should be informative.
2. **Is it filtered out by `isSupported`?** Read the generator's
   `mod.ts` — its `isSupported` function decides which operations
   to emit for. Common gates: method must be POST (`gen-shadcn-form`),
   response must be a list (`gen-shadcn-select`/`gen-shadcn-table`).
3. **Is its schema component pruned?** Schema components with
   parse errors get pruned, and their dependent operations may be
   too. Look in `diagnostics` for parse errors on the relevant
   refs.

#### Wrong output

Read the emitted file. The output is whatever the generator's
Projection produced. If it's wrong:

- **Hardcoded values?** The generator's source has hardcoded peer
  imports, paths, or other values. Those are clone seams — see
  [tutorial: cloning a generator](../../extending/tutorials/01-cloning-a-generator.md).
- **Missing fields?** The schema model may not have what you
  expect. Inspect via `skmtc generate --json` and look at how
  the parser interpreted your spec.

#### Module not found in generated code

Two common causes:

1. **Cross-generator import to a generator not installed.** E.g.,
   `gen-shadcn-form` imports from `@skmtc/gen-tanstack-query-supabase-zod`.
   If you have the fetch variant installed instead, the emitted
   import won't resolve. Either install the expected peer or
   clone `gen-shadcn-form` and swap the import.
2. **Stale bundle.** If you cloned a generator and edited it, but
   didn't `skmtc bundle`, the old bundle is used. `skmtc doctor`
   flags this.

#### Same-name collision (silent)

Two generators produce a definition with the same `(identifier.name,
exportPath)`. First writer wins; second is silently discarded.
No warning emitted in the current engine.

Symptom: a file is missing content you expected. Confirm by
checking each generator's output independently (uninstall the
others temporarily).

## Verification

After the fix, regenerate and confirm:

- Parse diagnostics are empty (or only the expected ones)
- Per-operation results match expectations
- The output content matches what the generator should emit

## Troubleshooting

- **`skmtc generate` exits non-zero but artifacts look fine** —
  Likely a parse warning at error severity. Check `manifest.diagnostics`.
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
