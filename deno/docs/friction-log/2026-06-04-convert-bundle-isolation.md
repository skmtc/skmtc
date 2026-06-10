# 2026-06-04 — Making `@skmtc/convert` bundle clean (ajv + host-global isolation)

Swapped npm `swagger2openapi` for the in-repo `@skmtc/swagger2openapi`, then chased a
downstream report that `@skmtc/convert` "doesn't bundle / 500s in the runner". Ended up
isolating ajv and all filesystem I/O out of convert's dependency graph and re-releasing
the whole chain to local JSR. Infrastructure/packaging work on the `deno` workspace, not
generator authoring.

## Knowledge acquired

Operating on the host-side normalization path (`@skmtc/convert` → `swagger2openapi` /
`openapi-down-convert`) and the `@skmtc/server` runner, plus the workspace release tooling.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `@skmtc/convert` calls the converter via a **dynamic** `await import('@skmtc/swagger2openapi/converter')`. `deno bundle`/esbuild cannot tree-shake individual exports out of a *dynamically*-imported namespace — every export of that module (and its transitive graph) is retained. So any heavy dep (ajv) or host global (`Deno.readTextFile`) sharing the module rides into the bundle as dead code. | skmtc-architecture skill — host/Worker boundary + "convert must be Workers-portable"; add a bundling note |
| K2 | `deno bundle` (native, 2.7.14) **does** resolve `ajv-draft-04`'s CJS deep-requires successfully (532KB bundle, 187 modules). The "won't bundle at all" failure the downstream agent reported is bundler/toolchain-specific, not universal — verify a bundler claim on *this* toolchain before acting. | none (verify-first reflex) |
| K3 | The `deno` workspace has a cascade release tool: `deno task release` (`.scripts/release.ts`). It treats any package whose `deno.json` version is unpublished as a direct release and **auto-rewrites downstream `@skmtc/*` pins + patch-bumps** dependents in dependency order. Its cascade only fires for deps that are *pending* on the registry — a manual `deno publish` spends that trigger and orphans downstream pins. | Was undocumented at session start; now in `skmtc/deno/CLAUDE.md` + root `CLAUDE.md`. Confirm it lands in a release how-to |
| K4 | `convert` and `openapi-down-convert` packages carry **no per-package `fmt` config**, yet their source is single-quote/no-semi. Bare `deno fmt` there reformats every file to double-quote/semi (1000+-line phantom diff). Only some packages (`swagger2openapi`, `core`) have the `fmt` block. | Captured in `[[project_skmtc_deno_fmt_style]]` memory; the real fix (add fmt blocks / root config) is uncodified |
| K5 | `@skmtc/server` runs convert **host-side**, not in the sandboxed generator Worker (`worker/types.ts`: doc is "already converted to 3.0 host-side via `@skmtc/convert`"). So convert's bundle cleanliness matters for the *server/host* (a CF Worker, lab-api), not the generator worker. The server exposes `POST /to-v3-json` = pure `toV3Document(stringToSchema(...))`, a generator-free way to exercise the runner's convert path. | skmtc-architecture skill — clarify convert is host-side; note `/to-v3-json` as the isolated test seam |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Dynamic `import()` defeats tree-shaking, dragging dead I/O/ajv into the bundle | friction | open |
| 2 | Cascade release tool undiscoverable; manual publish drifted downstream pins | friction | open |
| 3 | Bare `deno fmt` destroys packages that lack a `fmt` config block | friction | open |
| 4 | Isolate heavy/IO deps from a dynamically-imported pure core via subpath + `io.ts` | win | open |

---

### 1. Dynamic `import()` defeats tree-shaking, dragging dead I/O/ajv into the bundle [friction]

Observed while trying to get `Deno.readTextFile` and ajv out of `@skmtc/convert`'s bundle.

**What happened:** convert lazily loads the converter with `await import('@skmtc/swagger2openapi/converter')` (deliberate, to avoid loading it for the common OAS 3.0/3.1 path). I first moved convert's import to a converter-only subpath to drop ajv — that worked (ajv gone). But `Deno.readTextFile` references persisted in the bundle (3 of them). The cause: a dynamic `import()` pulls the **whole module namespace**, so esbuild must retain *every* export of `converter.ts`, including `convertFile` (which calls `Deno.readTextFile`) even though convert only ever calls `convertObj`. Tree-shaking that would have dropped `convertFile` under a static `import { convertObj }` does not happen under `import('…')`.

**What was expected:** that importing only `convertObj` at runtime would let the bundler drop the unused `convertFile`/`convertUrl`/`convertStream` exports and their I/O.

**Why it matters:** "lazy dynamic import for Workers-portability" is a natural and recommended-looking move, but it silently disables per-export tree-shaking. The fix is physical module separation, not import-style tweaks: I split all I/O (`resolveExternal`, `convertFile`/`convertUrl`/`convertStream`/`convertObjResolve`) into a new `io.ts`, leaving `converter.ts` and `common.ts` pure. Same lesson recurred in `openapi-down-convert`, where a `scopeDescriptionFile` path option pulled `Deno.readTextFileSync` into the constructor's reachable graph — fixed by switching to a `scopeDescriptions` *object* option (pass data, not a path).

**Possible fixes:** unresolved — could be a skmtc-architecture note ("keep I/O in a separate module from any dynamically-imported pure core; consumers needing a subset get a narrow subpath export"); could be an invariant in the convert/host-portability docs.

**Version anchor:** `@skmtc/convert@0.1.15`, `@skmtc/swagger2openapi@0.1.2`, `@skmtc/openapi-down-convert@0.14.7`, `@skmtc/core@0.6.12`

**Status:** open

### 2. Cascade release tool undiscoverable; manual publish drifted downstream pins [friction]

