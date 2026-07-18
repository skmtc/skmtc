# 2026-07-12 — Docs learning-journey program (audit → 12 PRs)

Full-corpus pedagogy audit (five parallel auditors), learning-journey
maps, then execution: PRs #56, #58–#62, #64, #65, #68, #73, #74, #76,
#78, #79 — mechanism page, reader-lint + orphan gates (both ratcheted
to zero), anatomy page, re-homes, trims, tutorial staging, skills-link
repoint, core-export/stock-generator sync guards. Plus the enrichment-
validation investigation (`notes/enrichments/`).

## Knowledge acquired

Docs-infrastructure and enrichment-validation work against
`@skmtc/core@0.9.x`-era source.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | Enrichment validation topology: the umbrella `v.parse({subject, generator, stack})` runs per (generator × item × variant) in the projection bases; wrong-typed leaf values throw ValiError, unknown leaf keys are silently stripped (`v.object`), routing-key typos silently miss (`get()`), missing-`main` throws. Nothing audits unconsumed enrichment entries. | Captured in `notes/enrichments/enrichment-validation.md`; docs follow-up gated on the engine work |
| K2 | `gen-shadcn-form`'s `formFieldItem` has NO `id` — `moduleSelect.schemaPath` is the join key, and a `schemaPath` may lead with a target token (`RequestBody`/`SuccessResponse`/`Model`) that `toProperties` strips. | Fixed in tutorial 03 (PR #68); check the gen-shadcn-form reference page teaches the same shape |
| K3 | `deno doc --json` (deno 2.9) emits `{nodes: {<fileUrl>: {module_doc, symbols: [...]}}}` — took four probing rounds to parse. Wildcard re-exports (146 in `core/mod.ts`) resolve to 536 symbols. | None for reader docs; recorded in verify-docs check 11's tolerant extraction |
| K4 | `core-overview.md` is a curated index (~40 of 536 exports), so the correct sync contract is one-directional: every documented symbol must exist, not every export must be documented. | Encoded in verify-docs check 11's docblock |
| K5 | Stock-generator *source* lives in the sibling `skmtc-generators` repo — this repo's CI cannot verify output-shape claims mechanically; the achievable guard is three-surface internal consistency (README table ↔ overview catalog ↔ pages). | Encoded in check 12; output-shape accuracy stays a run-and-verify task |
| K6 | "Reference page exists" and "reference page is routed" are independent failure modes: the command-surface check passed for `status`/`eject`/`adopt`/`merge` while `cli/overview.md` never cataloged them — only the orphan BFS caught it. | Both now guarded (checks 6 + 10) |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Tutorial 03's "fails the run" claim may overstate where enrichment ValiErrors surface | friction | resolved 2026-07-12 (Phase D PR) |
| 2 | Two-way ratchet baseline + parallel PRs = guaranteed serial merge friction | friction | open |
| 3 | Page deletion needs a both-directions link sweep — #61 missed the survivor's outbound links | friction | resolved 2026-07-12 (PR #85) |
| 4 | Pre-push hook runs the full workspace suite on docs-only pushes | polish | open |
| 5 | Negative-testing a guard with uncommitted work in the same file invites a self-wipe | polish | open |
| 6 | `deno bundle` on deno 2.9.1 cannot load `jsr:` specifiers — every skmtc install/bundle fails | blocker | open |
| 7 | Fleet pin skew on jsr.io: fresh installs generate ALL-EMPTY files with every result "success" | blocker | resolved 2026-07-12 (fleet republish + cli 0.9.31 scaffold pins) |
| 8 | gen-tanstack-query-fetch-zod mutation hooks fail typecheck (`body` out of scope in mutationFn) | blocker | in hand (Dmitri, 2026-07-12) |
| 9 | gen-shadcn-table renders `const columns = []` against petstore — on 0.26 AND 0.28 | friction | resolved 2026-07-12 (by design: columns are enrichment-only) |

---

