# 2026-05-21 — Generators upgrade to @skmtc/core@0.6.3 + release

Upgraded the `skmtc/deno` server and all 17 packages in the
`skmtc-generators` workspace from `@skmtc/core@0.5.1` to `0.6.3`, fixed
the resulting test-code breakage, removed dead template files, repaired
the broken `release` task, and published every package to the local
JSR registry.

## Knowledge acquired

This session operated on a monorepo-wide `@skmtc/core` version bump
(0.5.1 → 0.6.3) spanning the server and the generator workspace, plus
the deno-task release tooling.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | core 0.6.x removed the `./parsers/graphql` subpath export and `toArtifactsFromGraphQL`. GraphQL → artifacts now goes through the unified `toArtifacts({ document: { type: 'gql', value } })`; OAS uses `{ type: 'oas', value }`. The `SkmtcDocumentInput` discriminated union is the single input surface. | core 0.5→0.6 migration note / API reference |
| K2 | `ParseContext`'s constructor changed `documentObject` → `input: SkmtcDocumentInput` (`{ type, value }`). | API reference / migration note |
| K3 | `ParseContext.parse(stackTrail)` now returns `SkmtcParsedDocument` (a `{ type:'oas', value:OasDocument } \| { type:'gql', value:GqlDocument }` union), not a bare `OasDocument`. `GenerateContext`'s constructor takes `document: SkmtcParsedDocument`, not `oasDocument: OasDocument`. | API reference / migration note |
| K4 | `OasRef`'s constructor 2nd arg is `context: ParseContextType` (it reads `context.parsedDocument`) — not an `OasDocument` or parsed document. | API reference |
| K5 | In a Deno workspace, a `jsr:@skmtc/gen-x@<v>` import resolves to the local workspace member **only when `<v>` exactly matches the member's `version`**. A mismatch silently falls back to the JSR-published copy — no warning. | monorepo-upgrade how-to |
| K6 | `deno publish` type-checks only the module graph reachable from the package `exports` (`Check mod.ts`). `test/`, `demo/`, `template/` files ship in the tarball but are **not** type-checked at publish (confirmed via `--dry-run`). | release how-to |
| K7 | A concrete generator entry (`transform: (...) => void`) is not assignable to `GeneratorConfig<EnrichmentType>` because `GeneratorConfig.transform` is generic `<Acc = void>(...) => Acc`. The repo-wide workaround is a per-entry `// @ts-expect-error - factory-emitted transform is monomorphic over Acc`. | generator skill note, or core type fix |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Mid-migration type-check false-pass via workspace dep-pin fallback | friction | open |
| 2 | core 0.5→0.6 context/ref API changes undocumented — core test helpers are the only reference | friction | open |
| 3 | `GeneratorConfig.transform` generic variance forces `@ts-expect-error` on every entry | friction | open |
| 4 | Generators `release` task pointed at a renamed cross-repo script | polish | open |
| 5 | `deno check **/*.ts` flags consumer-template `.tsx` files outside the real check graph | polish | open |

---

### 1. Mid-migration type-check false-pass via workspace dep-pin fallback [friction]

Observed while upgrading the `skmtc-generators` workspace (17 packages)
from `@skmtc/core@0.5.1` to `0.6.3`.

