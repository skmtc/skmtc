# 2026-05-21 — `skmtc generate --typecheck` and external module resolution

This session built infrastructure for the SKMTC Generator Lab (an
agent-authoring test harness) — Durable Object orchestration, the Kimi
agent adapter, the sandbox pipeline. Almost all of that is outside the
SKMTC engine and produced no friction-log signal. The one SKMTC-engine
observation worth capturing came from *reviewing* an agent-authored
generator: how `skmtc generate --typecheck` behaves on generated code
that imports the consumer's npm dependencies.

## Knowledge acquired

Operated against `@skmtc/cli@0.3.7`'s `generate --typecheck`, run over
an agent-authored MUI form generator (a cloned `gen-shadcn-form`) whose
output imports `@mui/material`, `react-hook-form`, `zod`, etc.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `skmtc generate --typecheck` runs `tsc` over the generated artifacts *in place* and resolves the generated code's external imports entirely through the `basePath` workspace's own tsconfig + `node_modules`. SKMTC neither vendors nor stubs the consumer's runtime deps. In a real consumer app that is correct (the app has them); in a synthetic / isolated workspace with no `node_modules`, every external import fails `TS2307` and `typecheckPass` is a false negative dominated by module-resolution noise. | skmtc-cli skill — the `--typecheck` / "Using SKMTC in CI" guidance should state that `--typecheck` measures generator quality *only* when the consumer's deps (and the `@` alias) resolve in the typecheck workspace |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `--typecheck` over generated code that imports npm packages reports false failures without the consumer's `node_modules` | friction | open |

---

### 1. `--typecheck` over generated code that imports npm packages reports false failures without the consumer's `node_modules` [friction]

Observed while reviewing an agent-authored MUI form generator in the
SKMTC Generator Lab. The lab's ephemeral sandbox runs
`skmtc generate <project> <schema> --json --typecheck --tsc-cmd tsc`
over the captured generator and records `typecheckPass` as a
quality metric.

**What happened:** a cloned `gen-shadcn-form` → MUI form generator
bundled and generated cleanly (`bundleOk: true`, `generateOk: true`,
5 artifacts) but `--typecheck` reported `pass: false`, 12 diagnostics.
I reproduced the 12 exactly with TS 5.9.2 against the generated
artifacts. Every one was environmental:

- **8 × `TS2307` "Cannot find module"** — `react-hook-form`,
  `@mui/material`, `@hookform/resolvers/zod`, `@hookform/lenses`,
  `react/jsx-runtime`, and `zod` (×3 files).
- **4 × cascading `TS7006`/`TS7031` implicit-`any`** — the
  `handleSubmit` callback parameter and three `Controller` `render`
  `ref` destructures, all `any` purely *because* their upstream
  module was unresolved.

Zero of the 12 pointed at an actual defect in the generated code; the
form itself was idiomatic.

**What was expected:** that `typecheckPass` reflects the quality of
the generator's output.

**Why it matters:** `skmtc generate --typecheck` typechecks generated
code in place and resolves its *external* imports through whatever
tsconfig + `node_modules` the `basePath` workspace provides. SKMTC
does not — and arguably should not — vendor the consumer's runtime
deps, because in a real consumer app those deps are already present.
But the consequence is that `--typecheck` only measures generator
quality when run inside an environment that already resolves the
consumer's whole module-resolution surface: both the bundler `@` alias
*and* the npm `node_modules`. In a synthetic CI or test workspace
without them, the result collapses to `TS2307` noise and a meaningless
`pass: false`. The skmtc-cli skill's "Using SKMTC in CI" card
recommends `skmtc generate … --typecheck` and treats exit 1 as
failure, without flagging this precondition — a CI job that points
`basePath` at a scaffold rather than the real app would get false
failures on every generator that emits a component.

**Possible fixes:** unresolved — open options: (a) the skmtc-cli skill
notes the precondition explicitly (the typecheck workspace must
resolve the consumer's deps + `@` alias); (b) `--typecheck` partitions
diagnostics into "within generated code" vs "unresolved external
import" so a consumer can choose to fail only on the former — the
strictly generator-attributable signal; (c) a documented recommended
synthetic-workspace setup (install the imported deps, or supply an
ambient `declare module` shim for externals).

**Version anchor:** `@skmtc/cli@0.3.7`, `@skmtc/core@0.6.3`; generator
cloned from `@skmtc/gen-shadcn-form` (peers
`@skmtc/gen-typescript@0.0.62`, `@skmtc/gen-zod@0.0.60`).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — `--typecheck` false failures without the consumer's `node_modules` | The skmtc-cli skill actively recommends `--typecheck` for CI exit codes; without the precondition spelled out, a CI integration gets false failures on every component-emitting generator, and the signal is silently worthless. | skmtc-cli skill — add the precondition to the `--typecheck` / "Using SKMTC in CI" guidance; optionally an SKMTC CLI enhancement to partition external-resolution diagnostics from generator-internal ones |
