# 2026-05-13 — gen-shadcn-form allow-list refactor

Migrating `@skmtc/gen-shadcn-form` from a `fields[]`-with-`skip` deny-list
+ separate `layout[]` enrichment to a unified allow-list (`rows[][]` of
inline-grouped fields) plus a separate `synthesized[]` for required-by-OpenAPI
fields the UI doesn't surface. Touched both Projections, the shared
schema-narrowing helper, and the consumer `client.json`. Most of the
session was generator authoring; the tail was a multi-hour debugging
detour into a method-name version drift between the local `@skmtc/core`
workspace member and the published worker's exact-version pin.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc bundle` reports "wasn't written" even after a successful write | friction | open |
| 2 | Worker pins `@skmtc/core` exactly; mismatching workspace members silently fall through to JSR | blocker | open |
| 3 | `--unstable-worker-options` is required by recent Deno but missing from the shipped install shim | friction | open |
| 4 | Failed `generate` truncates consumer `.generated.*` files to 0 bytes | blocker | open |
| 5 | Manifest stores per-item status but no error message — stack is only in stderr / error-logs.txt | friction | open |
| 6 | `OasObject.properties` includes `CustomValue` in the union — `.filter().map()` needs a type predicate to narrow | friction | open |
| 7 | Two-Projection split (wrapper + hook) localized the synthesized-fields change to one Projection | win | open |
| 8 | Extracting `validateAllowList` killed duplication and centralized invariants across both Projections | win | open |

---

### 1. `skmtc bundle` reports "wasn't written" even after a successful write [friction]

Rebundling after generator-source edits.

**What happened:** Every `skmtc bundle mobile-app` invocation in this
session printed:

```
error: Uncaught (in promise) Error: bundle.js was expected at
file:///.../bundle.js but wasn't written
    at bundleHeadless (https://jsr.skmtc.dev/@skmtc/cli/0.2.3/lib/bundle-headless.ts:70:11)
```

I treated this as a hard failure for ~15 minutes — verifying paths,
re-running, checking deno version, etc. Eventually `ls -la bundle.js`
showed it had been written (mtime updated, size sensible), and
`grep validateAllowList bundle.js` confirmed my latest source was in
the output. The "wasn't written" message was thrown after the actual
bundle write succeeded.

**What was expected:** an error-exit from `bundle` to mean the bundle
was not produced.

**Why it matters:** the CLI's most informative diagnostic was elsewhere
(`.skmtc/<project>/.settings/error-logs.txt`), but the bundle command's
visible stderr was a misleading hard error. Agents and humans both
default to "stop, debug" when stderr looks fatal — but here the right
move was "ignore that line, check the bundle and the log." Skill-level
guidance on which output to trust would have saved real time.

**Possible fixes:** unresolved — could be a CLI bug (post-write check
racing the file write), a stale check against a previous bundle path,
or a deliberate-but-overzealous error. The skmtc-debug skill could
mention that this error doesn't necessarily mean failure; the
skmtc-cli skill could surface `.settings/error-logs.txt` as the
authoritative bundle log.

**Version anchor:** `@skmtc/cli@0.2.3`, `@skmtc/core@0.4.4` (local
workspace), `@skmtc/worker@0.2.0`

**Status:** open

---

### 2. Worker pins `@skmtc/core` exactly; mismatching workspace members silently fall through to JSR [blocker]

Investigating cascade `TypeError: this.context.insertNormalizedModel is not a function` errors across every TanstackQuery and gen-shadcn-form operation.

**What happened:** The local `@skmtc/core` workspace member was
version `0.4.4` (American spelling: `insertNormalizedModel`). The
published `@skmtc/worker@0.2.0` imports `@skmtc/core@0.4.0` (British
spelling: `insertNormalisedModel`) with an *exact* version pin.

Deno's workspace resolution checked `0.4.4` against `0.4.0`, didn't
match, and silently fell back to fetching `@skmtc/core@0.4.0` from
JSR. The bundle ended up containing:

- The **worker's `GenerateContext`** (from JSR `@skmtc/core@0.4.0`,
  method named `insertNormalisedModel`).
- The **generators** (compiled against local `@skmtc/core@0.4.4`,
  calling `this.context.insertNormalizedModel(...)`).

Runtime: `TypeError: insertNormalizedModel is not a function` —
because at runtime the context is the British-spelled JSR one. ~30
minutes of investigation reading the bundle, hunting for two
GenerateContext classes, before I noticed the warning sitting in
`.settings/error-logs.txt`:

