# 2026-05-26 — form references: scalar + multi-select autocomplete

Continuation of the `skmtc-reapit` build-out (see
`2026-05-24-clone-peer-references.md`). This session extended the
operation-reference protocol from table columns into **form fields**:
scalar foreign-key fields render as `XxxSelectField` (single-select),
and **array foreign-key fields** (`officeIds: string[]`,
`negotiatorIds: string[]`) render as a new `XxxMultiSelectField`
backed by a hand-written `MultiAutocompleteField` consumer component
that wraps `@reapit/elemental`'s `Combobox` family. Also includes a
full `shadcn → elemental` rename of the three cloned generators, a
project-structure relocation (`.skmtc/skmtc-reapit` moved inside the
consumer app), and an empirical test of Deno-workspace cross-generator
import resolution.

## Knowledge acquired

Working across cloned generator authoring, the factory-base
machinery, the Deno workspace, and the consumer-app's preview shell.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `toOasOperationProjectionBase` (and the model / GQL variants) binds `toIdentifier` / `toExportPath` to **`config`**, not to `this` — see `core/dsl/operation/oas/toOasOperationProjectionBase.ts:55-56`. That means: subclass `static override toIdentifier` IS honoured by the Driver (which calls `MyClass.toIdentifier(...)` statically), but the inherited `toExportPath` calls `this.toIdentifier(...)` and resolves to `config.toIdentifier` (the original, NOT the override). So sibling Projections that only override `toIdentifier` share the base's exportPath function and all land in the same generated file. To land in separate files, you must override `toExportPath` too. | Generator skill §"sibling projections in one factory base" is missing this — currently only mentions "`static override toIdentifier`". This explains why `OfficesSelect`, `OfficesSelectField`, and the new `OfficesMultiSelectField` all live in `@/inputs/OfficesSelect.generated.tsx` — that's by design, but it's non-obvious. |
| K2 | Deno workspace resolution handles sibling-by-`name` cross-generator imports **without** an explicit `imports` entry in the consuming member's `deno.json`. Conditions: root `.skmtc/<project>/deno.json#workspace` lists both, each member's `deno.json#name` is set. Verified empirically: `gen-elemental-form/src/schemaToField.ts` now imports `@skmtc/gen-elemental-select` directly, `gen-elemental-form/deno.json#imports` does NOT list it, bundle + generate succeed, output byte-identical. | skmtc-generator skill should make this explicit. Cross-gen relative-path imports are an antipattern that propagates via cloning (see entry #2). |
| K3 | `client.json#source` is resolved relative to the **SKMTC root** (directory containing `.skmtc/`), not the project dir. Confirmed by moving `.skmtc/skmtc-reapit` into `skmtc-reapit/` and leaving `source: "./reapit.json"` unchanged — the file now resolves to `skmtc-reapit/reapit.json` (the new SKMTC root). | Worth a one-line note in skmtc-cli §client.json shape — currently only says "URL or path to schema" without anchoring it. |
| K4 | `OfficesSelect.generated.tsx` is the canonical example of the (name, exportPath) cache key allowing multiple Definitions in one File: three distinct Projections (raw `OfficesSelect`, single-`OfficesSelectField`, multi-`OfficesMultiSelectField`) all register into the same exportPath but with distinct names, so the cache stores them as three independent Definitions in one File. Imports for all three merge into the file's single header. | This is alluded to in the generator skill but not made vivid. A recipe "co-locating sibling projections in one file" using this concrete trio would be high-value. |
| K5 | `@reapit/elemental` (the shadcn-port library used by skmtc-reapit) exports a complete `Combobox` family backed by `@base-ui/react`: `Combobox`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`, `ComboboxContent`, `ComboboxList`, `ComboboxCollection`, `ComboboxItem`, `ComboboxEmpty`. With `multiple={true}` it handles the entire multi-autocomplete UX out-of-the-box; the only bridging logic in `MultiAutocompleteField` is `Lens<string[]>` ↔ `Option[]` translation. | Not SKMTC knowledge — but worth a recipe note pointing at this if other consumers go down the multi-select path. |
| K6 | Consumer preview apps that ingest the SKMTC manifest typically symlink `<basePath>/manifest.json → ../.skmtc/<project>/.settings/manifest.json` so Vite/import-analysis can resolve `./manifest.json` from `src/App.tsx`. The symlink target is filesystem-relative, so any restructure of the SKMTC root or basePath breaks it silently until HMR overlay catches the unresolved import. | Either a how-to for the preview-app pattern (it's currently a tribal pattern in `skmtc-reapit`), or a `skmtc doctor` check that validates the symlink. |
| K7 | When sed-renaming `Shadcn*` → `Elemental*` across cloned generator source, **alphabetical ordering of sed expressions matters**: replacing `Shadcn` last (after `ShadcnFormBase`, `ShadcnSelectField`, etc.) is necessary because otherwise the generic `Shadcn` rule eats the prefix of the specific ones. I worked around it by ordering more-specific patterns first; mentioning explicitly here so the next agent doesn't trip. | Not a SKMTC concern — generic refactoring practice. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Factory binds static methods to `config`, not `this` — subclass `toIdentifier` override is opaque to inherited `toExportPath` | friction | open |
| 2 | Cloned generators carry the relative-path cross-gen import antipattern | friction | resolved 2026-05-26 (this session, gen-elemental-form/src/schemaToField.ts) |
| 3 | `getReferencedOperation` in cloned form generator was dead code targeting a stale tag-based convention | polish | resolved 2026-05-26 (rewrote to path-based, this session) |
| 4 | Project relocation silently breaks the consumer's `src/manifest.json` symlink | polish | open |
| 5 | JSR mirror outage handled gracefully with recipe error | win | open |

---

### 1. Factory binds static methods to `config`, not `this` — subclass `toIdentifier` override is opaque to inherited `toExportPath` [friction]

While adding a sibling Projection (`ElementalMultiSelectField`) to
`gen-elemental-select`, mirroring how `ElementalSelectField` had been
implemented — both extend `ElementalSelectApiBase`, override
`static toIdentifier`, inherit `toExportPath`.

**What happened:** My override of `static toIdentifier` correctly
produced `OfficesMultiSelectField` (the Driver calls
`MyClass.toIdentifier(...)` statically — that part works as expected).
But the inherited `toExportPath` did NOT route through my override; it
resolved to `@/inputs/OfficesSelect.generated.tsx` (the **base's**
identifier path). So the cache key landed as
`(name: 'OfficesMultiSelectField', exportPath: '@/inputs/OfficesSelect.generated.tsx')`
— a perfectly valid combination, but I expected
`exportPath: '@/inputs/OfficesMultiSelectField.generated.tsx'`.

I initially read this as a bug — the generated form's import line
`from '@/inputs/OfficesSelect.generated.tsx'` (instead of
`from '@/inputs/OfficesMultiSelectField.generated.tsx'`) looked
wrong. Tracking it down required reading
`core/dsl/operation/oas/toOasOperationProjectionBase.ts:55-56`:

```ts
static toIdentifier = config.toIdentifier.bind(config)
static toExportPath = config.toExportPath.bind(config)
```

Both base statics are `.bind(config)`. So when the base's
`toExportPath` body does `this.toIdentifier(...)`, `this === config`,
NOT the subclass. The subclass override is invisible to it.

**What was expected:** That a `static override toIdentifier` would
propagate through the inherited `toExportPath` via `this.toIdentifier`
dispatch — standard ES class semantics if the methods weren't
explicitly bound.

**Why it matters:** This is load-bearing for the "one factory base
per package" architectural rule, and the rule's intent works fine in
practice (sibling Projections that override only `toIdentifier` all
land in the same file by design — that's K4). But the mechanism is
opaque: an author who wants sibling Projections in **separate** files
will assume "override `toIdentifier`" suffices and hit a confusing
collision (same exportPath, different name → both Definitions land in
one File). The fix is to ALSO override `toExportPath` explicitly,
which has to be discovered by reading core source.

The generator skill mentions `static override toIdentifier` for
variants-aware naming but doesn't discuss the binding behaviour or
the sibling-Projections case at all.

**Possible fixes:** unresolved — could be (a) a docs entry in the
generator skill explaining the binding + the "all siblings land in one
file by default" consequence + how to opt out, (b) drop the `.bind(config)`
in the factory (would change behaviour: subclass `toIdentifier` would
propagate via inherited `toExportPath`, making per-sibling exportPath
the default — possibly desirable, possibly breaking), (c) a `static
override toExportPath` example in `authoring/recipes/`.

**Version anchor:** `@skmtc/core@0.6.5`, `@skmtc/gen-elemental-select@0.0.60`

**Status:** open

---

### 2. Cloned generators carry the relative-path cross-gen import antipattern [friction]

While extending `gen-elemental-form/src/schemaToField.ts` to insert
sibling Projections from `gen-elemental-select`, I pattern-matched
the existing import style:

```ts
import { ElementalSelectField } from '../../gen-elemental-select/src/ElementalSelectField.ts'
import ElementalSelectInput from '../../gen-elemental-select/mod.ts'
```

…which was already present in the cloned source (carried over from
the original `gen-shadcn-*` clone). The user caught it: cross-gen
imports should use the package alias (`@skmtc/gen-elemental-select`)
and let the Deno workspace resolve sibling-by-`name`.

**What happened:** I propagated the existing relative-path pattern
when adding new imports, on the assumption that it was the project
convention. Three imports ended up using `../../` paths.

**What was expected:** That if a cloned generator already used a
pattern, that pattern was the right one to follow.

**Why it matters:** Relative paths silently couple cross-generator
imports to filesystem layout. They break when (a) a peer is renamed
(today's `shadcn → elemental` rename would have rotted every
`../../gen-shadcn-*/` path; only the deno.json mapping needed
updating), (b) a peer is swapped between local clone and installed
JSR version, (c) the project workspace moves (the restructure I
performed today would have broken intra-`.skmtc/` paths if any had
escaped the project root, which they didn't only because they were
intra-project). The pattern is wrong, and the canonical generators
in `skmtc-generators/gen-*/` may have it too — worth auditing.

The empirical test (entry K2) confirmed that no entry in the
consumer generator's `deno.json#imports` is needed — workspace
resolution handles it via the peer's `name` field.

**Possible fixes:** unresolved — could be (a) audit
`skmtc-generators/gen-*/` for the same pattern and fix at source so
clones inherit the correct convention, (b) add a `skmtc doctor` check
that flags `from '../../gen-*/'` imports in cloned generator source,
(c) document the workspace-resolution rule in the generator skill so
the next clone-modifier knows the convention before pattern-matching.

**Version anchor:** `@skmtc/core@0.6.5`, `@skmtc/gen-elemental-form@0.0.60`

**Status:** resolved 2026-05-26 (gen-elemental-form/src/schemaToField.ts now uses `@skmtc/gen-elemental-select`)

---

### 3. `getReferencedOperation` in cloned form generator was dead code targeting a stale tag-based convention [polish]

Found while adding the scalar-references branch to
`gen-elemental-form/src/schemaToField.ts`.

**What happened:** The file already had a `getReferencedOperation`
helper at the bottom — looking for an operation whose `tags?.includes(references)`
— that no call site referenced. The RESUME notes acknowledged the
helper existed, "used internally for a different code path" — but a
grep showed it was strictly dead. Meanwhile `gen-elemental-table`'s
`TableColumn.ts` used **path-based** lookup (`op.path` matches
`/offices/`-style), which is what the consumer's table enrichments
actually pass. The form helper was misaligned with the project's
already-established convention.

**Why it matters:** Cloned generators can carry **stale dead branches**
that look authoritative — they're real code, sit alongside live code,
and a careful reader might assume they document the intended pattern.
In this case, the tag-based dead helper would have misled an author
into adopting tag-based references in form enrichments and then being
puzzled when the table enrichments didn't match. The two should have
been consistent from the start.

There's a broader concern: stock generators contain experimental /
half-implemented features that pre-date conventions, and `skmtc clone`
faithfully copies them. There's no signal in the source that says
"this branch is stale, don't follow it."

**Possible fixes:** unresolved — could be (a) audit stock generators
for dead branches before encouraging clones, (b) a convention of
prefixing dead-but-kept code with a `@deprecated` JSDoc that the skill
notes to look for, (c) periodic ESLint-level "exported but never
called locally" pruning.

**Version anchor:** `@skmtc/gen-elemental-form@0.0.60`

**Status:** resolved 2026-05-26 (rewrote `getReferencedOperation` to path-based, matching `gen-elemental-table` convention)

---

### 4. Project relocation silently breaks the consumer's `src/manifest.json` symlink [polish]

After moving `.skmtc/skmtc-reapit/` from `skmtc-root/.skmtc/skmtc-reapit/`
into `skmtc-root/skmtc-reapit/.skmtc/skmtc-reapit/` (so the project
workspace lives inside its consumer app — the canonical SKMTC layout).

**What happened:** Bundle + generate succeeded, all 1,155 files
landed at the expected `src/...` paths after I corrected `basePath`
from `"skmtc-reapit/src"` to `"src"`. But on dev-server reload, Vite
threw `Failed to resolve import "./manifest.json" from "src/App.tsx"`.
The symlink `src/manifest.json` pointed at `../../.skmtc/skmtc-reapit/.settings/manifest.json`
— a target that was valid in the old layout but broken in the new one.
Fix was a one-line `ln -s ../.skmtc/skmtc-reapit/.settings/manifest.json`.

**What was expected:** That post-restructure, the bundle/generate
sufficiency test (exit 0, manifest written, files on disk) would
confirm everything was wired up.

**Why it matters:** SKMTC's verify-first stance ("start the dev
server and use the feature in a browser") caught it immediately, but
a less-careful workflow would have shipped the broken state. The
underlying issue isn't a bug — it's that the **preview-app pattern**
(consumer `App.tsx` importing `./manifest.json` via a symlink into
the SKMTC project's `.settings/`) is a tribal convention with no
documented setup steps and no validation. The symlink is filesystem-
relative; the manifest is what SKMTC writes; both endpoints are
visible, but their coupling isn't.

**Possible fixes:** unresolved — could be (a) a how-to doc for the
preview-app pattern (it's currently inferable only by reading
`skmtc-reapit/src/App.tsx`), (b) a `skmtc doctor` check that
validates symlinks pointing at the manifest, (c) a more idiomatic
loading mechanism (Vite plugin? manifest-loader API?) that doesn't
require filesystem symlinks at all.

**Version anchor:** `@skmtc/core@0.6.5`, `@skmtc/cli@0.0.59`

**Status:** open

---

### 5. JSR mirror outage handled gracefully with recipe error [win]

Mid-session, `jsr.skmtc.dev` returned HTTP 530 (origin unreachable).
`skmtc bundle skmtc-reapit --json` refused to proceed with a clear
recipe error pointing at the exact remediation:

```
JSR registry at https://jsr.skmtc.dev is unreachable (registry returned HTTP 530).

skmtc is pinned to a local JSR mirror. Start the registry or set
JSR_URL to a reachable mirror before running the CLI:

  JSR_URL=https://jsr.skmtc.dev/ skmtc <command>

If you are intentionally working offline, the only commands that do
not touch JSR are `skmtc generate` (when bundle.js is already built)
and `skmtc dev` against a project with no new generator installs.
```

**Why it matters:** This is exemplary of the CLI's "loud beats silent
zero-output" stance. The error names the specific URL, the HTTP code,
the remediation env var, AND the documented escape hatch (`generate`
works against a pre-built bundle). I correctly inferred I could skip
bundling and just regenerate from the existing bundle — the third
paragraph told me so directly.

**Codification value:** This is the win-template for SKMTC error
messages. When other commands fail due to external dependencies, they
should follow this pattern: (a) name the failing endpoint and HTTP
status, (b) name the env var or CLI flag that remediates, (c) name
the subset of operations that still work without the dependency.

**Possible fixes:** unresolved — could be (a) extract a "recipe-error
checklist" into the CLI dev docs derived from this exemplar, (b) add a
test that confirms all external-dependency error paths surface the
three-element pattern.

**Version anchor:** `@skmtc/cli@0.0.59`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Factory binds static methods to `config`, not `this` | The binding behaviour is load-bearing for the sibling-Projection pattern (`Select` + `SelectField` + `MultiSelectField` co-locating in one file) but invisible from outside. An author who wants sibling Projections in **separate** files will silently produce a (name, exportPath) collision when only `toIdentifier` is overridden. | Generator skill update — add a §"sibling projections" subsection covering the binding behaviour, the "all siblings share exportPath by default" consequence, and how to opt into per-sibling exportPath. Possibly also a recipe under `authoring/recipes/`. |
| 2 | K2 + #2 — Cross-gen imports via `@skmtc/gen-peer` (no deno.json entry needed) | The relative-path antipattern propagates via cloning — every `skmtc clone` user repeats it. Workspace resolution is the canonical mechanism but isn't documented in the generator skill. Empirically verified this session that the pattern is safe (no per-generator deno.json entry needed). | Two-part: (a) generator skill §"cross-generator imports" rule, (b) audit `skmtc-generators/gen-*/` for the relative-path antipattern at source so clones inherit the correct pattern. |
| 3 | #4 — Preview-app symlink convention is undocumented | The `src/manifest.json` → `../.skmtc/<project>/.settings/manifest.json` symlink is the load-bearing wiring between SKMTC's manifest and a consumer Vite preview app, but exists only as tribal convention. Any project relocation silently breaks it. | A how-to doc for the preview-app pattern, OR a `skmtc doctor` check that validates symlinks pointing at the manifest. The how-to is higher-leverage if the pattern is going to be recommended; the doctor check is the defensive fallback. |