**What happened:** After bumping `@skmtc/core` in every generator's
`deno.json`, `deno check **/*.ts` passed with exit 0. It looked like
core 0.6.3 was fully backward-compatible. It was not. The inter-generator
pins still named the *old* published versions (`@skmtc/gen-typescript@0.0.59`
etc.), so every dependent type-checked against the **JSR-published**
sibling — built against old core — rather than its local source. Only
after the version bump aligned each pin to its local member's version
did the workspace resolve siblings locally, and **56 type errors**
surfaced at once (test helpers using the removed `documentObject`
field, `parse()`'s changed return type, etc.).

**What was expected:** that a clean `deno check` after the core bump
meant the upgrade was safe.

**Why it matters:** during a monorepo-wide dependency bump, a green
type-check is misleading until *inter-package pins are aligned to local
versions*. The workspace silently mixes local source with stale
published dependencies (K5). An agent that trusts the first green check
will declare victory and ship broken packages. The correct sequence is:
bump the shared dep → bump every member version → rewrite inter-member
pins → *then* type-check.

**Possible fixes:** unresolved — a how-to for monorepo-wide dep bumps
that prescribes the bump-pins-then-check ordering; or tooling that warns
when a workspace import resolves to JSR despite a local member of the
same name existing.

**Version anchor:** `@skmtc/core@0.6.3` (from `0.5.1`), `@skmtc/gen-*@0.0.60`–`0.0.62`

**Status:** open

---

### 2. core 0.5→0.6 context/ref API changes undocumented — core test helpers are the only reference [friction]

Observed while fixing the 56 errors from entry #1, across the test
helpers of gen-typescript / gen-zod / gen-valibot / gen-arktype.

**What happened:** Three core constructor/return-type changes between
0.5.1 and 0.6.3 broke test code, with no migration doc:
`ParseContext` `documentObject` → `input: SkmtcDocumentInput` (K2);
`parse()` → `SkmtcParsedDocument` and `GenerateContext` `oasDocument`
→ `document` (K3); `OasRef`'s 2nd constructor arg is a
`ParseContextType` (K4). The error messages were accurate (`'documentObject'
does not exist in type 'ConstructorArgs'`, `'SkmtcParsedDocument' is not
assignable to 'OasDocument'`) but gave no migration target. I resolved
the shapes by reading **core's own test helpers** (`core/test/toParseContext.ts`,
`core/test/toGenerateContext.ts`), which already use the 0.6 API and
are effectively the canonical migration reference.

**What was expected:** a CHANGELOG, migration note, or skill section
covering the 0.5→0.6 context API change.

**Why it matters:** the parse/generate context constructors are the
entry points every generator's test scaffold touches. A version bump
across a minor that changes them needs a migration map (`old field` →
`new field`). The recovery tactic — *read the core package's own
`test/` helpers as the canonical example of current API usage* — is
worth telling the next agent explicitly; it is faster than inferring
shapes from error messages.

**Possible fixes:** unresolved — a per-minor migration note for
`@skmtc/core`; and/or a skill line: "to discover current core context
API, read `core/test/toParseContext.ts` and `core/test/toGenerateContext.ts`."

**Version anchor:** `@skmtc/core@0.6.3` (from `0.5.1`)

**Status:** open

---

### 3. `GeneratorConfig.transform` generic variance forces `@ts-expect-error` on every entry [friction]

Observed when fixing test helpers and a demo driver that pass generator
entries into `toGeneratorConfigMap`.

**What happened:** A factory-built generator entry has a monomorphic
`transform: ({ … }: TransformModelArgs<void>) => void`. `GeneratorConfig`
(the value type of `GeneratorsMapContainer`) declares
`transform: <Acc = void>({ … }: TransformModelArgs<Acc>) => Acc`. The
monomorphic function is not assignable to the generic one, so **every**
`{ '@skmtc/gen-x': xEntry }` literal fails with TS2322 plus a TS2208
"this type parameter might need an `extends void` constraint" hint
pointing into core. The only workaround in use across the repo is a
`// @ts-expect-error - factory-emitted transform is monomorphic over Acc`
comment before each entry — present in every generator's
`test/helpers/toGenerateContext.ts` and now also in `gen-reapit-form/demo/run.ts`.

**What was expected:** that handing a generator's own entry object to
`toGeneratorConfigMap` — the single most obvious thing to do — would
type-check.

**Why it matters:** the most natural call (`() => ({ gen: genEntry })`)
does not compile, and the fix is a suppression directive, not a real
type. An agent meeting this cold will not guess `@ts-expect-error` and
will instead reach for `as` casts (which the codebase forbids) or
flail. The pattern is repo-pervasive but written down nowhere.