```
Warning: Workspace member '@skmtc/core@0.4.4' was not used because
it did not match '@skmtc/core@0.4.0'
    at https://jsr.skmtc.dev/@skmtc/worker/0.2.0/mod.ts:1:58
```

User updated the worker to a version with `^0.4` ranged import; the
bundle then used the local 0.4.4 and the spelling aligned. Generation
succeeded.

**What was expected:** when a workspace member matches a peer
dependency by name, it would be used (or refused loudly), not
silently bypassed in favor of the JSR-published version.

**Why it matters:** this is the single most LLM-unique observation in
this session. A version pin like `@skmtc/core@0.4.0` looks innocuous
in `deno.json`. Workspace-member fallback to JSR is invisible from
`deno.lock`, `doctor`, and the bundle command. The only place the
mismatch surfaced was a `Warning` line in a log file the CLI doesn't
mention. The downstream symptom (method-name mismatch causing
`TypeError`) looks like an unrelated runtime bug, sending the
investigator into the wrong region of the codebase.

The pattern: any time a generator calls `this.context.X(...)` and gets
`X is not a function`, and the bundle visibly contains *something*
similar (`insertNormalisedModel` vs `insertNormalizedModel`,
`toRefName` vs `getRefName`, etc.), the first thing to check is
whether two `@skmtc/core` versions are in play.

**Possible fixes:** unresolved. Plausible directions: (a) the worker
uses a caret/range import for `@skmtc/core` so workspace members of
newer minor versions match; (b) the CLI's `bundle` and `doctor`
commands surface workspace-fallback warnings prominently; (c) the
skmtc-debug skill grows a "method-not-a-function" diagnostic flow
that starts at `error-logs.txt` workspace warnings.

**Version anchor:** `@skmtc/core@0.4.4` (local), `@skmtc/core@0.4.0`
(JSR fallback used by worker), `@skmtc/worker@0.2.0`

**Status:** open

---

### 3. `--unstable-worker-options` is required by recent Deno but missing from the shipped install shim [friction]

Trying to run `skmtc generate` for the first time in this environment.

**What happened:** `skmtc generate` (via the shim installed by
`deno install -g jsr:@skmtc/cli@0.2.3 ...`) exited with:

```
Unstable API 'Worker.deno.permissions'. The
`--unstable-worker-options` flag must be provided.
```

The shim at `~/.deno/bin/skmtc` was:

```sh
exec deno run --allow-all --config ... 'jsr:@skmtc/cli@0.2.3' "$@"
```

No `--unstable-worker-options`. Deno 2.7.14 requires this flag for the
worker-options API the SKMTC worker uses. Reinstalled with:

```sh
deno install --global --allow-all --unstable-worker-options \
  --config ... --name skmtc --force jsr:@skmtc/cli@0.2.3
```

After that the shim included the flag and the CLI worked.

**What was expected:** that `deno install -g jsr:@skmtc/cli@<latest> …`
produces a shim that just works.

**Why it matters:** the install step succeeds and prints "Successfully
installed skmtc," so the failure surfaces only mid-command, much later
in the workflow. For agents this means tool-use telemetry can show a
green "installed" then a confusing-looking "generate failed" with no
obvious link between them. The fix is install-time (add the flag),
not config-time.

