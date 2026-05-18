# 2026-05-17 — Cross-generator composition: selector ↔ tanstack-query ↔ filters

A long mobile-app generator session covering: (1) a bottom-sheet filter UI refactor in `gen-shadcn-selector`, (2) replacing replicated peer-naming with `insertOperation(TanstackQuery, …)`, (3) diagnosing 40 orphan stub `.tsx` files from `gen-shadcn-table`, (4) catching/handing-off two regressions caused by the recent `gen-tanstack-query-fieldplan` factory extraction, and (5) extracting a new `gen-fieldplan-filters` package so the URL-filter hook is shared between table and selector via a single cache-keyed Definition.

## Knowledge acquired

Multi-generator FieldPlan project (`@skmtc/core@0.5.1`, `@skmtc/cli@0.2.6`); cross-gen composition was the dominant theme.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `insertOperation(Peer, op)` returns `Inserted<P, E>` with both `.toIdentifier(): Identifier` and `.toName(): string`. Stock generators inconsistently use `.toIdentifier().name` (table → factory) and `.toName()` (selector → tanstack query) and `.identifier.name` is NOT exposed (TS2551). The `skmtc-generator` skill §3 example uses `.toName()`; that should be canonicalised. | Pick one canonical form in the skill and update example snippets; document the full `Inserted` surface in the API reference. |
| K2 | The Driver does NOT enforce the peer's `isSupported` when a generator calls `insertOperation(Peer, op)`. Cross-gen calls bypass both `isSupported` and `skip`/`include`. The user articulated as principle that cross-gen calls should still respect `isSupported` even when bypassing intent gating — this is a divergence between stated philosophy and implementation. | Either tighten `OasOperationDriver` (assert peer `isSupported` on cross-gen call) or document the gap in skill §3 with an explanation of why the caller bears the responsibility. |
| K3 | `client.json#settings.include` semantics: once the array is non-empty, any generator not mentioned in ANY entry is silently excluded. To narrow ONE generator while keeping others active, the include array must mix string entries (whole-package whitelist) with object entries (per-operation narrowing). Single-narrow without re-listing the others kills every other generator. | Already covered in skill §7 in text — add a worked example showing the mixed-shape pattern for "narrow gen-X while everyone else runs as before." |
| K4 | The manifest cleans up files from prior runs that the current run doesn't claim. After fixing `gen-shadcn-table`'s constructor + adding an `include` allow-list, all 40 orphan stub `.tsx` files vanished from disk on the next `skmtc generate` — no manual `rm` needed. This is a load-bearing guarantee. | Add as an explicit behavioural guarantee in skill §10 ("Card: Customizing a published generator") and in the manifest-format reference: "files claimed by a prior run but not the current run are deleted from disk." |
| K5 | Constructor side-effects (`register`, `insertNormalizedModel`, `insertOperation`) commit imports into the destination file map BEFORE the Definition itself is registered by the Driver. If a downstream invariant throws, the file is left in the file map with imports but no Definition → serialised as an orphan stub `.tsx` with only the import header. Order of side effects vs invariants in the constructor is load-bearing for the no-orphan-files guarantee. | Add to skill §4 operational principles ("Constructor invariants must precede side-effecting register/insert calls") AND to §9 verification checklist. |
| K6 | When a generator extracts an internal layer (e.g., `gen-tanstack-query-fieldplan` extracting `TanstackQueryFactory` + `PaginatedQueryFn`), the consumer-boundary contract on the EXTRACTED layer is easy to drift. The new `PaginatedQueryFn` returned the full Zod envelope (`{success, data: {items, total}}`) but the consumer (`useWindowedPages` via `gen-shadcn-table`) expects `{items, total}` at the root — the old inlined queryFn was doing `.parse(raw).data`, the new layer dropped the `.data`. | Skill or refactor playbook: "when extracting a layer between a generator and its consumer, audit the type at the new boundary against EVERY existing consumer." |
| K7 | A wrapping hook that always emits `factory()(...args)` regardless of whether the inner takes args produces TS2554 for parameterless operations. Generators that build wrappers around composed callables need to gate the args-passing on whether the inner has a non-empty parameter list. | Pattern note in `gen-tanstack-query-fieldplan` skill section if one exists; otherwise as a tip in the generator skill's composition section. |
| K8 | Spurious CLI exit on `skmtc bundle`: `Error: bundle.js was expected at ... but wasn't written` is thrown even when the bundle WAS written (file present with correct size and fresh mtime). Cost real time across this session checking `ls -la` after every bundle. Looks like a race between the post-write check and the deno bundler's actual disk write. | File against `@skmtc/cli` (likely `bundle-headless.ts:70`); document workaround in skill §10: "if bundle.js mtime is fresh, ignore the error and proceed." |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Constructor side-effects before invariants produce orphan stubs | friction | open |
| 2 | Cross-gen `insertOperation` ignores peer's `isSupported` | friction | open |
| 3 | Inherited replication pattern in cloned generator survived multiple sessions before being caught | friction | open |
| 4 | Three-layer separation: capability / intent / defensive contract | win | open |
| 5 | Layer-extraction refactor silently changed the consumer-boundary contract | friction | open |
| 6 | Spurious `bundle.js wasn't written` error on every successful bundle | friction | open |
| 7 | Manifest auto-cleanup of dropped artifacts on regenerate | win | open |

