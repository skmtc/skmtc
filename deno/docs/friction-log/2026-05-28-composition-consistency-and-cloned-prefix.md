# 2026-05-28 — Cloned-source R2 prefix mismatch + composition-consistency invariant

This session began by trying to verify "is the new dynamic-worker deploy
pipeline actually running end-to-end?" in the skmtc-hub dev stack. The
verification surfaced a misleading symptom — the same run reported
`stats.artifactCount: 2` but the artifacts-list endpoint returned 5
files. That kicked off an hour of chasing a non-existent generator
state-bleed bug across `@skmtc/core` and `@skmtc/server` before the
real cause turned out to be R2 cleanup, which then led to a structural
fix around how stack source storage is addressed and a new validation
invariant (composition consistency).

This entry captures the diagnostic mis-direction, the architectural
finding underneath, and the fixes — so the next agent who sees a "same
isolate, different output" symptom has the right priors.

---

### 1. The "Worker isolate state bleed" red herring [friction]

**What happened:**

- Run #1 in a session produced 5 artifacts (in R2 listing).
- Subsequent runs of the same release produced 2 artifacts.
- I hypothesized **state leakage across requests in the warm CF Worker
  Loader isolate** — the runner caches the loaded Worker by
  `release.id` (intentional; immutable code identity), so multiple
  runs share an isolate. If `@skmtc/server`'s module init held state,
  or if `@skmtc/core`'s coordination Map persisted across `toArtifacts`
  calls, that would explain it.

I read source carefully:

- `@skmtc/core/context/CoreContext.ts:257` — constructor creates fresh
  `#results = new ResultsLog()` per `new`. ✓ per-request.
- `@skmtc/core/context/GenerateContext.ts:283` — `#files = new Map()`
  per construct. ✓
- `findDefinition` / `register` both reach into `this.#files`. ✓
- `OasOperationDriver` uses `this.context.findDefinition`. ✓
- `Identifier.createVariable` / `createType` always return fresh
  `new Identifier(...)`. ✓ no interning.
- Grep across `deno/core/`: `^let ` at module scope = **0**; module-
  level `new Map()` / `static .*Map` / memoize / `WeakMap` = **0**.
- The same grep across `gen-tanstack-query-fetch-zod/src/` =
  **0 module-level mutable state**.

Three layers reviewed; no leak. The framework is genuinely
request-scoped, by construction.

**What was actually wrong:**

User noticed the discrepancy: `stats.artifactCount` is set by the
runner's write-loop counter; the artifacts-list is an R2 LIST under
`runs/{deploymentId}/{runNumber}/artifacts/`. Different ground truths.
The runner's count was 2. The LIST returned 5. That can only happen
if R2 has stale objects at the same prefix from prior runs.

Checking R2 blob mtimes confirmed: the 3 "extra" files (the service
hooks) were dated *yesterday*, before the source-upload fix landed.
`setup-fixtures.ts` wipes D1 between sessions but does not touch R2.
Every session creates "Run #1" in D1; every Run #1 writes to the same
R2 prefix `runs/dpl_test/1/artifacts/`. The prefix accumulates.

**Why it matters (and the cost of chasing the wrong hypothesis):**

I spent ~90 minutes reading `@skmtc/core` source, `@skmtc/server`,
`@skmtc/gen-tanstack-query-fetch-zod`, and proposing diagnostic
instrumentation (a two-call probe inside `runBundle`). All of it was
wasted because the symptom had a simpler explanation that didn't
involve the framework at all.

**Cue that should have surfaced this faster:**

The single sharpest cue would have been the discrepancy between
`stats.artifactCount = 2` and the artifacts-list `totalCount = 5`.
If the framework were leaking state, BOTH would have been the same
non-2 number (the bundle emits N, the runner persists N, the listing
sees N). The fact that the runner saw 2 and the listing saw 5 was a
ground-truth signal that the leak was below the runner — at the
storage layer, not the engine. Future-me should ask
"does what the program reports match what storage shows?" before
"is there a state bug in the framework?"