**Possible fixes:** unresolved. The published install instructions
could include the flag; the CLI shim could be regenerated to embed it
once `@skmtc/cli` requires that API; `doctor` could surface it as a
known-fixup hint. None of those make the friction zero for users on
older shims; a one-line note in the skmtc-cli skill ("if you see
`Unstable API 'Worker.deno.permissions'`, reinstall with
`--unstable-worker-options`") would cover the common case.

**Version anchor:** `@skmtc/cli@0.2.3`, Deno 2.7.14

**Status:** open

---

### 4. Failed `generate` truncates consumer `.generated.*` files to 0 bytes [blocker]

Hit during the cascade-`TypeError` debugging in entry #2 — generate
ran, errored partway, and left the consumer in a broken state.

**What happened:** When `skmtc generate` hit the British/American
spelling cascade, every TanstackQuery + gen-shadcn-form operation
errored. The generator had already opened the output files for
writing (truncating them) but no Definition was ever written. Result:
`mobile-app/src/components/forms/CreateCustomerForm.generated.tsx`
and `CreateLocationForm.generated.tsx` were both 0 bytes after the
run. The consumer app's typecheck would have blown up; the hand-
written forms that imported from these files would have lost their
exports.

Recovery: `git checkout -- src/components/forms/*.generated.tsx` (the
files were tracked, so the committed version came back). If the
forms hadn't been committed, the user would have lost work.

**What was expected:** a failed `generate` would either (a) not touch
any output files, or (b) atomic-rename a fully-written output over
the previous one, so a partial failure leaves the previous output
intact.

**Why it matters:** generated files are real consumer-build inputs.
The "happy path runs, failure mode is destructive" pattern is a sharp
edge — committing before every `generate` becomes a discipline a
user has to learn from getting burned. For CI/agentic workflows
this is worse: an automated pipeline that runs `generate` against
uncommitted regen-state can silently lose work.

**Possible fixes:** unresolved. Likely candidates: write each
generated file to a sibling `.tmp` then atomically rename after the
operation's Definition fully resolves; or stage all writes in memory
and flush only when the whole `generate` run succeeds; or refuse to
write any output if the run's `errors` array would be non-empty.
The skmtc-cli skill could add a "commit before generate" hint to
its `Card: Common workflow` section.

**Version anchor:** `@skmtc/cli@0.2.3`, `@skmtc/core@0.4.4` (local)

**Status:** open

---

### 5. Manifest stores per-item status but no error message — stack is only in stderr / error-logs.txt [friction]

Trying to diagnose the cascade `TypeError` from the `generate --json`
output and `manifest.json`.

**What happened:** `generate --json` reported the failing operations
as an `errors` array of `[traceId, spanId, "generate", generatorId,
identifier]` paths. `manifest.json` mirrored each as
`"/v2/customers%3Apost": "error"`. Neither carried the actual
exception message, stack, or any other detail. The only place the
`TypeError: this.context.insertNormalizedModel is not a function`
text appeared was the worker's stderr stream (and the persisted
`.settings/error-logs.txt`).

I spent time grepping the manifest with python for `message`,
`stack`, etc. before realising the data simply wasn't there.

**What was expected:** that the manifest or the `--json` errors
array carries enough detail to diagnose the failure without re-running
the command and capturing stderr.

**Why it matters:** for agentic workflows, `generate --json` is the
right interface — it produces a single JSON object the agent can
parse. But when a run partially fails, the JSON tells you *which*
items failed without telling you *why*. The diagnostic loop becomes
"re-run without `--json`, parse stderr" — slower and harder to
automate. The skmtc-cli skill's section on JSON output mentions the
errors array shape but doesn't flag that the message lives in stderr.