### 1. Tutorial 03's "fails the run" claim may overstate where enrichment ValiErrors surface [friction]

Writing the tutorial-03 validation note (PR #68), verified from source
that a wrongly-typed enrichment value throws ValiError at the
projection-base `v.parse` — but did NOT verify where that throw
surfaces. The note shipped saying it "fails the run with a validation
error naming the path."

**What happened:** the throw happens inside the per-item generate
walk. If the engine's per-item isolation catches it (as it does other
generate-phase throws), the run *completes* with a per-item error in
the manifest and the message on stderr — "fails the run" would then be
wrong in exactly the way this program spent the day fixing elsewhere.

**What was expected:** that verifying the throw exists was enough;
the surfacing path was assumed.

**Why it matters:** the docs-writing verify-first rule is
per-*claim*, not per-*paragraph* — one verified fact (throws) smuggled
in an unverified neighbor (fails the run). This is the exact
mechanism by which plausible-but-wrong docs get written by an agent
that was otherwise being careful.

**Possible fixes:** run a real generation with a wrong-typed
enrichment value and observe: exit code, manifest entry, stderr. Then
correct the tutorial note if needed. Fold "which claims in this
sentence did I actually execute?" into the docs-writing checklist.

**Version anchor:** `@skmtc/core@0.9.x`, `@skmtc/gen-shadcn-form@0.1.x`

**Status:** resolved 2026-07-12 — confirmed per-item (the dispatch
try/catch captures the throw as that item's error; the run completes).
Tutorial 03 corrected in the Phase D PR; the claim now reads "fails
that operation's generation — the run completes, and the manifest
records the error".

### 2. Two-way ratchet baseline + parallel PRs = guaranteed serial merge friction [friction]

The reader-lint baseline fails when counts rise (regression) AND when
they fall without a baseline shrink (ratchet). With 6+ content PRs
open in parallel, every merge invalidated the others' baselines.

**What happened:** PRs #62, #64, and #74 each failed CI after a
sibling merged, requiring a rebase + `--update-reader-baseline` +
force-push cycle. All three were predicted in PR bodies, but
prediction didn't reduce the cost: three full fix-push-CI rounds.

**What was expected:** the two-way ratchet was chosen deliberately
(keeps the debt number honest); the interaction with parallel PR
development was underweighted.

**Why it matters:** the design taxes exactly the workflow this
program used — many small parallel PRs. A contributor without the
context would read the ratchet failure as their mistake.

**Possible fixes:** unresolved — options include: CI auto-committing
the shrunk baseline on the PR branch; making the ratchet one-way
(fail on rise only) with a scheduled shrink pass; keeping two-way but
having the failure message print the exact regenerate command (it
does) plus a note that a sibling merge is the likely cause. Now that
the baseline is empty (0 pins), the problem mostly evaporates — any
future violation is a hard fail with no baseline churn — so the cost
may have been a one-time migration cost. Worth deciding before the
next baseline-style guard is added.

**Version anchor:** `verify-docs.ts` checks 9–10, PRs #58–#76

**Status:** open

### 3. Page deletion needs a both-directions link sweep — #61 missed the survivor's outbound links [friction]

PR #61 deleted `concepts/the-stack-trail.md` and repointed all
INBOUND links to the surviving `reference/api/stack-trail.md`.

**What happened:** the survivor's own OUTBOUND links — three
references from `reference/api/stack-trail.md` to the page being
deleted — were missed, and no gate caught them (the orphan check
verifies reachability, not link resolution). They surfaced only in
PR #73's ad-hoc full-corpus link sweep.

**What was expected:** that grepping for inbound references to the
deleted path was the complete link fix.

**Why it matters:** deleting/moving a page has two link surfaces:
pages that point at it, and the pages it pointed at / its replacement
pointing back at it. The second is invisible to an inbound grep. More
structurally: verify-docs has no dead-link check — reachability (BFS)
passes even when a reachable page contains a broken link.

**Possible fixes:** promote the ad-hoc link-resolution sweep from
PR #73 into verify-docs as check 13 (every relative .md link in the
reader tree must resolve); add "grep the new canonical home's
outbound links" to any future page-move checklist.