**Fix:** `persistRunOutputs` in `skmtc-hub/apps/runner/src/index.ts`
now clears its R2 prefix before writing. The run owns the prefix
exclusively. A vitest unit suite covers the regression — pre-populate
a fake R2 with 3 stale objects + 1 stale manifest, call
`persistRunOutputs` with 2 new artifacts, assert R2 contains exactly
2 + manifest with no leftovers. Tests fail when the cleanup is
removed.

**Status:** resolved (skmtc-hub commit `ee67acb`).

---

### 2. Cloned-source storage at one prefix; reads from another [friction]

**What happened:**

After the R2-cleanup fix, the SPA's stack-generators tab still showed
only 1 of 4 cloned generators. The other 3 cloned-source GET calls
returned `{ entries: [] }` despite the composition listing them.

Tracing the data path:

- `POST /v1/stacks/{a}/{s}/releases/{v}/source` writes every file to
  R2 at `source/{stackId}/{version}/<path>`. A cloned generator's
  files land at `source/{stackId}/{version}/{slug}/...`.
- `GET /v1/stacks/{a}/{s}/cloned/{slug}/source` was reading from
  `cloned/{stackId}/{version}/{slug}/...` — a different R2 prefix
  that only the legacy `setup-fixtures.ts` direct-wrangler path ever
  wrote to.

After the fixture switched to `POST /source`, three of the four
cloned generators had their files at the NEW prefix and nothing at
the OLD one. The GET endpoint read the OLD prefix and got empty
listings.

**Why it matters:**

Two storage locations for "the source of a cloned generator at a
given release" is a sync surface. Any inconsistency between the two
manifests as silent data loss in the SPA. The OpenAPI-style "carve-
out endpoints" pattern made this easy to miss — the URL shape
(`/cloned/{slug}/source`) implies a separate storage domain, but
both URLs really back onto the same logical artifact: the release's
source tree.

**Fix:** `clonedSourcePrefix` in
`apps/service/src/routes/handlers/stacks.ts` now returns
`source/{stackId}/{version}/{slug}/` — pointing at the source-upload
tree. One storage path per artifact class; the cloned-source GET is
a *view* over the source-upload, not a separate domain.