**Possible fixes:** unresolved — either core widens/relaxes
`GeneratorConfig.transform` so a monomorphic entry is assignable, or
the generator skill documents the `@ts-expect-error` line as the
sanctioned pattern with the exact wording.

**Version anchor:** `@skmtc/core@0.6.3`, `@skmtc/gen-*@0.0.60`–`0.0.62`

**Status:** open

---

### 4. Generators `release` task pointed at a renamed cross-repo script [polish]

Observed when the user asked to run the generators release.

**What happened:** `skmtc-generators/deno.json`'s `release` task was
`deno run … ../skmtc/deno/.scripts/increment-patch.ts` — a path into
the *sibling* `skmtc` repo. That script had been renamed to
`release.ts` (registry-driven, state-file-free), so the generators
release task silently referenced a non-existent file. The task was
also missing `--allow-net`, which the new script's registry queries
need. Fix: copy `release.ts` into `skmtc-generators/.scripts/` so the
repo is self-contained, and update the task.

**What was expected:** the repo's own `release` task to work.

**Why it matters:** a build/release task that reaches across repo
boundaries breaks invisibly the moment the other repo refactors —
nothing in the referencing repo's history or CI shows the breakage
until someone runs it. `release.ts` also derives its workspace root
from its own file location, so even pointing at the sibling copy would
have released the *wrong* workspace. Release tooling should live inside
the repo it releases.

**Possible fixes:** done this session (self-contained copy). Broader:
if both monorepos must share release logic, publish it as a small JSR
package rather than referencing a sibling working copy by relative path.

**Version anchor:** `skmtc-generators` workspace, `@skmtc/core@0.6.3`

**Status:** open

---

### 5. `deno check **/*.ts` flags consumer-template `.tsx` files outside the real check graph [polish]

Observed during type-check verification of the generator workspace.

**What happened:** `skmtc-generators/CLAUDE.md` documents
`deno check **/*.ts` as the type-check command, but the repo's actual
`check` *task* runs `deno check <gen>/mod.ts` per package. The broad
glob pulls in `gen-reapit-form/template/forms/fields/*.tsx` —
consumer-side React components shipped for end users to copy — which
use extensionless imports and legitimately do not pass `deno check`
(5 × TS2307). `deno publish` does not check them either (K6); they are
not in any `mod.ts` graph. The over-broad glob produced 5 errors that
were pure noise relative to the project's real definition of "type
checks pass."

**What was expected:** the documented check command and the `check`
task to agree on scope.

**Why it matters:** when the documented command is stricter than the
task and the package's actual published surface, an agent can't tell a
real regression from a non-issue without extra investigation. Consumer
template files authored for a different runtime should be excluded from
the generator repo's type-check scope outright.

**Possible fixes:** unresolved — align `CLAUDE.md` with the `check`
task (mod.ts-scoped), or add an `exclude` for `*/template/**` so the
broad glob and the task agree.

**Version anchor:** `skmtc-generators` workspace, `@skmtc/gen-reapit-form@0.0.61`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #2 — core 0.5→0.6 API change undocumented | The parse/generate context constructors and `OasRef` changed across a minor with no migration map; every generator's test scaffold touches them. | core migration note + API reference; skill line pointing at `core/test/` helpers as the canonical usage example |
| 2 | #1 — mid-migration type-check false-pass | A green `deno check` mid-bump is misleading until inter-package pins are aligned to local versions; an agent will ship broken packages trusting it. | how-to doc for monorepo-wide `@skmtc/core` bumps prescribing bump → version → pins → check ordering |
| 3 | #3 — `GeneratorConfig.transform` variance | The most obvious call (pass a generator's own entry to `toGeneratorConfigMap`) does not type-check; the fix is an undocumented `@ts-expect-error`. | generator skill note with the exact directive, or a core type relaxation |