**Possible fixes:** unresolved. The manifest could grow a `details`
field per errored item (with message + stack); `generate --json`
could include the per-item exception summary alongside the error
path; or the CLI could mirror stderr into a structured log file by
default (already done for `error-logs.txt`, but its name/location
isn't surfaced anywhere). A skill update naming `error-logs.txt`
as the authoritative diagnostic log would help in the interim.

**Version anchor:** `@skmtc/cli@0.2.3`

**Status:** open

---

### 6. `OasObject.properties` includes `CustomValue` in the union — `.filter().map()` needs a type predicate to narrow [friction]

Refactoring the shared `resolveBody` helper out of two duplicated
inline definitions in `ShadcnForm.ts` and `ShadcnFormHook.ts`.

**What happened:** Both original `resolveBody` implementations did:

```ts
const properties = Object.entries(resolved.properties ?? {})
  .filter(([, schema]) => schema.type !== 'custom')
  .map(([name, schema]) => ({
    name,
    schema: schema as OasRef<'schema'> | OasSchema,  // ← cast
    required: required.has(name)
  }))
```

The `as` cast was a workaround for TypeScript not narrowing across
`.filter().map()` — but more importantly, it was hiding the fact
that the input value type *already* admitted `CustomValue`. The
actual type of `resolved.properties` (with `resolved: OasObject`) is
`Record<string, OasSchema | OasRef<'schema'> | CustomValue> | undefined`.
The cast widened from "post-filter OasSchema-ish" to
"OasRef<'schema'> | OasSchema" — but silently dropped the `CustomValue`
case rather than acknowledging it.

The fix: a type predicate on the `.filter` lambda:

```ts
.filter((entry): entry is [string, FormFieldSchema] =>
  entry[1].type !== 'custom'
)
```

Where `FormFieldSchema = OasSchema | OasRef<'schema'>`. TypeScript
now narrows the entry value to the two-way union for the `.map`'s
inferred type. No cast needed.

**What was expected:** that the existing code's `.filter` would
narrow downstream. (It doesn't — TypeScript only narrows across
`.filter` when the predicate has an `is X` return type.)

**Why it matters:** `CustomValue` is a generator-internal schema
variant most generator authors won't encounter directly until they
hit a `Object.entries(resolved.properties)` pattern. The skill's
operational principles table covers schema narrowing in general (use
`.isRef()` then dispatch on `.type`) and mentions single-member
intersections, but doesn't flag the `CustomValue`-in-properties case
specifically. The fix is one-liner once you know to write the
predicate; the trap is knowing to write it at all.

**Possible fixes:** unresolved. The skmtc-generator skill's
"Anti-patterns" section could add a row: "Schema-dispatch chains
that filter `CustomValue` without an inline predicate — narrowing
won't carry across the chain." A helper in `@skmtc/core`
(`isFormFieldSchema(entry)` or similar) could centralize the
predicate. Or `OasObject.properties` could grow a typed sub-view
that pre-filters `CustomValue`.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open

---

### 7. Two-Projection split (wrapper + hook) localized the synthesized-fields change to one Projection [win]

Implementing the `synthesized[]` enrichment — required-by-OpenAPI
fields that don't render in the UI but get spread into the API
payload at submit time.

**What worked:** `gen-shadcn-form` already had a clean split between
`ShadcnForm` (the wrapper + body Projection, owning JSX layout and
field rendering) and `ShadcnFormHook` (the state + submit Projection,
owning `useForm` + the mutation call). Synthesized fields are a
*submit-time* concern only — they're not rendered, not in the body,
not in the watched-fields set. The entire change for the
synthesized-fields feature was one new field on `ShadcnFormHook`
(`synthesizedFields: ResolvedSynthesizedField[]`) and one ternary in
its `toString()`:

```ts
const bodyExpr =
  this.synthesizedFields.length === 0
    ? 'values'
    : `{ ...values, ${this.synthesizedFields
        .map((e) => `${e.id}: values.${e.source.name}`).join(', ')} }`
```

The wrapper Projection (`ShadcnForm`) needed *zero* code changes
related to synthesized fields. The body it emits doesn't reference
them. Cross-Projection independence held up under a new
cross-cutting feature.

**Why it matters:** the alternative — a single mega-Projection that
emits the whole `.generated.tsx` file in one `toString()` — would
have meant the synthesized-fields change interleaved with the body
emit code. Two separate Projections with separate concerns means
new features that hit one concern stay isolated. This is the
"composition by name, not by source" principle paying off at the
within-generator scale, not just the across-generator scale.

**Possible fixes:** N/A (win) — but worth codifying as a recipe in
the skmtc-generator skill: when designing a generator, ask "could
this output naturally split along a state/render boundary?" If yes,
two Projections in the same file at the same exportPath compose for
free via `insertOperation` + same destinationPath.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open

---

### 8. Extracting `validateAllowList` killed duplication and centralized invariants across both Projections [win]

Adding allow-list semantics (every visible field listed in `rows[][]`)
with hard-error invariants (required-by-OpenAPI must be in rows or
synthesized; `synthesized.source` must be in rows).

**What worked:** Both `ShadcnForm` and `ShadcnFormHook` had been
maintaining their own near-identical inline `resolveBody` helpers
with subtle drift (one used `new Set(resolved.required)`, the other
used `resolved.required?.includes(...)`). Adding new validation
(allow-list coverage, source validity) to both files would have
forced me to keep two implementations in lockstep.

Instead I extracted `validateAllowList({ body, rows, synthesized,
operation }) → AllowList` into `resolveBody.ts`. Both Projections now
call it. The invariants live in one place; if the next maintainer
adds another invariant (e.g., synthesized.source must be a
*required* field, not just a present one), there's one site to edit.

The bonus: the returned `AllowList` carries the *resolved* views
(`ResolvedRow[]` with `{ config, property }` pairs, `ResolvedSynthesizedField[]`
with `{ id, source: ResolvedBodyProperty }`). The downstream code in
both Projections gets ready-to-use pairs rather than re-resolving
schema lookups themselves.

**Why it matters:** the temptation when adding a feature across two
similar Projections is to add the feature in both places and call
it done. Resisting that and centralizing the invariants paid off
even within this single session — the validation logic was complex
enough (three distinct error cases) that duplicating it would
already have drifted by the time I was done. The pattern: any logic
that's *runtime invariant on enrichment shape*, not just data
shape, deserves a helper that returns a "validated view" type the
consumers can rely on.

**Possible fixes:** N/A (win) — could be codified in the
skmtc-generator skill as a pattern: when two Projections in the
same generator share an enrichment-validation concern, extract a
`validate<X>({...}) → Validated<X>` helper and have each consumer
use the validated view.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open
