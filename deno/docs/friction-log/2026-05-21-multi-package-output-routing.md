# 2026-05-21 — Routing cloned-generator output across a monorepo

Customized cloned `gen-zod`, `gen-typescript`, and `gen-supabase-hono` to
write into a pnpm monorepo (`packages/models`, `apps/mock-server`), added a
barrel file and a root hono aggregator, and scaffolded `@skmtc/models` with a
tsdown build. Continuation of `2026-05-20-clone-generator-version-skew.md`.

## Knowledge acquired

Operating on cloned generators against `@skmtc/core@0.6.2` / `@skmtc/cli@0.3.4`,
producing output for a multi-package workspace.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `toResolvedArtifactPath` = `join(basePath ?? './', destinationPath.replace(/^@\//, ''))`. The `@/` prefix is **stripped by regex**, then joined. A `toExportPath` returning a `../`-relative path (no `@`) therefore climbs **out** of `basePath` — `join` normalizes the `..`. This is the mechanism for writing generated files outside `basePath`. | Missing — `skmtc-generator` skill / a how-to on output outside basePath |
| K2 | SKMTC has first-class **multi-package** support: `client.json#settings.packages: [{ rootPath, moduleName }]`. `normalizeModuleName` (`dsl/File.ts`) resolves a cross-file import three ways: importer+target in the same package → `exportPath.replace(rootPath, '@')` (intra-package `@/…`); different packages → the target package's `moduleName`; no package match → the raw exportPath. **`@` is per-package, not a single global alias.** | Major gap — no skill/doc mentions `packages`; needs a concepts doc + `skmtc-cli` §client.json + settings reference |
| K3 | `context.register({ reExports })` exists — `reExports` is `Record<string, Identifier[]>` (module → identifiers); each identifier's `.entityType.type` selects `export { x }` vs `export type { x }`. A **barrel is just a `File` populated only with `reExports`** — no `Definition`, no aggregate class. `File.toString` renders `[reExports, imports, definitions].filter(s => s.length)`, so a reExports-only file is a valid emitted artifact. | Missing — `skmtc-generator` skill has no mention of `reExports` or the barrel pattern |
| K4 | `context.insertModel(Projection, refName)` returns an `Inserted` with `.settings` (a `ContentSettings` — `identifier` + `exportPath` + `enrichments`) and `.definition`. | API reference — `insertModel` return shape |
| K5 | The `deno check worker.ts` failure (logged 2026-05-20 #7 as possible "0.5→0.6 drift") is **not drift** — `ModelConfig.transform` / `OasOperationConfig.transform` are typed generic `<Acc = void>(…) => Acc` in core 0.5.1, 0.6.0, 0.6.1 **and** 0.6.2 alike, while the `to*Entry` factories return non-generic transforms. Every worker fails `deno check`, always. Confirmed against the fieldplan project's worker too. | Corrects 2026-05-20 #7; core typing fix |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Multi-package output routing is entirely undocumented | friction | open |
| 2 | Escaping basePath means hand-counting `..`, and `rootPath` must track it in lockstep | friction | open |
| 3 | Barrel files use `register({ reExports })` on a plain File — not an aggregate class | friction | open |
| 4 | A cloned orchestrator generator silently composes with JSR-published peers, not local clones | friction | open |
| 5 | The `skmtc bundle` workaround (`deno bundle` directly) is cwd-sensitive and fails silently | friction | open |
| 6 | core `*Config.transform` generic mismatch is a standing bug across all 0.x, not 0.6.2 drift | polish | open |

---

### 1. Multi-package output routing is entirely undocumented [friction]

Customizing three cloned generators to write into a pnpm monorepo — models into `packages/models`, hono routes into `apps/mock-server` — with cross-file imports that resolve cleanly.

**What happened:** The `skmtc-cli` / `skmtc-generator` skills present a single `basePath` with a single global `@` alias. Nothing covers generators writing into multiple packages of a monorepo. The capability exists and is first-class, but I only found it by reading core source: `helpers/toResolvedArtifactPath.ts` (how `basePath` + `@/` resolve to disk), `dsl/File.ts` `normalizeModuleName` (how a cross-file import becomes `@/…` or a package name), and `types/Settings.ts` (`ModulePackage`, `ClientSettings.packages`). The `client.json#settings.packages` array is the entire feature.

**What was expected:** that the single-`basePath` model in the skills was the whole story, and multi-package output would need ugly hand-rolled relative imports.

**Why it matters:** monorepo output — generated models in one package, generated server/UI code in others — is a mainstream real-world layout. Without the `packages` config an agent emits raw relative paths or doesn't realise cross-package output is supported at all. With it, intra-package imports render `@/…` and cross-package imports render the target's `moduleName` — exactly right — but the feature is invisible to anyone working from the skills.

**Possible fixes:** unresolved — a concepts doc on multi-package output; a `packages` section in the `skmtc-cli` skill's client.json coverage; a settings-reference entry for `ModulePackage`.

**Version anchor:** `@skmtc/core@0.6.2`, `@skmtc/cli@0.3.4`

**Status:** open

---

### 2. Escaping basePath means hand-counting `..`, and `rootPath` must track it in lockstep [friction]

Pointing `gen-zod` / `gen-typescript` `toExportPath` at `skmtc-hub/packages/models/src/` while the project `basePath` is `skmtc-hub/apps/main/src`.

**What happened:** To land files outside `basePath`, `toExportPath` returns a `../`-relative path that `toResolvedArtifactPath` (`join(basePath, exportPath)`) resolves outward. I wrote `join('..', '..', 'packages', 'models', …)` — but `apps/main/src` is **three** levels under `skmtc-hub`, so the files landed at `skmtc-hub/apps/packages/models/…` (one level short). No error — generation succeeded, the manifest was happy, the 108 files were just silently in the wrong directory. Fixing it needed `../../..`. Separately, the `packages` config `rootPath` is matched against the exportPath with a raw string `startsWith`, so `rootPath` had to be the exact same `../`-relative prefix (`../../../packages/models/src`) — when the `..` count changed, `rootPath` had to change in the same edit or `normalizeModuleName` would silently stop matching.

**What was expected:** some anchor for "the monorepo root" or "relative to the SKMTC root" — not counting `..` segments off the depth of `basePath`.

**Why it matters:** the `..` count is load-bearing, hand-derived, and fails **silently** — wrong count means every artifact is misplaced with no diagnostic. And the count lives in two places that must agree (`toExportPath` and `packages[].rootPath`) with nothing enforcing the coupling.

**Possible fixes:** unresolved — a root-relative or basePath-relative path helper; an explicit "monorepo root" anchor in settings; or at minimum documenting the `toExportPath` ↔ `rootPath` lockstep.

**Version anchor:** `@skmtc/core@0.6.2`

**Status:** open

---

### 3. Barrel files use `register({ reExports })` on a plain File — not an aggregate class [friction]

Adding a barrel (`src/index.generated.ts`) that re-exports all 108 generated models so `@skmtc/models` has one entry point.

**What happened:** I first assumed a barrel needed a `MockRoutesList` / `MockServer`-style aggregate `SnippetBase` (the `skmtc-generator` skill's "Accumulator-style generator" card) created via `defineAndRegister`, and spent time worrying about cross-generator coordination — gen-zod and gen-typescript both contributing to one barrel, with the `instanceof` check in the find-or-create pattern failing across two separate packages' classes. The actual mechanism is far simpler: `context.register({ reExports: { [modelExportPath]: [settings.identifier] }, destinationPath: barrelPath })`. A `File` with only `reExports` (no `Definition`s) is a valid emitted barrel. Both generators just `register` re-exports into the same file path; the `File.reExports` map merges them. No class, no `defineAndRegister`, no `instanceof`, no coordination problem — because there is no shared *value*, just a shared file accumulating re-export entries.

**What was expected:** that "a file which is a list of re-exports" needed an aggregate value object, by analogy with the gen-msw routes-list card.

**Why it matters:** `register`'s `reExports` argument is absent from the skills entirely, and the nearest documented pattern (the accumulator card) points at the heavier class-based approach. An agent building a barrel will over-engineer it and may get stuck on the cross-generator `instanceof` problem that `reExports` simply doesn't have.

**Possible fixes:** unresolved — `skmtc-generator` skill should document `register({ reExports })` and "barrel = reExports-only File" as a distinct, lighter pattern from the accumulator-class card.

**Version anchor:** `@skmtc/core@0.6.2`, `@skmtc/gen-zod@0.0.59`, `@skmtc/gen-typescript@0.0.61`

**Status:** open

---

### 4. A cloned orchestrator generator silently composes with JSR-published peers, not local clones [friction]

`gen-supabase-hono` (cloned) composes with `gen-zod` and `gen-typescript` (also cloned into the same project).

**What happened:** `gen-supabase-hono`'s cloned source imported `jsr:@skmtc/gen-zod@0.0.59` — a fully-versioned JSR specifier (the same full-specifier issue as 2026-05-20 #5, but for a peer *generator*). With `gen-zod` also cloned locally as a workspace member, the bundle still resolved that import to the **published** `gen-zod@0.0.59` from JSR, not the local clone. The local `gen-zod` clone was being edited all session; `gen-supabase-hono` was silently ignoring those edits and composing against the registry copy. Only surfaced when I converted the specifier to bare `@skmtc/gen-zod` (which then resolves to the workspace member).

**What was expected:** that cloning an orchestrating generator together with its peers wires them to each other.

**Why it matters:** this is a strictly worse failure mode than version skew — there is no error and no version mismatch, just edits to a local clone being silently dropped because a sibling generator is pinned to JSR. An agent customizing a peer generator would see no effect and have no signal why.

**Possible fixes:** unresolved — `clone` could rewrite `@skmtc/gen-*` peer specifiers to bare when the peer is also being cloned into the project; or `doctor` could flag a local clone that is shadowed by a JSR specifier in a sibling.

**Version anchor:** `@skmtc/cli@0.3.4`, `@skmtc/gen-supabase-hono@0.0.60`

**Status:** open

---

### 5. The `skmtc bundle` workaround (`deno bundle` directly) is cwd-sensitive and fails silently [friction]

`skmtc bundle` is broken under deno 2.7.14 (2026-05-20 #6), so the whole session used `deno bundle -o bundle.js worker.ts` directly to rebundle cloned generators.

**What happened:** A verification step earlier in the session `cd`-ed into `skmtc-hub/`. The shell cwd persisted. The next `deno bundle -o bundle.js worker.ts` then ran in `skmtc-hub/` — where there is no `worker.ts` — and failed with `error: No such file or directory`. The failure scrolled past; the subsequent `skmtc generate` (which locates the project by name, **cwd-independently**) ran happily against the now-**stale** `bundle.js`, silently producing output from the previous generator code. The wrong output (hono routes still at the old path) is what exposed it.

**What was expected:** the rebundle and the generate to operate on the same, consistent state.

**Why it matters:** the workaround for the bundle bug has a cwd-sensitivity that the real `skmtc bundle` command would not — and it pairs badly with `skmtc generate` being cwd-independent. A failed manual bundle plus a cwd-independent generate equals silent stale output, with no error connecting cause to effect.

**Possible fixes:** unresolved — fixing the underlying `skmtc bundle` bug (2026-05-20 #6) removes the need for the workaround; until then, always invoke `deno bundle` with an absolute working directory and absolute paths.

**Version anchor:** `@skmtc/cli@0.3.4`, deno 2.7.14

**Status:** open

---

### 6. core `*Config.transform` generic mismatch is a standing bug across all 0.x, not 0.6.2 drift [polish]

Follow-up to `2026-05-20-clone-generator-version-skew.md` #7, which hypothesised the `deno check worker.ts` failure might be model-entry API drift between core 0.5.x and 0.6.2.

**What happened:** Reading core source across versions disproved the drift hypothesis. `ModelConfig.transform` and `OasOperationConfig.transform` are typed as a **generic function** `<Acc = void>({ … }) => Acc` in core 0.5.1, 0.6.0, 0.6.1 and 0.6.2 — identically. `toModelEntry` / `toOasOperationEntry` return a **non-generic** transform (`Acc` fixed at the factory's type parameter). A concrete non-generic function is never assignable to a generic-function-typed slot, so assembling any generator into a worker fails `deno check` — in every core version. Confirmed by `deno check`-ing the unrelated fieldplan project's `worker.ts`: same `TS2322`/`TS2208`, on the `oasOperation` variant. `deno bundle` (and therefore `skmtc generate`) never typechecks, so the pipeline is unaffected — the bug is invisible until someone runs `deno check` on generator source.

**What was expected:** (per the prior retro) that the mismatch was introduced in a recent core version.

**Why it matters:** it corrects the record — there is no "good" core version to pin to, and no migration will fix it. The fix must be in core: either `ModelConfig`/`OasOperationConfig` parameterise `Acc` at the type level (`ModelConfig<EnrichmentType, Acc>`) instead of making `transform` itself generic, or the `to*Entry` factories return a generic transform.

**Possible fixes:** unresolved — core type fix; until then, `deno check` of any worker is expected to fail and should not be treated as a project error.

**Version anchor:** `@skmtc/core@0.5.1`–`0.6.2`, `@skmtc/worker@0.3.2`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Multi-package output routing undocumented | An entire first-class capability (`packages` config, per-package `@`, cross-package `moduleName`) is invisible in the skills; monorepo output is a mainstream need. | New concepts doc + `skmtc-cli` client.json section + settings reference for `ModulePackage` |
| 2 | #3 — Barrel via `register({ reExports })` | Barrels are a common need for any typed-model package; the skill's nearest pattern (accumulator card) sends agents toward a heavier class-based design with a coordination problem `reExports` doesn't have. | `skmtc-generator` skill — document `register({ reExports })` + "barrel = reExports-only File" |
| 3 | #2 — Escaping basePath via hand-counted `..` | Wrong `..` count silently misplaces every artifact with no diagnostic, and the count is duplicated between `toExportPath` and `packages[].rootPath`. | How-to doc on output outside basePath; consider a root-relative path helper in core |
