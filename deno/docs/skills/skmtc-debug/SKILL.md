---
name: skmtc-debug
version: 0.2.0
description: |
  Diagnose failures in SKMTC sessions — no output, wrong output, error
  messages, bundle freshness, parseIssues, "Registered definition
  mismatch", ref cycles, "Module not found" in generated code, or any
  other broken behavior. Applies across both CLI usage and generator
  authoring contexts.

  Use this skill when the user asks "why isn't my generator working",
  "no output for X", "wrong output", "what does this error mean",
  "manifest says X", "bundle is stale", "INVALID_SCHEMA",
  "INVALID_DEPENDENCY_REF", "Registered definition mismatch", "Module
  not found" (in generated code), "ConfigValidationError", or reports
  any other SKMTC failure.

  This skill encodes a **verify-first epistemic stance** — read the
  manifest, check parseIssues, reproduce the failure before proposing
  fixes. Distinct from `skmtc-cli` and `skmtc-generator` which guide
  *doing*; this skill guides *diagnosing*.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC debugging

This skill guides diagnosis of SKMTC failures. The defining feature is
its **epistemic stance**: gather evidence before proposing fixes.

## 1. The verification-first stance

When debugging SKMTC, **verify before stating**.

- The **manifest** is the canonical record of what happened in the
  last run. Read it before assuming behavior.
- The **code** is the canonical record of what runs. Read it before
  trusting docstrings.
- **Docstrings, comments, and training-data priors are not evidence.**
  Drift is real (see §2).
- **Reproduce** the failure before proposing a fix. "Try X" without
  reproduction is guess-and-check, not debugging.

This stance is the load-bearing reason this skill exists separately
from `skmtc-cli` and `skmtc-generator`. Those skills encourage
proposing solutions from operational principles; this one requires
gathering observable evidence first.

## 2. The five facts that override default LLM intuitions

Same five as in the other skills. One debug-relevant note added:

1. **No plugin registry, no dependency graph, no topological sort.**
2. **Render does not run Prettier or Biome.** Output is unformatted.
3. **Generator source code is the customization surface.**
4. **`OasSchema` is a union type, not a class hierarchy.**
5. **Same-named wrapper.** `insertNormalizedModel` exists on both
   `GenerateContext` (takes explicit `destinationPath`) and the
   projection-base wrappers (fill `destinationPath` from
   `settings.exportPath`). Same name, different signatures.

**Drift between docstrings and code is real.** Docstrings and
type comments can lag behind code reorganizations or removals.
When a docstring or comment disagrees with what the function body
actually does, the code is canonical. Any claim sourced from
docstring prose should be verified against the function body.

## 3. Diagnostic paths by symptom

The lookup table. Before proposing a cause, find the symptom and walk
the listed investigation steps in order.