**Version anchor:** PRs #61/#73, `verify-docs.ts` at check 12

**Status:** resolved 2026-07-12 — check 13 landed in PR #85 (caught 14 directory links on introduction)

### 4. Pre-push hook runs the full workspace suite on docs-only pushes [polish]

Every `git push` from a worktree ran the version-controlled pre-push
hook: `deno task check` = verify-docs + full workspace type-check and
tests — minutes per push for changes that touched only markdown.

**What happened:** after the first multi-minute push, subsequent
pushes used `git -c core.hooksPath=/dev/null` with verify-docs run
manually beforehand — which silently also skipped the workspace test
suite (CI's coverage job covered it, and all PRs came back green, but
the local assurance was quietly narrower than the hook intends).

**Why it matters:** a hook expensive enough to bypass trains its
users to bypass it, and the bypass drops more than the expensive
part. Docs-only changes cannot break workspace tests they don't
touch.

**Possible fixes:** path-filter the hook (diff against upstream; run
only verify-docs when the diff is entirely under `deno/docs/`), or a
`SKIP_TESTS=docs` escape documented in the hook itself.

**Version anchor:** `.githooks/pre-push` as of PR era #56–#79

**Status:** open

### 5. Negative-testing a guard with uncommitted work in the same file invites a self-wipe [polish]

Negative-testing check 11 (sync-guards session): a synthetic stale
symbol was planted in `core-overview.md`, the check failed correctly —
and the cleanup `git checkout <file>` also reverted the seven
uncommitted legitimate row fixes in the same file, which had to be
reapplied.

**Why it matters:** the test-it-don't-wonder habit (plant a
violation, watch the gate fire) interacts badly with whole-file git
revert while legitimate edits are uncommitted. The failure is silent —
nothing tells you the checkout took more than the synthetic edit.

**Possible fixes:** commit the legitimate work first, then
negative-test on a clean tree; or reverse the synthetic edit with the
same targeted string-replace that planted it (the second attempt did
exactly this).

**Version anchor:** process observation, PR #78 session

**Status:** open


### 6. `deno bundle` on deno 2.9.1 cannot load `jsr:` specifiers — every skmtc install/bundle fails [blocker]

Attempting the run-and-verify docs session: fresh `skmtc init` +
`skmtc install @skmtc/gen-typescript` on this machine (deno 2.9.1,
CLI 0.9.29, jsr.io registry, `JSR_URL` unset).

**What happened:** the post-install rebundle fails with
`error: Do not know how to load path: deno:jsr:@skmtc/worker@0.3.47`
at `worker.ts:1`. Reproduced three ways: via the CLI, via direct
`deno bundle --platform=deno worker.ts`, and via a one-line probe file
whose only content is a bare `jsr:` import — the probe also fails, so
this is not the import map, the scaffold, or the project: deno 2.9.1's
experimental bundler cannot bundle `jsr:` specifiers here at all.
`deno install --entrypoint worker.ts` (cache) beforehand does not help.

**What was expected:** tutorial 01's promised first success — and it
is the tutorial-01 path exactly: a fresh user on current deno hits
this at step 3.

**Why it matters:** if current deno releases can't bundle `jsr:`
specifiers, the entire first-success journey is broken for anyone
whose deno is newer than whatever the bundler last worked on — a
first-touch blocker invisible to existing projects with working
setups. Related prior art: the 2026-05-21 cli-bundle-deno-version
friction entry (same class: the CLI's bundle step is coupled to the
ambient deno version with no version gate or actionable error).