---

### 1. Constructor side-effects before invariants produce orphan stubs [friction]

Investigating ~40 `.tsx` files in `mobile-app/src/components/tables/` that contained only imports and no `export const`.

**What happened:** `gen-shadcn-table`'s `ShadcnTable` constructor was structured as:

```ts
constructor(args) {
  super(args)
  const itemsSchema = toListItemsSchema(operation)
  invariant(itemsSchema, ...)                       // pure check, OK
  this.itemTypeName = this.insertNormalizedModel(TsProjection, ...).identifier.name
  this.factoryName  = context.insertOperation({ projection: TanstackQueryFactory, ... }).toIdentifier().name
  // ... other classification work
  invariant(enrichments?.rowComponent, ...)         // THROWS for 40 operations
  invariant(enrichments?.rowSkeletonComponent, ...)
  // ... never reached
}
```

For every list endpoint that matched the paginated-list capability gate but didn't have `rowComponent` enrichment (40 of them), the constructor reached the enrichment invariants AFTER the `insertNormalizedModel` and `insertOperation` calls had already registered imports into the destination file's import map. The invariant throw aborted the constructor before the Driver wrapped the result in a Definition — but the file existed in `context.#files` with two registered imports. Serialiser emitted them as a 4-line stub `.tsx` with no `export const`.

Diagnosed by reading the constructor and reasoning about which calls have side effects vs which are pure. The fix was a two-step:

1. Add `include` allow-list to `client.json` so the table generator only fans out to the 5 enriched paths (intent gating — the canonical SKMTC pattern, per the table generator's own comment).
2. Reorder the constructor: enrichment + schema invariants FIRST, side-effecting calls after. Defensive hygiene so a future regression doesn't leak orphans.

After both fixes regen produced 0 orphan stubs and manifest cleanup removed the 40 already on disk.

**What was expected:** A constructor invariant failure to leave no artifact at all — the manifest reports "error", no file lands on disk.

**Why it matters:** This is a generalisable invariant for ANY Projection constructor with side-effecting cross-gen calls. The skill's §4 operational principles cover `toString()` purity but say nothing about constructor *ordering*. The principle: defensive throws must precede side-effecting `register` / `insertNormalizedModel` / `insertOperation` calls, so a contract violation leaves no residue. Without this rule, any clone-and-edit generator that adds a defensive invariant in the obvious place (after the classification/composition setup) introduces the same orphan-stub hazard silently.

**Possible fixes:** Unresolved — either (a) add to skill §4 anti-patterns + §9 verification checklist, (b) make the Driver clean up the file-map entry when a constructor throws, or (c) both. (b) is more robust; (a) is cheaper to ship.

**Version anchor:** `@skmtc/core@0.5.1`, `@fieldplan/gen-shadcn-table@0.0.1`

**Status:** open

---

### 2. Cross-gen `insertOperation` ignores peer's `isSupported` [friction]

User articulated a design principle during discussion of how generators should activate.

**What happened:** During the discussion of capability vs intent gating, the user stated: *"Whether it actually runs should depend on skip/include settings or whether generator is being called by another generator as a dependency, in which case it should run independent of its skip/include settings, but still respect isSupported."*

I checked the Driver flow (§3 of skill): `insertOperation` → cache lookup → on miss, `new Peer(...)` runs. There's no consultation of `Peer.isSupported`. The engine's top-level transform iteration consults `isSupported`, but cross-gen insertion does not.

Implication: a generator can force a peer to build a Definition for an operation the peer's capability gate would have rejected. Today's Drivers give callers more rope than the user's stated principle allows.

**What was expected:** The principle and the implementation to match. Either the principle was wrong (caller's responsibility — current behaviour) or the implementation is too permissive.

**Why it matters:** This is a load-bearing question for the cross-gen contract. If `isSupported` is a "capability claim," then forcing a peer to build for an unclaimed operation undermines that claim — the peer might throw or produce broken output. The current model says "caller, you'd better know what you're doing." That works for ad-hoc compositions but creates a footgun when a new caller is added.

Concrete instance: my new `gen-fieldplan-filters` calls `insertOperation(FilterStateHook, op)` from both the table and the selector. `FilterStateHook.isSupported` returns true only for operations with at least one url-filter param. If a table calls `insertOperation(FilterStateHook, op)` for an operation with zero url-filter params, the hook is still built (the empty-filters branch returns a constant record) — but the caller's behaviour wasn't asserted by the Driver. If `FilterStateHook` ever tightens its isSupported (e.g., reject ops with no params at all), no caller is warned at the call site — they just get a different runtime output.

**Possible fixes:** Unresolved. Options: (a) tighten `OasOperationDriver` to call `peer.isSupported(...)` on cross-gen and throw with a clear "peer doesn't claim this op" error; (b) keep current behaviour but document the contract explicitly in skill §3; (c) hybrid — Driver issues a warning (not throw) when peer's isSupported would return false, leaving caller free to override.

**Version anchor:** `@skmtc/core@0.5.1`

**Status:** open

---

### 3. Inherited replication pattern in cloned generator survived multiple sessions before being caught [friction]

The selector's `ShadcnSelector.ts` contained a replicated `toHookName` function mirroring `gen-tanstack-query-fieldplan`'s naming algorithm.

**What happened:** When I refactored the selector's filter UI to the bottom-sheet pattern, I preserved a `toHookName(operation)` function in `ShadcnSelector.ts` with a comment justifying the replication: *"Replicated rather than imported so this generator doesn't take a hard dependency on that package's internals; the rule is small and stable, and an upstream drift surfaces as a missing import at consumer compile."*

User pushed back: "Hard dependency is not a bad thing, it is a requirement. We are using tanstack react-query to load data and thus MUST do so via skmtc insert cross-generator mechanism." The replicated function was wrong from the start; I had inherited and *preserved* it across the bottom-sheet refactor without auditing whether it followed SKMTC's principles. Worse, the comment justifying the replication encoded the wrong mental model and made the wrong pattern look principled.

After the user's correction, replacing it with `this.insertOperation(TanstackQuery, operation).toName()` took ~5 lines of edit but unlocked: peer cache-key parity, auto-import-registration, and pickup of any consumer-side `hookName` enrichment override (which the replicated version silently ignored).

**What was expected:** Existing code in a cloned generator to follow the framework's principles.

**Why it matters:** Clones are "deliberately customisation seams" (skill §1 fact #3), but that doesn't mean every line in a clone is principled. Cloned generators carry forward whatever the human author wrote, including anti-patterns. When a later session edits a clone, the audit-against-principles step is easy to skip if the existing structure looks superficially coherent. The comment justifying the replication was particularly dangerous — it made the wrong pattern look intentional and defensible.

Specifically for cross-gen composition: the test for "is this code following SKMTC principles" is *"does this function/string/number duplicate something a peer generator could provide via `insertOperation`?"* If yes, it's a replication anti-pattern regardless of how stable the duplicated logic looks.

**Possible fixes:** Unresolved. Options: (a) skill §10 task cards add an "audit existing code in a clone before editing" step; (b) skill §4 anti-pattern table gains an entry: "Inherited algorithm replication in cloned generator — audit comments justifying replication, they are usually wrong"; (c) a doc on "auditing a cloned generator for SKMTC-principle violations" as a how-to.

**Version anchor:** `@skmtc/gen-shadcn-selector@0.0.1` (clone)

**Status:** open

---

### 4. Three-layer separation: capability / intent / defensive contract [win]

User articulated a sharper framing for generator activation than what's in the skill today.

**What happened:** During the orphan-stubs discussion, the user said: *"whether a generator runs should not be controlled by the generator itself. It should use isSupported to decide what operations it supports, ideally not based on enrichments. Whether it actually runs should depend on skip/include settings or whether generator is being called by another generator as a dependency."*

This crystallised three distinct concerns that the skill treats separately but doesn't name as a unified frame:

1. **Capability** → `isSupported`. Pure schema/shape predicate. *"Can I produce a correct artifact for this op?"* No enrichment-presence checks.
2. **Intent** → `client.json#settings.include` / `skip`. Consumer-driven. *"Do I want this artifact?"* Never owned by the generator.
3. **Defensive contract** → constructor invariants. *"If you instantiated me, these preconditions had better hold."* Runtime assertions with clear messages — NOT gating logic.

Concrete payoff: re-cast the `gen-shadcn-table` orphan-stub fix correctly. My initial framing of the constructor reorder was "an alternative to adding include." Wrong — they address different layers. `include` is the intent fix; the reorder is defensive-contract hygiene. Both are needed, neither replaces the other.

**Why it matters:** Without this frame, agents (including me, in this session) conflate the layers and propose half-fixes. The most common bad reach is "gate isSupported on enrichment presence" — which collapses capability into intent and forces a sentinel value for "default everything." The skill's §4 anti-pattern table covers that specific mistake but doesn't give agents the broader frame that explains *why* it's a mistake.

The win: this is a single principle that explains the right answer to several recurring questions in generator authoring. It belongs in the skill's top-level operational principles, not buried in an anti-pattern row.

**Possible fixes:** Unresolved. Options: (a) add to skill §4 as a top-level operational principle ("The three layers of generator activation: capability / intent / defensive contract"); (b) dedicated section in skill before §4 that names this frame; (c) cross-reference from existing anti-patterns to the unified principle.

**Version anchor:** `@skmtc/core@0.5.1`

**Status:** open

---

### 5. Layer-extraction refactor silently changed the consumer-boundary contract [friction]

Investigating remaining `pnpm types` errors after the new gen-fieldplan-filters extraction landed.

**What happened:** Two unrelated regressions surfaced from the prior `gen-tanstack-query-fieldplan` refactor that extracted `TanstackQueryFactory` + `PaginatedQueryFn` as a layer between the wrapping `useFoo` hook and the data fetch.

Regression A: the new `PaginatedQueryFn.toString()` emitted `return ${zodResponseName}.parse(raw)` (the full envelope `{success: true, data: {items, total, ...}}`), but the consumer (`useWindowedPages<T>`) expects `WindowedPageData<T> = {items, total}` at the root. The previous inlined queryFn did `return ${responseSchema}.parse(raw).data` — the `.data` unwrap was lost in the extraction.

Regression B: the wrapping `useFoo = () => useQuery({ ...useFooFactory()({}), ... })` unconditionally passes `({})` to the factory's inner function, but parameterless operations have an inner with zero args → TS2554 "Expected 0 arguments, but got 1" in 3 generated files.

Both broke during type-check after the user's recent refactor commit, not after my work. I initially dismissed them as pre-existing, then re-examined when the user asked me to look properly. Both were clearly caused by the extraction.

**What was expected:** Layer extraction to preserve the consumer-facing contract.

**Why it matters:** This is a generalisable risk for any generator refactor that extracts an internal layer. The old code had the unwrap inlined and the call-site contract baked together. Pulling the unwrap into the extracted layer is fine IF the extracted layer preserves the same output shape. The reviewer of the extraction has to audit EVERY consumer of the old shape against the new shape — but the consumer might not be in the same generator package (here: `gen-shadcn-table` consumes the factory output via `useWindowedPages`, lives in a separate package).

The skill doesn't have a "refactoring an existing generator" playbook. The risk pattern: extract a layer → forget to preserve the consumer-boundary shape → silent regression that only surfaces at consumer compile-time.

**Possible fixes:** Unresolved. Options: (a) skill how-to: "Extracting a sub-Projection from an existing one — auditing the consumer boundary"; (b) generator authoring guideline: "When extracting a layer, write the contract test FIRST against existing consumer expectations"; (c) snapshot-test the generator output before/after extraction to catch shape changes.

**Version anchor:** `@skmtc/gen-tanstack-query-fieldplan@0.0.1`

**Status:** open

---

### 6. Spurious `bundle.js wasn't written` error on every successful bundle [friction]

Every `skmtc bundle mobile-app` call this session.

**What happened:** Every invocation exited non-zero with a stack trace:

```
error: Uncaught (in promise) Error: bundle.js was expected at file://...bundle.js but wasn't written
    at bundleHeadless (file://.../skmtc/deno/cli/lib/bundle-headless.ts:70:11)
    at async renderBundle (...)
```

But the file WAS written every time — correct size (870-876 KB), fresh mtime matching the moment of the bundle command. The CLI's post-write existence check appears to race the deno bundler's actual disk write.

Cost across the session: ~6 bundle calls × ~30s each to verify `ls -la` confirmed fresh mtime. Not blocking, but corrosive — I started ignoring the error reflexively and would have missed a real "bundle didn't write" case if one had occurred.

**What was expected:** Exit 0 when the bundle is successfully written.

**Why it matters:** The CLI's promise of "exit 0 = success" is the agent's primary signal. A spurious always-fails exit teaches the agent to ignore exit codes for that command, which weakens every signal. It also pollutes any CI pipeline that wraps `skmtc bundle`.

**Possible fixes:** Unresolved. Likely needs investigation in `bundle-headless.ts:70` (per the stack trace) — either the check is racing the writer, or the check is reading the wrong path, or the writer is throwing-then-recovering and the check fires from the throw branch.

**Version anchor:** `@skmtc/cli@0.2.6`

**Status:** open

---

### 7. Manifest auto-cleanup of dropped artifacts on regenerate [win]

After fixing the orphan-stubs issue (entry #1).

**What happened:** When I asked whether to manually delete the 40 orphan `.tsx` files, the user replied: *"skmtc keeps track of its output via manifest and can clean up artifacts that are no longer produced."*

I ran `skmtc generate mobile-app --json` after adding the `include` allow-list. File count dropped from 399 → 337. `ls components/tables/` confirmed only the 5 enriched tables remained — the 40 orphans had been deleted from disk automatically.

Verified later with the `gen-fieldplan-filters` extraction: hooks files appeared on disk on first run, would similarly vanish if their source operations were dropped from `include`.

**Why it matters:** Two things change once this guarantee is internalised:

1. Agents stop reaching for manual `rm` / `git clean` to remove stale generated files. The right tool is `skmtc generate` after the include/source change.
2. `include` / `skip` becomes a safe knob for iterative scoping. Adding a path → file appears. Removing a path → file disappears. The disk state always reflects the manifest.

Without this guarantee, agents would either accumulate stale files indefinitely or risk over-aggressive `rm` that nukes hand-written files. With it, the manifest is the single source of truth for what's claimed.

This isn't a "this worked smoothly" entry — it's a load-bearing behaviour that affects how I should reason about iterative scoping. It belongs in the skill as a named guarantee, not inferred from "the manifest tracks files."

**Possible fixes:** Unresolved. Options: (a) skill §10 task card mentions explicitly: "Re-running `skmtc generate` after dropping operations from `include` deletes the corresponding generated files from disk — no manual cleanup needed"; (b) manifest-format reference adds a "file lifecycle" section.

**Version anchor:** `@skmtc/cli@0.2.6`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Constructor side-effects before invariants produce orphan stubs | Non-obvious failure mode (40 silent stub files in this session); generalises to any clone-and-edit generator that adds defensive invariants in the obvious place. | Skill update — add to §4 operational-principles table AND §9 verification checklist. Optional: tighten Driver to clean up file-map entries when constructor throws. |
| 2 | #4 — Three-layer separation: capability / intent / defensive contract | Resolves a recurring confusion (when to gate where) that has tripped multiple sessions. Re-frames several existing anti-patterns under one principle. | Skill update — add as a top-level operational principle BEFORE the §4 table, with cross-references from existing rows that are instances of it. |
| 3 | #2 — Cross-gen `insertOperation` ignores peer's `isSupported` | Divergence between user-stated design principle and Driver implementation. Will keep biting as more cross-gen composition lands (the entire direction of this session). | SKMTC code change OR explicit doc — either tighten `OasOperationDriver` to assert peer's `isSupported` on cross-gen call, or document the gap with the "caller bears responsibility" framing. |