| Symptom | First step | If clean, next step |
|---|---|---|
| No output for operation X | Check `manifest.results` for X's per-operation status | Check `isSupported` predicate; check `client.json` `skip`/`include` |
| Wrong output (compiles) | Read the generator's `toString()` template | Compare against the stock generator's pattern; check `insertOperation` returns |
| Wrong output (doesn't compile) | Run `skmtc generate --typecheck`; read TS errors | Trace TS errors back to the generator source producing the offending line |
| `parseIssue` at `level: 'error'` | Read the issue's `location` | Walk to that path in the OpenAPI doc; check schema validity |
| `INVALID_DEPENDENCY_REF` | Find the upstream `INVALID_SCHEMA` | Fix the upstream schema; dependent issues should heal |
| `Registered definition mismatch: 'X' in 'Y'` | Read the two `generatorKey` values from the error | Clone one generator and disambiguate `toIdentifier` |
| Bundle freshness warning | Compare `deno.json#imports` to imports in `worker.ts` | Run `skmtc bundle <project>` |
| `Max lookups reached` | The ref chain exceeds 10 hops | Inspect the schema for circular refs or chains > 10 |
| Module not found in generated code | Read the unresolved import path in the generated file | Either implement the consumer-side path, or clone the generator and change the import target |
| `No matching export … for import "X"` (bundle time) | Peer-dep version skew | Run `skmtc doctor --json`; check `project-core-pin/<project>` |
| `ConfigValidationError` | Stale manifest schema | Upgrade CLI; the manifest auto-rewrites on next generate |
| Per-generator enrichments arrive as `{}` in the worker | Shim is pinned to old `@skmtc/cli` / `@skmtc/core` | Delete `~/.deno/bin/.skmtc/deno.lock`; reinstall with `--reload` |
| "Raw mode is not supported on the current process.stdin" | Ink command run in non-TTY | Add `--json` flag; ported commands auto-degrade |

For unrecognized symptoms: read `manifest.json`, then read the
relevant source file, then ask the user for the exact error message
verbatim (paraphrased error messages lose diagnostic signal).

## 4. Reading the manifest

The manifest at `<root>/.skmtc/<project>/.settings/manifest.json` is
the canonical record of every decision the engine made in the last
run. Read it **immediately after the run you want to diagnose** —
the next `generate`/`dev` cycle overwrites it.

### Top-level shape

```ts
{
  deploymentId: string         // identifies the run
  traceId, spanId: string      // log correlation
  region?: string
  startAt, endAt: number       // unix-ms; (endAt - startAt) = wall time
  files: Record<string, {      // every file actually written
    lines: number
    characters: number
    destinationPath: string    // resolved output path
  }>
  previews: Record<…, Preview> // UI-facing preview entries per Projection
  mappings?: Record<…, Mapping>
  results: ResultsItem         // per-(generator × item) outcome
  parseIssues: ParseIssue[]    // always present; empty array = no issues
}
```

### `results` — what worked and what didn't

`results` is a **deeply nested record** keyed by trace → span →
`"generate"` → generator package id → identifier:

```jsonc
{
  "trace-1778185255674": {
    "span-1778185255674": {
      "generate": {
        "@skmtc/gen-reapit-form": {
          "query_GetApplicants":      "notSupported",
          "query_GetApplicantById":   "success",
          "mutation_CreateApplicant": "error"
        },
        "@skmtc/gen-zod": {
          "ApplicantModel": "success"
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
| `skipped` | Item was matched but deliberately skipped (e.g., by `client.json` filters) |
| `notSupported` | Generator's `isSupported` returned false — *expected* for items outside the generator's scope |

### Diagnostic workflow against the manifest

1. **"It generated nothing"** — open `results`. If every leaf is
   `notSupported`, no generator's `isSupported` matched any
   operation/model. Check the schema actually has the operations
   expected and that the right generators are installed.

2. **"It generated less than expected"** — grep the `results` subtree
   for the generator in question. Find which identifiers came back
   `notSupported`/`skipped` vs `success`. Identifier format is
   `<protocol>_<operationId>` for operations (`query_…`, `mutation_…`,
   `get_…`, `post_…`) and the model name for models.

3. **"A specific output is missing"** — check `files` first. If the
   `destinationPath` isn't there, find the corresponding identifier in
   `results`. `error` means the generator failed; `notSupported`
   means the engine never reached it.

4. **"Cost / size accounting"** — `files` has `lines` and `characters`
   per output. `(endAt - startAt)` is wall-clock duration.

### jq queries for slicing

```bash
M=<root>/.skmtc/<project>/.settings/manifest.json

# Count by status across all generators in the most recent run:
jq '[.. | strings] | group_by(.) | map({status: .[0], n: length})' "$M"

# All non-success identifiers under a specific generator:
jq '.results[][].generate["@skmtc/gen-reapit-form"]
    | to_entries | map(select(.value != "success"))' "$M"

# Files written by output subdirectory:
jq '.files | to_entries | group_by(.value.destinationPath | split("/")[1])
    | map({dir: .[0].value.destinationPath, n: length})' "$M"

# parseIssues at level "error":
jq '.parseIssues // [] | map(select(.level == "error"))' "$M"
```

Full manifest schema reference: [`reference/manifest-format.md`](../../reference/manifest-format.md).

## 5. Understanding parseIssues

The two-tier error model in Parse:

### Tier 1: per-item isolation

Every per-item parse runs inside `tryParseAt`
(`core/context/tryParseAt.ts`). A throw becomes a `ParseIssue` at
`level: 'error'`, and the item is dropped from the output map.
Siblings continue.

### Tier 2: cascade pruning

`ParseContext` maintains `#refConsumers` (who pointed at this ref)
and `#refErrors` (which refs failed). At end-of-parse,
`removeErroredItems` deletes every consumer of every failed ref,
generating `INVALID_DEPENDENCY_REF` issues for the pruned consumers.

**Implication:** a single root-cause `INVALID_SCHEMA` can produce
many `INVALID_DEPENDENCY_REF` issues elsewhere. The diagnostic move
is to find the *upstream* `INVALID_SCHEMA` and fix it; the
`INVALID_DEPENDENCY_REF` downstream issues typically resolve on
their own.

Cascade pruning is **one hop deep** by current design — transitive
dependents of pruned items may fail later (at generate time) with
`Ref "..." not found` errors. Treat that as a hint that an even-more-
upstream schema is broken.

### Issue types you'll see

- `INVALID_SCHEMA` — top-level schema parse failure
- `INVALID_DEPENDENCY_REF` — cascade-pruned consumer of a failed ref
- `MISSING_OBJECT_TYPE` — schema has `properties` but no `type:
  'object'`; SKMTC inferred object (warning)
- `MISSING_ARRAY_TYPE` — has `items` but no `type: 'array'` (warning)
- `MISSING_STRING_TYPE` / `MISSING_BOOLEAN_TYPE` — similar fallback
  inferences (warning)
- `UNEXPECTED_PROPERTY` — extra key in a schema position (warning)

Full reference: [`reference/error-codes.md`](../../reference/error-codes.md).

## 6. Common failure scenarios with diagnostic paths

### Scenario A: No output for an operation

**Symptom:** `skmtc generate` reports success but a specific
operation produced no files.

1. Open `manifest.json`. Find the per-operation result for the
   missing operation in `manifest.results[traceId][spanId].generate[generatorId][identifier]`.
2. Branches:
   - **`'notSupported'`**: The generator's `isSupported` predicate
     rejected this operation. Check the predicate in
     `gen-<name>/src/mod.ts`.
   - **`'skipped'`**: A filter in `client.json` (`skip` or `include`)
     is excluding it. Check `client.json#settings.skip` and `.include`.
   - **`'success'` but no file**: The generator's `transform`
     returned content (which is discarded) instead of calling
     `register` or `insertOperation`. Read the generator source.
   - **`'error'`**: Read the error message in the manifest (or
     stderr from the run). The generator's constructor or `toString`
     threw.
3. If the result is missing entirely (operation not present in
   `manifest.results`): the operation was pruned at parse time (look
   for `INVALID_SCHEMA` / `INVALID_DEPENDENCY_REF` in `parseIssues`
   at the operation's path).

### Scenario B: Wrong output (compiles)

**Symptom:** Generated TS compiles but has incorrect semantics.

1. Identify the offending file and the offending fragment.
2. Read the generator's `toString()` template. Is the right
   Projection being instantiated? Is the right schema being read?
   (`operation.toRequestBody`, `operation.toSuccessResponse`,
   `schema.resolve()`)
3. Is the right peer Projection being referenced? Check
   `insertOperation(Other, op).toName()` calls — the returned name
   is what the template should embed.
4. Did the constructor's side effects (`register`,
   `insertNormalizedModel`) run? Look for them in the constructor —
   if they're in `toString()`, that's wrong (mutation in `toString`
   is an anti-pattern).
5. If the generator is stock and the output is consistently wrong:
   clone it and inspect the source. If a cloned generator: edit it.

### Scenario C: Wrong output (doesn't compile)

**Symptom:** Generated TS has type errors.

1. Run `skmtc generate <project> --typecheck`. The CLI returns
   diagnostics scoped to this run's files.
2. Map each TS error back to the generator source that produced the
   offending line. Common patterns:
   - **"Module not found"**: The generator produced a path the
     consumer hasn't implemented. Check the generator's `register({
     imports: ... })` calls — the consumer must provide the named
     module at the generated path, or the generator should be cloned
     and the import target changed.
   - **Type mismatch between schema and validator**: The schema → DSL
     conversion produced a Zod (or other) schema with different
     shape than the TS type. Usually the form / hook generator and
     the type / validator generator disagree on the input — check
     that they're using `insertNormalizedModel` consistently for the
     same schema.
   - **Missing properties on a type**: The schema is `optional` /
     `nullable` in a way the generator didn't account for. Read the
     OAS schema for the affected property.

### Scenario D: Bundle freshness warning

**Symptom:** Strict-mode `generate` refuses with
`Error: bundle.js is out of sync with deno.json — add: …` (exit 2).

1. `deno.json#imports` and `worker.ts` declared different generator
   sets. Either was hand-edited without rebundling.
2. Remediation: `skmtc bundle <project>` (rebuilds `worker.ts` from
   `deno.json#imports`).
3. If `worker.ts` was edited by hand: the bundle has unrecorded
   changes; reset by regenerating. Hand-edits to `worker.ts` are
   not supported.
4. Diagnostic: `skmtc doctor --json` surfaces this as
   `project-bundle/<project>`.

### Scenario E: Registered definition mismatch

**Symptom:** `Error: Registered definition mismatch: 'X' in file
'Y'. Cached key 'A' does not match new key 'B'`.

1. Two generators (or two callers within one generator) are
   producing the same identifier at the same `exportPath`.
2. Read the two `generatorKey` values from the error. They identify
   the colliding generators.
3. Branches:
   - **Both are stock generators**: Clone one and change its
     `toIdentifier` to disambiguate.
   - **One is yours**: Your `toIdentifier` is computing the same name
     as a peer. Make it more specific (verb prefix, kind suffix,
     etc.).
4. The error is raised by `OasOperationDriver.affirmDefinition` —
   the cache key uniqueness invariant is enforced strictly for
   Driver-path insertions. (The `insertNormalizedModel`
   fallback-name path does *not* enforce; see `#SKM-47`.)

## 7. Anti-patterns specific to debugging

The defaults to override when in debug mode:

### Don't propose code changes before reproducing the failure

```
❌ "Try changing toIdentifier — that might fix it."
✅ "Let's reproduce first. Run `skmtc generate <project> --json` and
   share the output."
```

"Try X" without reproduction is guess-and-check, not debugging. Each
attempt costs a generate cycle.

### Don't trust docstrings as authoritative

Docstrings and comments can lag behind code changes. Drift
between docs and code is real. **Verify against the function
body, not the comments.**

### Don't extrapolate behavior from training data

This codebase has specific quirks that other codegen tools don't
share:

- No Prettier in the pipeline
- `OasSchema` as a union, not a class hierarchy
- Two spellings of `insertNormali[sz]edModel`
- Worker permissions: `net: false`, `run: false`

Verify each claim against the source.

### Don't assume the bug is in the generator

The failure may be in:

- `client.json` (wrong path, wrong enrichment shape, wrong `include`/
  `skip`)
- The OpenAPI schema itself (malformed, missing `$ref` target)
- A stale bundle (`worker.ts` ↔ `deno.json` drift)
- A version mismatch (peer-pin between `@skmtc/core` and a generator)
- The consumer-side code the generated output imports against
- The user's setup (Deno version, JSR_URL, lockfile staleness)

Walk the diagnostic paths in §3 before deciding.

### Don't restart from scratch unless symptoms warrant it

"Clean install" / "delete `.skmtc` and redo" should not be the first
move. If specific symptoms suggest workspace corruption (manifest
fails to parse, bundle.js is malformed, `deno.json` is invalid JSON),
then targeted recreation makes sense. Otherwise, diagnose specifically.

### Don't suggest `--verbose` or `console.log` before checking the manifest

The manifest already has structured diagnostic data per item. Reading
it is faster than instrumenting the generator. Use `jq` queries from §4.

### Don't paraphrase error messages

When asking the user about an error, request the **exact verbatim
text**. Paraphrased messages lose the discriminator information that
maps to the diagnostic path in §3.

## 8. When to escalate

### Clone a stock generator for inspection

If the bug is in stock generator behavior (e.g., a `gen-shadcn-form`
output is wrong), cloning brings the source local where it can be
read and modified. Once cloned, the diagnostic shifts: now it's a
generator-authoring problem (`skmtc-generator` skill takes over).

### Surface to the friction log

If the diagnosis revealed a pattern (a confusing error message, a
missing API helper, a frequently-misunderstood invariant), the
`skmtc-retro` skill should capture it as a friction-log entry. Don't
let an interesting diagnostic insight evaporate.

### Suggest a SKMTC code change

If the bug is in `@skmtc/core` or `@skmtc/cli` (not in a generator),
propose the fix as a PR or GitHub issue. Distinguish between:

- **Fix in cloned generator** — immediate, local, ships in the
  consumer's repo
- **Fix in core** — slower, upstream, affects all projects

Choosing the wrong level produces friction. Generator-shape bugs
typically belong in the generator; engine-shape bugs belong in core.

## 9. Boundary with other skills

- **skmtc-cli**: hand off when the diagnosis has identified a CLI /
  configuration fix (e.g., "you need to update client.json
  `basePath`"). The `skmtc-cli` skill guides applying the fix.
- **skmtc-generator**: hand off when the diagnosis has identified a
  fix in generator source. The `skmtc-generator` skill guides the
  source edit.
- **skmtc-retro**: end-of-session. Debug sessions often surface
  retro-worthy observations — patterns of confusing error messages,
  missing diagnostic surfaces, recurring failure modes.

The transition: this skill is active *while the LLM doesn't yet know
what's wrong*. Once a root cause is identified, the appropriate
"doing" skill helps with the fix.

## 10. Cross-references

- Verification protocol (canonical): [`llms.md`](../../llms.md#verification-protocol)
- Manifest format reference: [`reference/manifest-format.md`](../../reference/manifest-format.md)
- Parse-issue type reference: [`reference/error-codes.md`](../../reference/error-codes.md)
- Error-handling philosophy: [`concepts/error-handling-philosophy.md`](../../concepts/error-handling-philosophy.md)
- Ref resolution mechanics: [`concepts/refs-and-resolution.md`](../../concepts/refs-and-resolution.md)
- How-to: [`using/how-to/debug-failing-generation.md`](../../using/how-to/debug-failing-generation.md)
- Friction log (where new diagnostic patterns should be recorded): [`friction-log/`](../../friction-log/)