Observed when asked to "republish convert and bump the consumer pins".

**What happened:** I executed those literal steps by hand — `deno task publish` in the package dir, then manually edited `server`/`cli` convert pins — without checking for existing release tooling. A purpose-built `deno task release` (`.scripts/release.ts`) existed that cascades pin rewrites + version bumps downstream and publishes in dependency order. My manual route left `server`/`cli` with edited pins but unbumped, already-published versions: the *published* artifacts still pinned the old `convert`. Worse, re-running `release` afterward reported "nothing to publish" because its cascade only triggers for deps *pending* on the registry — and I'd already manually published convert, spending the trigger. Recovery required hand-bumping the directly-affected consumer's version to re-seed the cascade.

**What was expected:** that the workspace either had no release automation, or that it would detect the drift on a later run.

**Why it matters:** the release process is a deterministic, multi-package cascade — exactly the kind of workflow that should never be done by hand. The tool existed but was undocumented (the root `CLAUDE.md` had no release section; `skmtc/deno/CLAUDE.md`'s "Root Workspace" block even referenced a non-existent `deno task publish`). Discoverability, not capability, was the gap. Now documented in both `CLAUDE.md`s and `[[feedback_skmtc_deno_release_cascade]]`.

**Possible fixes:** unresolved — docs now cover it; the residual SKMTC-level gap is that `release` can't *detect* pin drift caused by an out-of-band manual publish (it keys off pending registry versions only). A `--dry-run`/drift-check could close that.

**Version anchor:** `@skmtc/convert@0.1.15`, `@skmtc/server@0.2.19`, `@skmtc/cli@0.4.12`

**Status:** open

### 3. Bare `deno fmt` destroys packages that lack a `fmt` config block [friction]

Observed while editing `openapi-down-convert/converter.ts`.

**What happened:** after my logical edits I ran `deno fmt` in the `openapi-down-convert` dir to tidy up. That package has **no `fmt` config** in its `deno.json`, so `deno fmt` applied Deno defaults (double-quote, semicolons) and reformatted all 6 files — README, fixtures YAML, all `.ts` — a 1037-insertion / 935-deletion phantom diff burying my 2-file change. Recovery: `git checkout -- openapi-down-convert/` to discard everything, then re-apply only the logical edits by hand in the existing single-quote/no-semi style, gating with `deno check`/`deno lint`/`deno test` only (never `deno fmt`).

**What was expected:** that `deno fmt` respects the workspace house style (single-quote/no-semi). It only does so where a per-package `fmt` block exists.

**Why it matters:** the workspace house style is single-quote/no-semi, but it's enforced per-package and **inconsistently** — `swagger2openapi`/`core` have the `fmt` block, `convert`/`openapi-down-convert` don't. There's an existing memory ([[project_skmtc_deno_fmt_style]]) warning about this, which I failed to recall before running the command. The deeper fix is to stop relying on agent memory: give every package a `fmt` block, or add one root-level config, so `deno fmt` is always safe and idempotent.

**Possible fixes:** unresolved — add the `fmt` block to `convert` + `openapi-down-convert` `deno.json` (and any other config-less member), or a single workspace-root fmt config; this is an SKMTC-code change, not just a doc note.

**Version anchor:** `@skmtc/openapi-down-convert@0.14.7`, `@skmtc/convert@0.1.15`

**Status:** open

### 4. Isolate heavy/IO deps from a dynamically-imported pure core via subpath + `io.ts` [win]

The pattern that resolved entry #1, worth prescribing.

**What happened:** to make `@skmtc/convert` bundle clean for the host CF Worker, two structural moves did the work that no import-style change could: (1) a **converter-only subpath export** (`@skmtc/swagger2openapi/converter`) so the ajv-based validator (re-exported from the package root `mod.ts`) never enters the consumer's graph; (2) a dedicated **`io.ts`** holding all filesystem/network functions, leaving `converter.ts`/`common.ts` pure, so the dynamically-imported module has zero host globals. Result: convert's bundle went 620KB/191 ajv refs/3 `Deno.` refs → 166KB/0/0, verified against the published chain and exercised through the live `server` `/to-v3-json` runner.

**Why it matters:** an agent making a host/Worker-portable converter will instinctively keep `convertObj` and `convertFile` in one file and rely on tree-shaking — and be silently defeated by the dynamic import (entry #1). The correct, non-obvious approach is physical separation plus a narrow subpath for subset consumers. This isn't written in any skill; it's the concrete mechanism behind the "convert must be Workers-portable" invariant referenced in code comments.

**Possible fixes:** unresolved — candidate for a skmtc-architecture note on packaging host-side dependencies for the Worker bundle (subpath exports for subset consumers; `io.ts` separation for any module loaded via dynamic `import()`).

**Version anchor:** `@skmtc/swagger2openapi@0.1.2`, `@skmtc/convert@0.1.15`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 / #4 — dynamic-import tree-shaking + io.ts isolation | The non-obvious root cause of "convert won't bundle / 500s"; will recur for anyone hardening host-side deps for the Worker bundle, and the fix mechanism is unwritten | skmtc-architecture skill: add a host-bundle packaging note (dynamic import retains the whole namespace; separate `io.ts`; subpath for subset consumers) |
| 2 | #3 — bare `deno fmt` wrecks config-less packages | Recurs every edit to `convert`/`openapi-down-convert`; memory exists but was missed, so the durable fix is code not memory | SKMTC code: add a `fmt` block to every config-less workspace package (or a root fmt config) |
| 3 | #2 — release cascade drift detection | The tool can't detect pin drift from an out-of-band manual publish; docs now steer toward `deno task release`, but a guard would harden it | `.scripts/release.ts`: add a `--dry-run`/drift check |
