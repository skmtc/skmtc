# skmtc-debug skill outline

> Plan for a proposed new skill — diagnose failures in SKMTC
> sessions. Applies across CLI and generator-authoring contexts.

## Status: proposed

This skill does not yet exist. The argument for adding it:

Debugging requires a fundamentally different epistemic stance than
building. When *doing* SKMTC work, the LLM should propose solutions
from operational principles. When *debugging*, the LLM should
**verify before stating** — read the manifest, check parseIssues
against actual files, reproduce the failure before suggesting fixes.

Folding debugging into `skmtc-cli` or `skmtc-generator` means the
LLM's default posture during failures is wrong. A separate skill with
"verify-first" priors is the lowest-cost way to flip that posture
automatically when symptoms suggest something is broken.

## Purpose

Diagnose failures in SKMTC sessions:

- No output produced for an operation that was expected to produce some
- Wrong output (compiles but is incorrect, or doesn't compile)
- Error messages the user doesn't understand
- Bundle freshness or worker setup issues
- Cascading parseIssues from a single bad schema
- "Registered definition mismatch" collisions between generators

The skill's job is to **lead the LLM through evidence-gathering**
before solution-proposing.

## Audience

Anyone with broken SKMTC behavior — users debugging configuration,
authors debugging generators, integrators debugging CI failures. The
defining characteristic is the *symptom*, not the role. When something
is broken, this skill takes priority over the user/author skills.

## Triggers

Intent phrases that should load this skill:

- "why isn't my generator working"
- "no output for X" / "generation produced nothing for X"
- "wrong output" / "the generated code is wrong"
- "this error message" (when accompanied by an error)
- "generation failed"
- "manifest says X"
- "bundle is stale" / "bundle freshness"
- "parseIssue" / "INVALID_SCHEMA" / "INVALID_DEPENDENCY_REF"
- "this doesn't compile" (in the context of generated output)
- "Registered definition mismatch"
- "Module not found" (in generated code)
- "Max lookups reached" (ref cycle)

Should NOT auto-load on:

- "install a generator" → `skmtc-cli`
- "write a generator" → `skmtc-generator`
- "let's retro" → `skmtc-retro`

## Scope boundary

### In skill (operational, just-in-time content)

- **The verification-first stance** — the foundational epistemic
  principle. Read before assert. Reproduce before propose. Check the
  manifest, not the docs, for run state.
- **Diagnostic paths by symptom** — table mapping common failure
  symptoms to ordered investigation steps
- **Reading the manifest** — what each field means, how to interpret
  per-operation results
- **Understanding parseIssues** — types, severities, what cascade
  pruning implies
- **The cascade pruning model** — why a single bad schema can produce
  many `INVALID_DEPENDENCY_REF` issues elsewhere
- **The five common failure scenarios** with reproducible diagnostic
  paths:
  - "No output for operation X"
  - "Wrong output (semantic bug)"
  - "Generated code doesn't compile"
  - "Bundle freshness warning"
  - "Same-name collision (Registered definition mismatch)"
- **Anti-patterns specific to debugging** — defaults to override:
  don't propose fixes without reproducing; don't extrapolate from
  training data; don't read docstrings as ground truth
- **When to escalate** — clone a stock generator for inspection;
  surface to the friction log; suggest a SKMTC code change

### Deferred to docs

- Full error code reference → `reference/error-codes.md`
- Full manifest format → `reference/manifest-format.md`
- How to fix bugs *in generator code* (once located) → `skmtc-generator`
- How to fix bugs *in CLI configuration* (once located) → `skmtc-cli`
- Debug-related tutorials and recipes (when written) → `using/how-to/debug-failing-generation.md`

### Boundary with adjacent skills

- **skmtc-cli**: takes over when symptoms suggest failure. Debug owns
  diagnosis; cli takes over once the user knows what to change in
  config.
- **skmtc-generator**: same — debug owns diagnosis. Once the bug is
  located in generator source, generator skill helps with the fix.
- **skmtc-retro**: end-of-session. If debugging surfaced a SKMTC-level
  pattern worth recording, retro captures it.

The boundary heuristic: **this skill is active while the LLM doesn't
yet know what's wrong**. Once a root cause is identified, the
appropriate "doing" skill (cli or generator) helps with the fix.

## Outline structure

The actual `SKILL.md` should have approximately these sections:

### 1. The verification-first stance

The foundational principle. A short paragraph stating:

> When debugging SKMTC, **verify before stating**. The manifest is
> the canonical record of what happened. The code is the canonical
> record of what runs. Docstrings, comments, and training-data priors
> are not evidence. Read the manifest first. Reproduce the failure
> before proposing a fix. Trust observed behavior over assumed behavior.

This sets the epistemic stance for everything below.

### 2. The five facts that override default LLM intuitions

Same five as in the other skills (duplicated from `llms.md`), with
one extra debug-relevant fact called out:

> **Drift between docstrings and code is real.** Docstrings and
> type comments can lag behind code changes. When a docstring and
> the code disagree, the code is canonical.

### 3. Diagnostic paths by symptom

A table that the LLM consults *before* proposing causes:

| Symptom | First step | If that's clean, next step |
|---|---|---|
| No output for operation X | Check manifest's per-operation result for X | Check `isSupported` predicate; check `skip`/`include` |
| Wrong output (compiles) | Read the generator's `toString()` template | Compare against the expected pattern in the stock generator |
| Wrong output (doesn't compile) | Run `--typecheck`; read TS errors | Trace TS errors back to the generator source |
| `parseIssue` at `level: 'error'` | Read the issue's `location` | Walk to that path in the OpenAPI doc; check schema validity |
| `INVALID_DEPENDENCY_REF` | Find the upstream `INVALID_SCHEMA` | Fix the upstream schema; the dependent should heal |
| `Registered definition mismatch` | Find the two `generatorKey`s | One generator's `toIdentifier` is colliding; clone and disambiguate |
| Bundle freshness warning | Compare `deno.json#imports` to `worker.ts` | Run `skmtc bundle <project>` |
| `Max lookups reached` | The ref chain exceeds 10 hops | Inspect the schema for circular refs |

### 4. Reading the manifest

The canonical reference is `manifest.parseIssues` and the per-operation
results map. Key fields to interpret:

- `parseIssues[]` — each with `level`, `type`, `location`, `message`
- `results[generatorId][operationOrRefName]` —
  `'success' | 'notSupported' | 'skipped' | 'error'`
- Exit code derivation — fatal parseIssue or typecheck failure → 1

Cross-reference to `reference/manifest-format.md` for the full schema.

### 5. Understanding parseIssues

The two-tier error model:

- Per-item: a single bad schema becomes one `INVALID_SCHEMA` issue;
  the item is dropped from output but siblings continue
- Cross-ref: a `$ref` to the dropped item triggers `INVALID_DEPENDENCY_REF`
  on every consumer, and those consumers are pruned

Implication: a single root-cause schema bug can produce many issues.
The diagnostic path is to find the *upstream* `INVALID_SCHEMA` and fix
it; the downstream `INVALID_DEPENDENCY_REF` issues typically resolve on
their own.

Cross-reference to `reference/error-codes.md` for the full list of
issue types.

### 6. Common failure scenarios (with diagnostic paths)

Each scenario gets a short playbook — what to check, in order, with
the typical root cause:

#### Scenario A: No output for an operation

- Check the manifest: was the generator's `transform` called for this
  operation? (Look at the per-operation result.)
- If `'notSupported'`: the generator's `isSupported` rejected the
  operation. Check the predicate.
- If `'skipped'`: a filter in `client.json` (`skip` or `include`) is
  excluding it.
- If `'success'` but no file: the generator's transform may have
  returned content (which is discarded) instead of registering.
- If `'error'`: read the error message in the manifest.

#### Scenario B: Wrong output (compiles)

- Read the generator's `toString()` template. Is the right Projection
  being instantiated? The right schema being read?
- Is the right peer Projection being referenced? Check
  `insertOperation(Other, op).toName()` calls.
- Did the constructor's side effects (`register`, `insertNormalizedModel`)
  run? They're in the constructor, not `toString()`.

#### Scenario C: Wrong output (doesn't compile)

- Run `skmtc generate <project> --typecheck`. TS errors are scoped to
  this run's files.
- Map each TS error back to the generator source that produced the
  offending line. Common patterns:
  - "Module not found": stock generator produced a path the consumer
    hasn't implemented; check `register({ imports: ... })`
  - Type mismatch: schema → DSL conversion produced a Zod schema with
    different shape than the TS type; check `insertNormalizedModel`
    consistency between the two generators

#### Scenario D: Bundle freshness warning

- `deno.json#imports` and `worker.ts` declared different generator
  sets.
- Run `skmtc bundle <project>` (rebuilds `worker.ts` from `deno.json`).
- If `worker.ts` was hand-edited, the bundle has unrecorded changes;
  reset by regenerating.

#### Scenario E: Registered definition mismatch

- Two generators (or two callers within one generator) produce the
  same identifier at the same `exportPath`.
- Read the two `generatorKey` values from the error message.
- Disambiguate by editing one generator's `toIdentifier` (typically
  the cloned one).

### 7. Anti-patterns specific to debugging

The defaults to override when debugging:

- **Don't propose code changes before reproducing the failure.** "Try
  X" without reproducing is guess-and-check, not debugging.
- **Don't read docstrings or comments as authoritative.** Docstrings
  drift; the code is canonical.
- **Don't extrapolate behavior from training data.** This codebase has
  specific quirks (no Prettier, `OasSchema` union, two spellings).
  Verify each claim against the source.
- **Don't assume the bug is in the generator.** It may be in
  `client.json`, in the OpenAPI schema, in a stale bundle, or in
  consumer-side code the generator imports against.
- **Don't restart from scratch** ("clean install" / "delete .skmtc and
  redo") **unless** the symptoms specifically suggest workspace
  corruption.
- **Don't suggest "run with --verbose"** or **"add console.log"**
  before checking the manifest. The manifest already has structured
  diagnostic data.

### 8. When to escalate

- **Clone a stock generator for inspection** — if the bug is in stock
  generator behavior, cloning brings the source local where you can
  read and modify it.
- **Surface to the friction log** — if the diagnosis revealed a
  pattern (e.g., a confusing error message, a missing API helper),
  the retro skill should capture it.
- **Suggest a SKMTC code change** — if the bug is in `@skmtc/core` or
  `@skmtc/cli` itself, propose the fix as a PR or issue. Distinguish
  from "fix in cloned generator" (immediate, local) vs "fix in core"
  (slower, upstream).

### 9. Cross-references

- `using/how-to/debug-failing-generation.md` (or
  `using/how-to/debug-failing-generation.md` if extending)
- `reference/manifest-format.md`
- `reference/error-codes.md`
- `concepts/error-handling-philosophy.md`
- `concepts/refs-and-resolution.md` (for ref-cycle issues)
- `llms.md`'s "Verification protocol" section

## Open design questions

### Should this be its own skill or a section in cli/generator?

The argument for a separate skill: the epistemic stance differs.
Loading the debug skill auto-flips the LLM's posture from
propose-solutions to verify-first.

The argument against: three skills is more than two, and the boundary
between "I'm authoring and stuck" vs "I'm debugging" is fuzzy.

Recommendation in this outline: separate skill. The cost of the third
skill is small (one more file, one more set of triggers); the value of
flipping epistemic stance is large enough to justify it.

### Should debug have its own slash command?

Symmetry with `skmtc-retro` suggests yes — `/skmtc-debug` for explicit
invocation, with the skill also auto-loading on symptom triggers. The
command would be useful when the user knows they're starting a debug
session and wants to invoke the stance deliberately.

### Symptom-driven vs intent-driven triggers

The trigger list above mixes symptom phrases ("no output", "wrong
output") with error-message phrases ("Registered definition
mismatch"). This is intentional — both work as triggers.

The risk: if intent matching fires too eagerly on these phrases, the
debug skill loads when the user actually wanted cli or generator. The
mitigation is the description's wording — be precise about *failures*
(not just questions or curiosities).

### How does debug interact with the manifest reader?

The skill heavily relies on the manifest. If the manifest format
changes, the skill needs to update. Consider: should the skill embed
a reference to specific manifest fields, or defer entirely to
`reference/manifest-format.md`?

Right answer: embed the *most-used* fields (`parseIssues`, `results`)
inline; defer the full schema to the reference doc. Same pattern as
other skills.

### When does the debug skill produce a friction-log entry?

Many debug sessions surface SKMTC-level patterns (confusing error
messages, missing diagnostic surfaces, recurring failure modes).
Currently the user invokes `skmtc-retro` after debugging; the retro
captures observations.

Open question: should the debug skill *itself* prompt for retro
capture before ending? Could be: "before we close out, is there
anything worth logging?" This couples debug to retro in a useful way.

### Should debug produce structured output?

For agents (not humans), structured output may be valuable. The
manifest is already structured; a debug skill could produce
"diagnostic reports" in a consistent format. Defer until there's
demand.