The URL segment `/cloned/{slug}/source` stays because it
communicates provenance ("this slug ships with the release, source
came from the upload"). URL shape is user-facing; R2 layout is
implementation. Keeping them decoupled lets the storage be unified
without an API break.

**Status:** resolved (skmtc-hub commit pending — included in this
session's batch).

---

### 3. Imported vs cloned: deno.json says one thing; on-disk says another [friction → invariant]

**What happened:**

While fixing #2, the user articulated the underlying invariant:

> "If a generator is imported, it should not be cloned. We should
> also have a nice way of correcting discrepancies between deno.json
> and folder contents."

The hub already classifies refs from `deno.json#imports`:

- `"jsr:@scope/gen-X@^1"` → `imported`
- `"./gen-X/mod.ts"` → `cloned`

What was missing: **a check that the on-disk state agrees with the
deno.json classification.** A user can end up in a mixed state by:

- `skmtc clone @scope/gen-X` (creates `./gen-X/`, rewrites import to
  local path) followed by `skmtc install @scope/gen-X` (rewrites
  import back to `jsr:`) without `rm -rf ./gen-X/`.
- Hand-edited `deno.json` that points at `./gen-X/` when no such
  folder exists.
- Vendored-then-forgotten `gen-X/` directory under a project root.

The really painful failure mode: when both a `jsr:` import and a
`./gen-X/` folder exist for the same generator name, **deno's
workspace resolver picks the local folder over the JSR pin**.
The engine runs the vendored source — silently, no warning — even
though the user thinks they're running the pinned version. State the
user can't see, producing output that doesn't match what they
expect, with no diagnostic.

**Why it matters:**

This is a "two sources of truth" failure mode at the user-intent
layer. The CLI commands (`install` / `clone`) emit consistent state,
but stale state is easy to leave behind, and the silent shadowing
gives no signal. Detecting it has to happen at all three layers
where it can be created or surfaced:

- **Skill (read-time guidance):** LLMs assisting `skmtc install` /
  `skmtc clone` should be told these states are mutually exclusive.
  Otherwise an LLM rewriting deno.json in one direction may leave
  the other side stale.
- **CLI (creation- and audit-time):** `skmtc doctor` should detect
  and flag the discrepancy. `install` / `clone` should refuse or
  auto-correct.
- **Hub (final gatekeeper, upload-time):** Reject uploads where the
  composition derived from deno.json contradicts the on-disk folder
  tree. Defense-in-depth — even if the CLI is broken or bypassed
  (curl directly), the hub keeps the data clean.

**The invariant:**

For every `gen-*` token in a project's `deno.json#imports`:

1. `jsr:` import value → **no folder named `gen-X/` in the upload**.
2. `./gen-X/mod.ts` import value → upload must contain `gen-X/mod.ts`.
3. Any `gen-*/` folder in the upload → must be referenced by exactly
   one composition entry.

**Fix (hub side, this session):**

`apps/service/src/lib/composition.ts` exposes
`checkCompositionConsistency({composition, filePaths})` returning a
list of typed inconsistencies + `inconsistencyMessage(issue)` for
human-readable phrasing. Called from
`apps/service/src/routes/handlers/releases.ts` in the source-upload
handler, between deno.json parsing and the R2 writes. Inconsistent
uploads return 422 with precise reasons.

**Fix (CLI side, pending — separate session):**

- `skmtc doctor` check `composition-consistency/<project>`: walk
  `imports` entries matching `gen-*`, cross-reference with on-disk
  folders, emit `error` for mismatches, `warning` for stray folders.
- `skmtc install <gen>` — refuse if `./gen/` folder exists (or
  `--force` removes it).
- `skmtc clone <gen>` — if import is already local, no-op or
  refresh; if import is `jsr:`, rewrite to `./path` and check folder
  contents.

**Fix (skill update, this session):**

`docs/skills/skmtc-cli/SKILL.md` operational principles add an
anti-pattern entry on this exclusivity. See the skill commit
in the same session batch.

**Status:** hub-side resolved; CLI + skill pending. Hub gate ensures
this can never produce a corrupt release row regardless of how the
CLI lands.

---

### 4. Meta: when the framework looks clean, look at storage [friction]

A recurring pattern across §1 and §2 of this entry: I read framework
source carefully and found it clean; the actual bug was at the layer
*below* the framework (R2 storage, prefix mismatch). The investigation
cost was high because I started at the wrong layer.

**Heuristic for next time:**

When chasing "same code, different output across two invocations":

1. **First, compare different views of the same artifact.** What does
   the in-process counter say? What does storage report? What does
   downstream consumption produce? If two views diverge, the bug is
   between them, not in the layer that produced the original.
2. **Then check storage cleanup.** Does each invocation own its
   write surface exclusively? Does the test scaffolding clean
   between runs?
3. **Last, suspect the framework.** Module-level state, isolate
   caches, memoization — these are EXPENSIVE to investigate. Don't
   start here unless steps 1 and 2 are clean.

In SKMTC's case, `@skmtc/core`'s request-scoping is well-established
and well-tested (`core/context/GenerateContext.variants.test.ts` etc.
exist). The system's invariants point AWAY from framework leakage as
a likely cause. The misdirection was specifically because the
symptom *resembled* a state bleed; the heuristic above would have
short-circuited that.

**Status:** captured. Could fold into a `skmtc-debug` skill section
on "diagnostic prior ordering" if the pattern recurs.

---

### Cross-references

- skmtc-hub commit `ee67acb` — runner R2-prefix cleanup + regression test
- skmtc-hub composition-consistency commit (this session)
- Skill update `docs/skills/skmtc-cli/SKILL.md` (this session)
- Worker Loader handoff: `skmtc-hub/notes/handoff-2026-05-28-dynamic-workers-deploys.md`
- Generator skill anti-patterns (`docs/skills/skmtc-generator/SKILL.md` §8) already covers many state-bleed surfaces but doesn't explicitly call out "your framework grep is clean → look at storage / cleanup next." Worth a §8 entry if the pattern recurs.