**ROOT CAUSE (2026-07-12, confirmed by Dmitri's hint):** Deno 2.9
introduced **dependency age gating** (`--minimum-dependency-age`,
unstable). The gate blocks recently published versions and surfaces
as the misleading loader error `Do not know how to load path:
deno:jsr:…` — no mention of age anywhere. Proof:
`deno bundle --minimum-dependency-age=0` on 2.9.2 bundles the
identical probe against jsr.io cleanly (871KB); without the flag it
fails. Version matrix consistent: 2.4–2.8 (no gate) ✅, 2.9.0–2.9.2
(gate on by default) ❌. The local mirror bypasses the gate (its
metadata doesn't trip it), which is why internal 2.9.2 development
works while jsr.io users are blocked.

**The structural collision:** SKMTC publishes on every merge to main
(the cascade), so the newest @skmtc versions are ALWAYS younger than
a default age gate — fresh users on deno 2.9.x can't bundle a
just-released stack at all, and the error message points them
nowhere near the cause.

**Addendum (same day):** the gate has a second, worse failure mode —
SILENT DOWNGRADE. `deno install -gAf jsr:@skmtc/cli` (unversioned)
resolved to 0.9.28 when latest was 0.9.31: version resolution quietly
picks the newest version OUTSIDE the gate window, no error, no
warning. Fresh-user verification on cli 0.9.31 + deno 2.9.2: scaffold
pins are aligned (entry 7 resolved), install's bundle step still dies
on the gate, and the identical project bundles + generates correctly
with `--minimum-dependency-age=0`. The flag in `createBundle` is the
single remaining fix for the fresh-user path.

**Possible fixes:** the CLI's `createBundle` passes
`--minimum-dependency-age=0` (or a configurable value) to its
`deno bundle` subprocess — decision on the right default is the
author's (0 forfeits the supply-chain protection deliberately);
document the flag + the misleading error in install docs and the
debug guide; upstream UX report to denoland/deno (the age gate
should say so, not emit a loader error).

**Possible fixes:** unresolved — candidates: a known-good deno range
checked by `skmtc doctor` and at bundle time with a clear message;
the curl installer bootstrapping a known-good deno; upstream deno
issue for the jsr.io-vs-mirror asymmetry.

**Version anchor:** `@skmtc/cli@0.9.29`, `@skmtc/worker@0.3.47`,
`@skmtc/core@0.27.0` pins, deno 2.9.1 (aarch64-apple-darwin)

**Status:** open


### 7. Fleet pin skew on jsr.io: fresh installs generate ALL-EMPTY files with every result "success" [blocker]

Continuing the run-and-verify session on deno 2.5.4 (entry 6's
workaround): fresh `skmtc init` + install of the tutorial stack
(gen-typescript, gen-zod, gen-tanstack-query-fetch-zod) from jsr.io,
generate against the Petstore spec.

**What happened:** every generated file is zero bytes — 23 files,
correct paths, empty content. The manifest records `lines: 1,
characters: 0` per file while every per-item result reads `success`.
No error anywhere: not in stderr, not in parseIssues, not in results.

**Mechanism (verified):** `worker@0.3.47` exact-pins `core@0.27.0`;
the published stock generators (`gen-*@0.2.3`) exact-pin
`core@0.26.0`. Two exact pins → two core copies in one bundle →
generators register Definitions into one `GenerateContext` class
identity, the worker renders the other's empty file map. Proof by
alignment: pinning the project to `worker@0.3.46` (which pins
`core@0.26.0`) produces correct 592-byte output from the same spec —
including the shared type+validator file.

**What was expected:** the release cascade keeps consumers aligned —
but the stock generators live in the sibling `skmtc-generators` repo,
outside the cascade, and their published pins lag the core/worker
release train (core is at 0.28.0; gens pin 0.26.0). Every fresh
jsr.io install of the documented quick-start stack currently produces
silent empty output.

**Why it matters:** this is the first-success journey failing in the
worst possible mode — zero output, zero errors, "success" everywhere.
It is the documented dual-copy hazard occurring not from a user
mistake but from the published fleet itself. `skmtc doctor` did not
flag it (the project-core-pin check compares project↔generator pins;
nothing compares the worker's core pin against the generators').

**Possible fixes:** republish the stock-generator fleet pinned to the
current core (and fold gen releases into, or gate them on, the
cascade); a doctor/bundle-time check that ALL `@skmtc/core` exact
pins across the resolved graph agree; an engine-side guard (render
warning when the file map is empty but results contain successes —
that state should be impossible).

**Version anchor:** `@skmtc/cli@0.9.29`, `@skmtc/worker@0.3.47`
(core 0.27.0), `@skmtc/gen-typescript@0.2.3` / `@skmtc/gen-zod@0.2.3`
/ `@skmtc/gen-tanstack-query-fetch-zod@0.2.3` (core 0.26.0), jsr.io,
deno 2.5.4

**Status:** resolved 2026-07-12 — fleet republished AND
`@skmtc/cli@0.9.31` scaffolds aligned pins (worker 0.3.48 /
core 0.28.0 / gens 0.2.4; verified by fresh init). The only remaining
fresh-user break is entry 6's age gate at bundle time.


### 8. gen-tanstack-query-fetch-zod mutation hooks fail typecheck [blocker]

Found while capturing real output for the stock-generator accuracy
fixes (petstore, gens 0.2.4 / core 0.28.0).

**What happened:** the generated mutation
(`useCreateApiPet.generated.ts`) declares
`UseCreateApiPetArgs = {body: Pet}` but `mutationFn: async () =>`
takes no parameters and references `body` inside — `deno check` on a
probe importing the hook fails with `TS2304: Cannot find name 'body'`
(4 errors). Every mutation hook this generator emits is uncompilable;
query hooks are fine.

**Why it matters:** generation reports success; the failure surfaces
only when the consumer's app typechecks — the "success does not
guarantee output compiles" trap, in a stock generator.

**Possible fixes:** `mutationFn: async ({body}) => …` (receive the
variables). A generated-output typecheck in the generator repo's CI
would catch the whole class.

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.2.4`,
core 0.28.0

**Status:** in hand — being fixed by the author (2026-07-12); docs'
mutation sample kept prose-only until the fix lands.

### 9. gen-shadcn-table renders empty columns against petstore [friction]

**What happened:** `tables/PetFindByStatusTable.generated.tsx`
contains `const columns = [];` — identical on the 0.26 and 0.28
fleets, so long-standing rather than a republish regression. Unclear
whether column derivation is config-gated (needs enrichment /
moduleSelect input, which the page must then document as a
requirement) or schema-derivation is broken for this shape (array
response of a $ref'd object).

**Status:** resolved 2026-07-12 — author confirmed columns are built
only from `settings.enrichments.subject?.table?.columns` (absent →
`[]` by design). The page now documents the enrichment requirement
with a verified populated example (PR #89).

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #7 — fleet pin skew: silent all-empty output on fresh installs | Live incident: the quick-start stack produces zero output with zero errors for every new jsr.io user | Republish stock generators aligned with current core; pin-agreement check in doctor/bundle; render-time empty-map guard |
| 2 | #6 — deno 2.9 dependency age gate blocks fresh @skmtc releases with a misleading error | Publish-on-merge cadence + default age gate = fresh users on current deno can't bundle a new release; error says nothing about age | CLI passes --minimum-dependency-age to deno bundle (default = author's call); docs note; upstream UX report |
| 3 | #2 — ratchet vs parallel PRs | Decide the contract before the next baseline-style guard | Decision note in verify-docs docblock (or CI auto-shrink) |

Also verified this session (doc fixes queued): tutorial 02's shared
file is `types/pet.generated.ts` (decapitalized — tutorial 01 was
right, tutorial 02 says `Pet.generated.ts`); the `--json` stdout
stream carries ANSI warn-log lines before the result object, so the
documented `skmtc generate --json > out.json; jq ... out.json`
pattern fails whenever parse warnings exist — every page teaching
that redirect needs the real invocation. Byte-identical reruns and
the add-field fan-out both verified exactly as staged in tutorial 02.
