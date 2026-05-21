# 2026-05-20 — Cloning generators into a new project, fighting core-version skew

Scaffolded a new `skmtc-hub` project, installed and then cloned
`gen-supabase-hono`, `gen-zod`, and `gen-typescript`. The `clone` command's
bundle sub-step failed, and recovering from it surfaced a chain of
version-resolution and CLI-tooling frictions.

## Knowledge acquired

Operating the CLI: `init` → `install` → `clone` → `bundle` against a local
JSR registry, on `cli@0.3.4` / `core@0.6.2` / `deno 2.7.14`.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `skmtc install` takes the generators argument as a **single comma-separated positional** (`a,b,c project`), not multiple space-separated args. Space-separated → `error: Too many arguments`. | `skmtc-cli` skill — the §10 "Setting up SKMTC" card shows `skmtc install @skmtc/gen-zod @skmtc/gen-typescript my-api` (space-separated), which **fails**. Fix the example. |
| K2 | Cloned stock-generator `src/*.ts` files import core via **fully-versioned specifiers** — `import { … } from 'jsr:@skmtc/core@0.5.1'` on every line — not bare `@skmtc/core`. The project/member `deno.json` import map cannot override these; changing core version means rewriting every import line in source. | `skmtc-cli` / `skmtc-generator` skills — the agent-authored card assumes bare specifiers + import map. Cloned stock generators do not work that way. Needs an explicit note. |
| K3 | `skmtc clone` writes a project `deno.json` containing only the local generator mappings + `workspace[]`. It does **not** pin `@skmtc/worker` (required by the generated root `worker.ts`) or `@skmtc/core`. Without `@skmtc/worker`, `deno bundle` fails with `Import "@skmtc/worker" not a dependency`. | `skmtc-cli` skill — clone card should state the produced `deno.json` needs `@skmtc/worker` added manually (or this is a `clone` bug). |
| K4 | The clone pre-flight `@skmtc/core` peer-pin check only compares the **project's** pin against the CLI. It does not detect skew *between* the cloned generators. Installing "latest" of several stock generators can yield a mutually-incompatible set. | `skmtc-cli` skill — note that `install`+`clone` of multiple generators does not guarantee a co-released, core-compatible set. |
| K5 | `@skmtc/worker` versions independently of `core` (latest `0.3.2`, pins `core@0.6.2`). It is absent from the shim `deno.lock`. | `skmtc-cli` skill — worth a one-line "worker version ≠ core version" note. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc install` rejects space-separated generators; skill card example is wrong | friction | open |
| 2 | `skmtc clone` swallows the underlying `deno bundle` error | friction | open |
| 3 | `clone`-produced `deno.json` omits the `@skmtc/worker` pin needed by `worker.ts` | blocker | open |
| 4 | "Install latest" of several stock generators produces a non-co-released, core-skewed set | friction | open |
| 5 | Core version is baked into source as full specifiers, not the import map | friction | open |
| 6 | `skmtc bundle` reports "wasn't written" under deno 2.7.14 though `deno bundle` succeeds | friction | open |
| 7 | `core@0.6.2` model-entry `transform` typecheck drift + slow-types | polish | open |

---

### 1. `skmtc install` rejects space-separated generators; skill card example is wrong [friction]

First command after `init` — installing three generators.

**What happened:** `skmtc install @skmtc/gen-supabase-hono @skmtc/gen-zod @skmtc/gen-typescript skmtc-hub --json` failed with `error: Too many arguments: @skmtc/gen-typescript skmtc-hub`. The CLI parses `install` as exactly two positionals — `[generators]` and `[project]` — so it read arg 1 as the generator list and arg 2 as the project, leaving the rest as overflow. The working form is comma-separated: `skmtc install a,b,c skmtc-hub --json`.

**What was expected:** the `[generators...]` notation in the skill's command table, and the §10 setup card's literal example `skmtc install @skmtc/gen-zod @skmtc/gen-typescript my-api --json`, both imply space-separated variadic args.

**Why it matters:** the skill's own copy-paste example is broken. An agent following the setup card verbatim hits an error on its second command. The `[generators...]` ellipsis notation actively misleads — it reads as "variadic" when the parser wants one comma-joined string.

**Possible fixes:** correct the §10 setup card to `a,b,c`; change the command-table notation from `[generators...]` to `[gen,gen,…]`; or have the CLI accept both forms.

**Version anchor:** `@skmtc/cli@0.3.4`

**Status:** open

---

### 2. `skmtc clone` swallows the underlying `deno bundle` error [friction]

`clone` of the three generators exited 1 with only a generic message.

**What happened:** `skmtc clone` failed with `Error: Failed to create bundle` (at `GenerateBundleTask.tsx:95`) and a JS stack trace — no indication of *why* the bundle failed. The real cause (`Import "@skmtc/worker" not a dependency and not in import map`) was only visible by reproducing the bundle manually with `deno bundle -o bundle.js worker.ts`.

**What was expected:** the failing `deno bundle` subprocess's stderr to be surfaced, or at least summarised, in the CLI error.

**Why it matters:** `clone`'s bundle step is the most likely place for a fresh project to fail (peer-version skew, missing import-map entries). Swallowing the subprocess error forces every diagnosis down to "run `deno bundle` by hand" — the CLI is hiding the one piece of information that matters.

**Possible fixes:** unresolved — `createBundle` should capture and propagate the `deno bundle` stderr into the thrown error.

**Version anchor:** `@skmtc/cli@0.3.4`

**Status:** open

---

### 3. `clone`-produced `deno.json` omits the `@skmtc/worker` pin needed by `worker.ts` [blocker]

Root cause of entry #2's bundle failure.

**What happened:** after `clone`, the project `deno.json` contained only `@skmtc/gen-*` → local-path mappings plus `workspace[]`. The generated root `worker.ts` does `import toWorker from '@skmtc/worker'`, but `@skmtc/worker` was in neither the root import map nor any member `deno.json`. `deno bundle` therefore failed: `Import "@skmtc/worker" not a dependency and not in import map`. Fix was to add `"@skmtc/worker": "jsr:@skmtc/worker@0.3.2"` (and `@skmtc/core`) to the root `deno.json` by hand.

**What was expected:** `clone` produces a project that bundles. `worker.ts` is a derived artifact the CLI itself generates — it knows it imports `@skmtc/worker`, so the import map it writes should resolve it.

**Why it matters:** this is a hard blocker for `clone` on a project with no prior `@skmtc/worker`/`@skmtc/core` pins (i.e. a freshly `init`-ed one). The `skmtc-cli` skill's "agent-authored local generator" card *does* say a local-generator project must pin `@skmtc/core`/`@skmtc/worker` — but that card is framed for hand-authored generators, not `clone`d ones, so it reads as not applying here.

**Possible fixes:** `clone`/`bundle` should ensure `@skmtc/worker` (and `@skmtc/core`) are in the project `deno.json` when it emits `worker.ts`; or the skill's clone card should explicitly state the manual pin step.

**Version anchor:** `@skmtc/cli@0.3.4`, `@skmtc/worker@0.3.2`

**Status:** open

---

### 4. "Install latest" of several stock generators produces a non-co-released, core-skewed set [friction]

`install` resolved each generator to its registry-latest independently.

**What happened:** `install` pulled `gen-supabase-hono@0.0.60`, `gen-zod@0.0.59`, `gen-typescript@0.0.61`. But `gen-supabase-hono@0.0.60`'s own `deno.json` declares `gen-zod@0.0.59`, `gen-typescript@**0.0.59**`, `core@0.5.1` — while the latest `gen-typescript` (`0.0.61`) was built against `core@0.6.1`. So the "latest of each" set spans `core@0.5.1` and `core@0.6.1`, and neither matches the CLI's `core@0.6.2`. The clone pre-flight peer-pin check did not flag this — it only checks the (empty) project pin.

**What was expected:** installing a generator and its peers yields a mutually-compatible set, or a warning when it doesn't.

**Why it matters:** an orchestrating generator (`gen-supabase-hono`) and its peer generators must agree on `core`, but the registry's independent per-package "latest" gives no such guarantee. The user is left to manually reconcile versions across 3+ packages with no tooling signal.

**Possible fixes:** unresolved — `install` could resolve a peer-consistent set from the orchestrating generator's declared deps; or `doctor`/`clone` could add a cross-generator core-skew check.

**Version anchor:** `@skmtc/cli@0.3.4`, `@skmtc/gen-supabase-hono@0.0.60`, `@skmtc/gen-zod@0.0.59`, `@skmtc/gen-typescript@0.0.61`

**Status:** open

---

### 5. Core version is baked into source as full specifiers, not the import map [friction]

Diagnosing the core-version skew from entry #4.

**What happened:** I assumed pinning `@skmtc/core@0.6.2` once in the root `deno.json` would make all three workspace members resolve to `0.6.2` (the documented Deno-workspace pattern, and the assumption the skill's agent-authored card builds on). It did not. `deno check` still showed `core@0.5.1` and `core@0.6.2` types colliding. The cause: every cloned `src/*.ts` imports core as `from 'jsr:@skmtc/core@0.5.1'` — a fully-versioned specifier on each import line (113 of them across the three packages). The import map only governs *bare* specifiers; fully-versioned `jsr:` specifiers ignore it. Realigning core meant rewriting all 113 specifiers.

**What was expected:** that the `@skmtc/core` entry in `deno.json#imports` is the single source of truth for the core version.

**Why it matters:** this inverts the mental model the skill teaches. For a *cloned* generator, the core version is not a config value — it is text smeared across every source file. Any "change the core version" task is a project-wide find-and-replace, not a one-line edit. An agent that doesn't know this will edit `deno.json`, see no effect, and lose cycles (I did).

**Possible fixes:** unresolved — `clone` could rewrite full specifiers to bare ones + an import-map entry on the way in; or the skill should explicitly document that cloned generator source carries pinned `jsr:` specifiers and a version change is a bulk rewrite.

**Version anchor:** `@skmtc/cli@0.3.4`, `@skmtc/core@0.6.2`

**Status:** open

---

### 6. `skmtc bundle` reports "wasn't written" under deno 2.7.14 though `deno bundle` succeeds [friction]

After hand-fixing the import map, `deno bundle` worked; `skmtc bundle` did not.

**What happened:** `deno bundle -o bundle.js worker.ts` succeeded repeatedly (551 modules, ~749 KB, valid file on disk). `skmtc bundle skmtc-hub --json` failed with `Error: bundle.js was expected at …/bundle.js but wasn't written` (`bundle-headless.ts:70`) — and left the existing, valid `bundle.js` on disk untouched (same mtime before/after). So the CLI's own `createBundle` either spawns `deno bundle` into the wrong location or its post-write existence check is wrong. `deno bundle` is flagged experimental in `deno 2.7.14`.

**What was expected:** `skmtc bundle` produces `bundle.js` the same way a direct `deno bundle` does.

**Why it matters:** `bundle` is also the sub-step of `clone`, `install`, and `dev`. If it is broken against current Deno, none of those commands can complete their bundle phase — `clone` only "worked" here because the source-copy step finished before the bundle step threw. The workaround (`deno bundle` by hand) exists but is undocumented and bypasses the CLI's worker.ts regeneration.

**Possible fixes:** unresolved — needs investigation of how `cli@0.3.4`'s `createBundle` invokes `deno bundle` (cwd, `-o` path) against the experimental command in `deno 2.7.14`.

**Version anchor:** `@skmtc/cli@0.3.4`, `deno 2.7.14`

**Status:** open

---

### 7. `core@0.6.2` model-entry `transform` typecheck drift + slow-types [polish]

`deno check worker.ts` after aligning all source to `core@0.6.2`.

**What happened:** `deno bundle` succeeded, but `deno check worker.ts` failed. Two causes: (a) `core@0.6.2`'s model-entry `transform` type is `<Acc = void>({ … }: TransformModelArgs<Acc>) => Acc`, and the cloned `gen-zod`/`gen-typescript` inline `transform({ context, refName }) { … }` (returning void) is not assignable to that generic position; (b) a `TS2208` ("This type parameter might need an `extends void` constraint") inside `core@0.6.2`'s *own* `dsl/model/types.ts:94` — core is published `--allow-slow-types`, so its published types do not `deno check` cleanly.

**What was expected:** a clone aligned to a single core version would `deno check` cleanly.

**Why it matters:** it does **not** block the pipeline — `deno bundle` transpiles without full typechecking and `skmtc generate` runs the bundle — so the artifact is usable. But it means the `skmtc-generator` editing workflow (where `deno check` is the inner loop) starts from a red typecheck on freshly cloned stock generators, making it hard to distinguish pre-existing drift from newly introduced errors.

**Possible fixes:** unresolved — could be a genuine model-entry API drift between `core@0.5.x` and `0.6.2` worth a migration note, or `core`'s `toModelEntry` typing being stricter than its runtime needs.

**Version anchor:** `@skmtc/core@0.6.2`, `@skmtc/gen-zod@0.0.59`, `@skmtc/gen-typescript@0.0.61`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #5 — Core version baked into source as full specifiers | Inverts the import-map mental model the skill teaches; an agent will edit `deno.json`, see no effect, and lose cycles. | `skmtc-cli` + `skmtc-generator` skills — document that cloned generator source carries pinned `jsr:@skmtc/core@X.Y.Z` specifiers; a version change is a project-wide rewrite, not a config edit. |
| 2 | #3 — `clone` `deno.json` omits `@skmtc/worker` | Hard blocker for `clone` on a freshly `init`-ed project; the CLI emits `worker.ts` but not the import that resolves its dependency. | Likely SKMTC code fix in `clone`/`bundle`; until then, add the manual `@skmtc/worker`/`@skmtc/core` pin step to the skill's clone card. |
| 3 | #1 — `install` space-separated args fail | The `skmtc-cli` skill's own setup-card example is broken and fails on the second command of the canonical flow. | `skmtc-cli` skill — one-line fix: change the §10 example to comma-separated and adjust the `[generators...]` notation. |
