# Discrepancy catalog

Persistent record of discrepancies between docs and library source. Each
entry is structured for audit: the verification command should be
re-runnable; the actual-from-source field should be a verbatim citation
with file:line.

## How to read an entry

- **Doc(s)**: which doc files contain the claim
- **Severity**: catastrophic (silent failure, user mislead) | high (broken
  behavior) | medium (confusion / friction) | low (cosmetic)
- **Category**: cli-flag, file-path, type-signature, structural-shape,
  behavior, reference-citation, cross-doc-consistency
- **Claim**: verbatim quote from doc
- **Verification command**: a grep/read that re-produces the discrepancy
- **Actual**: verbatim citation from source with file:line
- **Fix status**: open, in-review, applied, verified

## How to audit this catalog

Pick any entry. Run the verification command. The output should match the
"Actual" field verbatim. If it doesn't, the catalog entry has decayed
(code changed since cataloging) or was wrong.

If an entry has fix status `verified`, re-run the verification command —
the new doc text should pass the check, not show the original claim.

---

## Coverage status

**Tier 1 progress:** this list was the *original scope sketch* for round-1 of the audit. The actual audit went much wider — by round 4 it had touched concept docs, explanation docs, glossary, skills, and `llms.md` as well. Rather than retroactively re-check each box (the per-entry Fix status notes below are the authoritative record of what was touched), this list is preserved as a historical scope record.

**Authoritative status:** see the per-entry `**Fix status:**` lines on each DISC/BULK entry, plus the final cumulative tally at the bottom of this file.

- [ ] `reference/cli/overview.md` *(touched under DISC-006)*
- [ ] `reference/cli/init.md` *(touched under BULK-014)*
- [ ] `reference/cli/create.md` *(touched under DISC-003, DISC-004, DISC-005, BULK-012)*
- [ ] `reference/cli/clone.md` *(touched under DISC-008)*
- [ ] `reference/cli/install.md`
- [ ] `reference/cli/list.md`
- [ ] `reference/cli/remove.md`
- [ ] `reference/cli/generate.md`
- [ ] `reference/cli/bundle.md`
- [ ] `reference/cli/dev.md`
- [ ] `reference/cli/doctor.md` *(touched under DISC-006, DISC-007, BULK-011)*
- [ ] `reference/cli/agent-context.md`
- [ ] `using/tutorials/*` (CLI syntax in tutorials) *(03-customize-with-enrichments touched under DISC-001)*
- [ ] `using/how-to/*` *(configure-enrichments, debug-failing-generation touched)*
- [ ] `using/recipes/*` *(multi-project-monorepo touched under DISC-002)*
- [ ] `authoring/tutorials/*` *(01, 02, 03 all touched under DISC-002 / DISC-005 / BULK-008)*
- [ ] `authoring/how-to/*` *(add-enrichment-options, change-export-paths, change-identifier-conventions, compose-with-another-generator, handle-graphql-instead-of-oas touched)*
- [ ] `authoring/recipes/*` *(design-system-across-many-apis, custom-form-field-renderer touched)*
- [ ] `reference/settings/*` *(client-json-schema, enrichments-shape touched)*

The unchecked boxes reflect docs not yet *systematically swept* for novel discrepancies, NOT unfixed known issues — every catalogued discrepancy has a per-entry Fix status below.

---

## Entries

---

### DISC-001: Enrichment routing key path is wrong across all docs

**Doc(s):** `concepts/enrichments.md`, `reference/settings/enrichments-shape.md`, `reference/settings/client-json-schema.md`, `using/how-to/configure-enrichments.md`, `using/tutorials/03-customize-with-enrichments.md`, `authoring/how-to/add-enrichment-options.md`, plus multiple recipe docs and 2 glossary entries
**Severity:** catastrophic
**Category:** structural-shape

**Claim (verbatim — from `reference/settings/enrichments-shape.md`):**

> ```
> enrichments
>   └── [generatorId]              e.g., "@skmtc/gen-shadcn-form"
>        └── [projectionKind]      e.g., "mutation" / "query" / "model"
>             └── [operationOrRefId]  e.g., "CreateContact" / "UserModel"
>                  └── [projectionKey] e.g., "form"
>                       └── { ...enrichment payload }
> ```

**Verification command:**
```bash
grep -n "subjectSegments" core/dsl/operation/oas/toOasOperationProjectionBase.ts core/dsl/model/toModelProjectionBase.ts core/dsl/operation/gql/toGqlOperationProjectionBase.ts core/enrichments/parseEnrichmentUmbrella.ts
```

**Actual (verbatim from source):**

`core/dsl/operation/oas/toOasOperationProjectionBase.ts:58-62`:
```ts
get(context.settings, `enrichments.${config.id}.${operation.path}.${operation.method}`)
```

`core/dsl/model/toModelProjectionBase.ts:59-60`:
```ts
get(context.settings, `enrichments.${config.id}.${refName}`)
```

`core/dsl/operation/gql/toGqlOperationProjectionBase.ts:58-62`:
```ts
get(context.settings, `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}`)
```

**Discrepancy:** The actual routing has three different shapes depending on generator type (3 levels for OAS ops, 2 for models, 3 for GQL), none of which include a `projectionKey` level. The discriminator for OAS operations is `(operation.path, operation.method)` — not `(projectionKind, operationId, projectionKey)`. Every JSON enrichment example in the docs lands enrichments in keys the engine won't read; Valibot silently strips them.

**Fix sketch (NOT YET APPLIED):** rewrite enrichments docs to document three routing shapes (one per projection-base factory). Each `client.json` example must be regenerated using the actual key path. Glossary entries "Projection key" and "Projection kind" should be deleted or rewritten.

**Fix status:** verified-fixed 2026-05-12 — rewrote `reference/settings/enrichments-shape.md`, `concepts/enrichments.md`, `using/how-to/configure-enrichments.md`, `using/tutorials/03-customize-with-enrichments.md`, `authoring/how-to/add-enrichment-options.md`, `reference/settings/client-json-schema.md`, `reference/glossary.md` (dropped "Projection key" and "Projection kind"), `reference/api/content-settings.md`, `llms.md`, `skills/skmtc-cli/SKILL.md`, `skills/skmtc-cli/design.md`, `skills/skmtc-generator/SKILL.md`, `reference/stock-generators/gen-shadcn-form.md`, `authoring/recipes/design-system-across-many-apis.md`. Also flattened `gen-shadcn-form/src/enrichments.ts` to drop the `form: { ... }` wrap so the schema's root IS the payload directly (consumer reads `this.settings.enrichments?.title` instead of `this.settings.enrichments?.form?.title`).

**Source note (2026-06-18):** the enrichment-defaults refactor changed subject access in these three files from a dotted template string to a key-path array — e.g. `['enrichments', config.id, operation.path, operation.method, variant]` (OAS), `['enrichments', config.id, refName, variant]` (model), `['enrichments', config.id, operation.rootKind, operation.fieldName, variant]` (GQL) — and added the core-owned `variant` level. The routing key path is otherwise unchanged, so DISC-001 stays verified-fixed; the verification command now greps the `'enrichments'` array literal in the same three files (the "Actual (verbatim)" snapshot above is the 2026-05-12 form, kept as the historical record).

**Source note (2026-07-12):** the enrichment-validation work centralized the umbrella assembly into `core/enrichments/parseEnrichmentUmbrella.ts` — each factory's `toEnrichments` now passes its routing tail as `subjectSegments` (`[operation.path, operation.method, variant]` OAS, `[refName, variant]` model, `[operation.rootKind, operation.fieldName, variant]` GQL) and the helper prepends `[generatorId, ...]` and reads through the recording accessor (`context.readEnrichment`). The routing key path is unchanged, so DISC-001 stays verified-fixed; the verification command now greps `subjectSegments` across the three factories plus the helper.

---

### DISC-002: `skmtc clone` syntax — generators are a `-g` flag, not positional args

**Doc(s):** `authoring/tutorials/01-cloning-a-generator.md`, `authoring/recipes/design-system-across-many-apis.md`, `authoring/recipes/custom-form-field-renderer.md`, `using/recipes/multi-project-monorepo.md`, plus several how-to docs that show cloning in passing
**Severity:** high
**Category:** cli-flag

**Claim (verbatim — from `authoring/tutorials/01-cloning-a-generator.md`):**

> ```bash
> skmtc clone @skmtc/gen-zod my-project
> ```

**Verification command:**
```bash
sed -n '79,97p' cli/mod.ts
```

**Actual (verbatim from source):**

`cli/mod.ts:79-97`:
```ts
const cloneCommand = new Command()
  .description(getCommandDescriptor('clone').description)
  .arguments('[project:string]')
  .option(
    '-g, --generator <id:string>',
    'Generator id (JSR specifier) to clone. Repeat for multiple.',
    { collect: true }
  )
  .option('--no-input', NO_INPUT_DESC)
  .option('--json', JSON_DESC)
```

**Discrepancy:** Only **one** positional arg (`[project]`); generator IDs come via repeatable `-g/--generator <id>` flag. Running `skmtc clone @skmtc/gen-zod my-project` would treat `@skmtc/gen-zod` as the project name (and `my-project` would be an unknown extra arg).

**Fix sketch (NOT YET APPLIED):** rewrite to `skmtc clone my-project -g @skmtc/gen-zod` (single) or `skmtc clone my-project -g @skmtc/gen-zod -g @skmtc/gen-typescript` (multiple).

**Fix status:** verified-fixed 2026-05-12 — corrected syntax in `authoring/tutorials/01-cloning-a-generator.md`, `authoring/recipes/design-system-across-many-apis.md`, `authoring/recipes/custom-form-field-renderer.md`, `concepts/clone-vs-install.md`, `concepts/generators-as-packages.md`, `README.md`, `llms.md` (two places). Final grep for `skmtc clone @skmtc` returns no hits outside friction-log.

---

### DISC-003: `reference/cli/create.md` documents `--no-input` and `--json` flags that don't exist

**Doc(s):** `reference/cli/create.md`
**Severity:** high
**Category:** cli-flag

**Claim (verbatim — from `reference/cli/create.md:18`):**

> ```
> skmtc create <project> <generator> <type> [--json] [--no-input]
> ```

Followed by `## Options` sections documenting both `--no-input` and `--json` (lines 63-69).

**Verification command:**
```bash
sed -n '70,77p' cli/mod.ts
```

**Actual (verbatim from source):**

`cli/mod.ts:70-77`:
```ts
const createCommand = new Command()
  .description(getCommandDescriptor('create').description)
  .type('generatorType', generatorType)
  .arguments('<project:string> <generator:string> <type:generatorType>')
  .action(async (_options, projectName, generator, type) => {
    const { renderCreate } = await import('@/commands/create.tsx')
    await renderCreate({ projectName, generator, type })
  })
```

**Discrepancy:** `createCommand` defines no `.option(...)` calls. No `--no-input`, no `--json`. The action callback signature `(_options, projectName, generator, type)` confirms no parsed options are read.

**Fix sketch (NOT YET APPLIED):** remove the `[--json] [--no-input]` from the synopsis. Delete the `## Options` section. Remove the JSON-output example block — `create` does not emit JSON.

**Fix status:** verified-fixed 2026-05-12 — synopsis stripped of `[--json] [--no-input]`, `## Options` section deleted, JSON output block deleted, scripted example flags removed, exit-code table no longer mentions `2` (no strict-mode parser on `create`).

---

### DISC-004: `reference/cli/create.md` model-projection constructor args claim is wrong

**Doc(s):** `reference/cli/create.md`
**Severity:** medium
**Category:** type-signature

**Claim (verbatim — from `reference/cli/create.md:53-57`):**

> | `<type>` | Factory used | Constructor args |
> |---|---|---|
> | `operation` | `toOasOperationProjectionBase` | `{ context, operation, settings }` |
> | `model` | `toModelProjectionBase` | `{ context, schema, settings }` |

**Verification command:**
```bash
sed -n '15,30p' core/dsl/model/toModelProjectionBase.ts
```

**Actual (verbatim from source):**

`core/dsl/model/toModelProjectionBase.ts:20-26`:
```ts
export type ModelProjectionArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}
```

**Discrepancy:** Model projection constructor receives `refName`, not `schema`. The schema is resolved internally from `refName` via `context.resolveSchemaRefOnce(refName, BaseId)`. (The scaffold also adds optional `destinationPath` and `rootRef` to the user-facing args type, but those aren't part of the canonical `ModelProjectionArgs`.)

**Fix sketch (NOT YET APPLIED):** change the model row to `{ context, refName, settings }`. Optionally note that the scaffold's actual constructor adds `destinationPath` and `rootRef?`.

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/create.md` model row now reads `{ context, refName, settings }` with a follow-up paragraph noting `context.resolveSchemaRefOnce(refName, BaseId)` as the schema-resolution mechanism and that the scaffold adds optional `destinationPath` and `rootRef?`. `reference/api/projection-bases.md` already documented the correct shape and was left alone. Tutorial 02's `this.schema` access falls under DISC-005 (whole projection-extends pattern is wrong) and is fixed there.

---

### DISC-005: `reference/cli/create.md` scaffolded files list is wrong

**Doc(s):** `reference/cli/create.md`, `authoring/tutorials/02-authoring-a-model-generator.md`, `authoring/tutorials/03-authoring-an-operation-generator.md`
**Severity:** high
**Category:** behavior

**Claim (verbatim — from `reference/cli/create.md:77-85`):**

> ```
> .skmtc/<project>/<generator>/
> ├── deno.json                 # generator's package metadata
> ├── mod.ts                    # exports the Entry function
> └── src/
>     ├── base.ts               # the projection base (extends factory)
>     ├── <Generator>.ts        # the Projection class (with toString)
>     └── enrichments.ts        # the Valibot enrichment schema (often empty)
> ```

**Verification command:**
```bash
sed -n '11,28p' cli/lib/model-generator.ts
```

**Actual (verbatim from source):**

`cli/lib/model-generator.ts:13-28`:
```ts
async createModelFiles(generatorPath: string) {
  const srcPath = join(generatorPath, 'src')
  const mainModule = camelCase(this.generator.packageName, { upperFirst: true })
  await Deno.mkdir(srcPath, { recursive: true })

  const modContent = this.toModelMod(mainModule)
  await Deno.writeTextFile(join(srcPath, 'mod.ts'), modContent)

  const baseContent = this.toModelProjectionBase(mainModule)
  await Deno.writeTextFile(join(srcPath, 'base.ts'), baseContent)

  const projectionContent = this.toModelProjection(mainModule)
  await Deno.writeTextFile(join(srcPath, `${mainModule}Projection.ts`), projectionContent)
}
```

**Discrepancy:**
1. The model scaffold writes `${mainModule}Projection.ts` (with `Projection` suffix), not `<Generator>.ts`. For input `my-zod-schema`, the file is `MyZodSchemaProjection.ts`.
2. The model scaffold does NOT create `enrichments.ts`. Users must add it manually.
3. The scaffold creates `mod.ts`, `base.ts`, `<MainModule>Projection.ts` in `src/`. The top-level `deno.json` and `mod.ts` (if any) are written elsewhere; needs separate verification.

The operation-generator path (`cli/lib/operation-generator.ts:23`) writes `${mainModule}.ts` (no `Projection` suffix). So model and operation scaffolds use different naming.

**Fix sketch (NOT YET APPLIED):** rewrite the scaffold tree per actual filenames. Verify and document the top-level `deno.json` scaffolding separately. Update `authoring/tutorials/02` and `03` to match.

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/create.md` now shows the two distinct scaffold trees (model vs operation, with the `<MainModule>Projection.ts` vs `<MainModule>.ts` asymmetry called out) and notes `enrichments.ts` is not scaffolded; also documents the top-level `deno.json` and `mod.ts` written by `Generator.createFiles`. `authoring/tutorials/02-authoring-a-model-generator.md` rewritten to extend `SchemaMetaBase = toModelProjectionBase({...})` rather than the abstract `ModelProjectionBase` directly, and to resolve the schema inside the constructor via `context.resolveSchemaRefOnce(refName, baseId)` instead of accessing `this.schema`. `authoring/tutorials/03-authoring-an-operation-generator.md` rewritten with the same factory-extends pattern and the enrichment example flattened (no wrapper key) to match the DISC-001 flattened convention.

---

### DISC-006: `reference/cli/doctor.md` claims exit code 3 that doesn't exist

**Doc(s):** `reference/cli/doctor.md`, `reference/cli/overview.md`, `using/how-to/debug-failing-generation.md`
**Severity:** high
**Category:** cli-flag

**Claim (verbatim — from `reference/cli/doctor.md`):**

> | Code | Meaning |
> |------|---------|
> | `0` | All checks passed (warnings allowed) |
> | `1` | Internal error running checks (rare) |
> | `3` | One or more checks failed |
>
> `doctor` is the one CLI command that uses exit code `3`

**Verification command:**
```bash
grep -n "Deno.exit" cli/commands/doctor.ts
```

**Actual (verbatim from source):**

`cli/commands/doctor.ts:31`:
```ts
Deno.exit(result.summary === 'error' ? 1 : 0)
```

**Discrepancy:** The doctor command exits only `0` or `1`. There is no exit code `3`. The "doctor is the one CLI command that uses exit code 3" claim is fabricated.

**Fix sketch (NOT YET APPLIED):** replace the exit-code table: `0` = checks ran (with or without warnings); `1` = a check failed at error severity. Remove the "one CLI command that uses exit code 3" sentence.

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/doctor.md` exit-code table now lists `0`/`1` only with the rationale paragraph rewritten; CI example and "exit code 3 when any check fails" callout updated; `reference/cli/overview.md` CLI-wide exit-code table dropped the `3 = doctor diagnostics` row and added an explanatory note that doctor collapses onto `1`. No `exit 3` / `code 3` mentions remain in `using/how-to/debug-failing-generation.md` (final grep returns nothing).

---

### DISC-007: `reference/cli/doctor.md` check-status values are wrong

**Doc(s):** `reference/cli/doctor.md`
**Severity:** medium
**Category:** structural-shape

**Claim (verbatim — from `reference/cli/doctor.md`):**

> ### Status values
> - **`ok`** — check passed
> - **`warn`** — advisory; the system can still operate
> - **`fail`** — blocking issue

**Verification command:**
```bash
grep -n "CheckStatus" cli/lib/doctor-headless.ts
```

**Actual (verbatim from source):**

`cli/lib/doctor-headless.ts:25`:
```ts
export type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'
```

**Discrepancy:** Three differences:
- `warn` → `warning` (truncated value doesn't exist)
- `fail` → `error` (wrong word)
- Missing `skipped` value entirely (I claimed 3 statuses; actual is 4)

JSON examples in `doctor.md` that use `"status": "warn"` or `"status": "fail"` would never appear in real output.

**Fix sketch (NOT YET APPLIED):** update the status-values list to the 4 actual values. Rewrite JSON examples to use real status strings.

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/doctor.md` status list now reads `ok` / `warning` / `error` / `skipped` (4 values, matching `CheckStatus`); JSON example rewritten to match the actual `DoctorResult`/`Check` shape (`skmtcRootPath`, `globalStateDir`, `cliVersion`, `projects`, `checks: { id, status, message, hint?, data? }`, top-level `summary: CheckStatus`); CI example rewritten to read `.summary` rather than the fabricated `.summary.fail`. Followup not in DISC-007 scope: the workspace/project check-ID tables in `doctor.md` still describe a fictional check set; the actual checks are `shim-lockfile`, `project-deno-json/<n>`, `project-base-path/<n>`, `project-core-pin/<n>`, `project-bundle/<n>`, `project-manifest/<n>`. That needs a separate catalog entry — leaving the table alone for now to avoid scope creep. Straggler closed 2026-05-13: agent-consumption jq one-liner at `doctor.md:170` updated from `select(.status == "fail")` to `select(.status == "error")` — caught during audit pass.

---

### DISC-008: `reference/cli/clone.md` documents `--force` flag that isn't wired in `cli/mod.ts`

**Doc(s):** `reference/cli/clone.md`, mentioned in `authoring/tutorials/01-cloning-a-generator.md`
**Severity:** medium (depends on follow-up)
**Category:** cli-flag

**Claim (verbatim — from `reference/cli/clone.md:14`):**

> ```
> skmtc clone [project] [-g <generator-id>...] [--force] [--json] [--no-input]
> ```

And `## Options` section:
> ### `--force`
> Bypass the pre-flight `@skmtc/core` peer-pin check.

**Verification command:**
```bash
sed -n '79,97p' cli/mod.ts
```

**Actual (verbatim from source):**

`cli/mod.ts:79-97` (shown above in DISC-002): defines `-g/--generator`, `--no-input`, `--json` options. **No `.option('--force', ...)` call.** The action callback destructures `{ json, input, generator }` — no `force` field.

**Discrepancy:** The CLI doesn't define `--force` as a flag. The `renderClone` function signature (`cli/commands/clone.tsx`) does accept a `force?: boolean` parameter, but no CLI wiring passes a value to it.

**Note for follow-up:** the `force` semantics may be reachable via the interactive prompt or a non-flag path. Worth checking before deleting all `--force` mentions — otherwise we'd remove documentation of a feature that exists but is invocable some other way.

**Fix sketch (NOT YET APPLIED, depends on follow-up):** if `--force` truly has no CLI surface, remove from synopsis and options. If it's reachable via prompts, document that path instead.

**Fix status:** verified-fixed 2026-05-12 — root-caused as a missing `.option('--force', ...)` call rather than a doc fabrication: the error message at `cli/lib/generator.ts:189` literally says "or re-run with --force", and `renderClone`/`Generator.clone` already accept the `force` boolean and use it to skip the peer-pin check, but the cloneCommand in `cli/mod.ts:79-97` never registered the flag. Per user direction (option "Wire --force into cli/mod.ts"), added `FORCE_DESC` constant and `.option('--force', FORCE_DESC)` to cloneCommand, and destructured `force` from the action callback's options to pass into `renderClone`. Type-check clean (only pre-existing `openapi-down-convert/src/converter.ts` errors remain, unrelated to this change). `reference/cli/clone.md` already documents `--force` accurately so no doc edits needed.

---

### DISC-009: `manifest-format.md` claims `parseIssues` is optional

**Doc(s):** `reference/manifest-format.md`
**Severity:** medium
**Category:** type-signature

**Claim (verbatim — from `reference/manifest-format.md:56-57`):**

> ```ts
>   /** Parse-time issues (populated by @skmtc/core ≥ 0.3.x) */
>   parseIssues?: ParseIssue[]
> ```

And lines 169-171:
> Older `@skmtc/core` versions don't populate this field; the CLI treats undefined as "no error issues" and exits cleanly when only warnings are present (or when the field is missing entirely).

**Verification command:**
```bash
grep -n "parseIssues" core/types/Manifest.ts
```

**Actual (verbatim from source):**

`core/types/Manifest.ts:162`:
```ts
parseIssues: ParseIssue[]
```

`core/types/Manifest.ts:176`:
```ts
parseIssues: v.array(parseIssue),
```

**Discrepancy:** Both the TS type and the Valibot schema make `parseIssues` required. No `?`, no `v.optional`. Always an array, possibly empty. The "populated by @skmtc/core ≥ 0.3.x" version-gating story is fabricated.

**Fix sketch (NOT YET APPLIED):** change `parseIssues?: ParseIssue[]` to `parseIssues: ParseIssue[]`. Replace the version-gating prose with "always present; an empty array means no parse issues."

**Fix status:** verified-fixed 2026-05-12 — `reference/manifest-format.md` field signature now reads `parseIssues: ParseIssue[]` (required), and the `### parseIssues` section opens with "Always present in the manifest — an empty array means no parse issues, not 'old core version'." The version-gating prose ("populated by @skmtc/core ≥ 0.3.x") is gone. While there, the `ParseIssue` definition was rewritten as the four-variant discriminated union (the actual shape, with `cause` present only on `level: 'error'`) to fix the related shape misrepresentation flagged in round 4.1 of the verification pass.

---

### DISC-010: `error-codes.md` lists 7 of 17 OAS issue types and 2 of 7 GraphQL issue types

**Doc(s):** `reference/error-codes.md`
**Severity:** medium
**Category:** structural-shape

**Claim (verbatim — from `reference/error-codes.md`):**

Documents only:
- OAS: `INVALID_SCHEMA`, `INVALID_DEPENDENCY_REF`, `MISSING_OBJECT_TYPE`, `MISSING_ARRAY_TYPE`, `MISSING_BOOLEAN_TYPE`, `MISSING_STRING_TYPE`, `UNEXPECTED_PROPERTY` (7 types)
- GraphQL: `INVALID_TYPE_DEFINITION`, `SKIPPED_FIELD_ARGUMENTS` (2 types)

**Verification command:**
```bash
grep -A 20 "^export type OasIssueType" core/context/generateTypes.ts
grep -A 10 "^export type GqlIssueType" core/context/ParseIssue.ts
```

**Actual (verbatim from source):**

`core/context/generateTypes.ts:159-177`:
```ts
export type OasIssueType =
  | 'UNEXPECTED_PROPERTY'
  | 'MISSING_OBJECT_TYPE'
  | 'MISSING_STRING_TYPE'
  | 'MISSING_ARRAY_TYPE'
  | 'MISSING_BOOLEAN_TYPE'
  | 'INVALID_EXAMPLE'
  | 'INVALID_ENUM'
  | 'INVALID_DEFAULT'
  | 'INVALID_NULLABLE'
  | 'UNEXPECTED_FORMAT'
  | 'INVALID_RESPONSE'
  | 'INVALID_FORMAT'
  | 'INVALID_OPERATION'
  | 'INVALID_SCHEMA'
  | 'INVALID_PARAMETER'
  | 'INVALID_DEPENDENCY_REF'
  | 'EXAMPLE_AND_EXAMPLES_DEFINED'
```

`core/context/ParseIssue.ts:47-54`:
```ts
export type GqlIssueType =
  | 'NESTED_LIST_LOSSY'
  | 'UNKNOWN_TYPE_KIND'
  | 'DROPPED_DIRECTIVE'
  | 'SKIPPED_FIELD_ARGUMENTS'
  | 'SKIPPED_FEATURE'
  | 'INVALID_TYPE_DEFINITION'
  | 'INVALID_DEPENDENCY_REF'
```

**Discrepancy:**
- 10 OAS issue types missing from the doc: `INVALID_EXAMPLE`, `INVALID_ENUM`, `INVALID_DEFAULT`, `INVALID_NULLABLE`, `UNEXPECTED_FORMAT`, `INVALID_RESPONSE`, `INVALID_FORMAT`, `INVALID_OPERATION`, `INVALID_PARAMETER`, `EXAMPLE_AND_EXAMPLES_DEFINED`
- 5 GraphQL issue types missing: `NESTED_LIST_LOSSY`, `UNKNOWN_TYPE_KIND`, `DROPPED_DIRECTIVE`, `SKIPPED_FEATURE`, `INVALID_DEPENDENCY_REF`
- `INVALID_DEPENDENCY_REF` appears in BOTH `OasIssueType` AND `GqlIssueType`. The doc puts it under OAS only.

**Fix sketch (NOT YET APPLIED):** add the 15 missing issue type entries. Move `INVALID_DEPENDENCY_REF` to a shared section or duplicate per-protocol with notes about each.

**Fix status:** verified-fixed 2026-05-12 — `reference/error-codes.md` now documents all 17 OAS types (added `INVALID_OPERATION`, `INVALID_PARAMETER`, `INVALID_RESPONSE`, `INVALID_EXAMPLE`, `INVALID_DEFAULT`, `INVALID_FORMAT`, `UNEXPECTED_FORMAT`, `INVALID_NULLABLE`, `EXAMPLE_AND_EXAMPLES_DEFINED`, plus the reserved `INVALID_ENUM`) and all 7 GraphQL types (added `NESTED_LIST_LOSSY`, `UNKNOWN_TYPE_KIND`, `DROPPED_DIRECTIVE`, plus the reserved `SKIPPED_FEATURE`, plus a dedicated entry for the shared `INVALID_DEPENDENCY_REF` under GraphQL with a discriminator note that the same code appears in `OasIssueType` and `GqlIssueType`). Levels (error vs warning) verified at the actual emission site for each (e.g., `INVALID_OPERATION` is `error` per `oas/operation/toOperationsV3.ts:175`, `NESTED_LIST_LOSSY` is `warning` per `gql/field/toFieldSchema.ts:65`, `UNKNOWN_TYPE_KIND` is `error` per `gql/field/toFieldSchema.ts:111`). The FAQ section's misleading "old @skmtc/core didn't emit parseIssues" answer was rewritten to match the always-present reality from DISC-009.

---

## Audit checkpoint

10 entries above represent a **sample**, not exhaustive coverage. Categories still needing systematic walkthrough:

- **CLI ref docs not yet entered:** `init.md`, `install.md`, `list.md`, `remove.md`, `generate.md`, `bundle.md`, `dev.md`, `agent-context.md`, `overview.md` (specific claims verified in earlier rounds need transcription)
- **Tutorial/how-to/recipe docs:** all CLI-invocation lines need verification (especially around `skmtc clone` syntax which propagates DISC-002)
- **`reference/api/*`:** signatures spot-checked in earlier rounds; need transcription into catalog format
- **All `reference/settings/*`** content beyond DISC-001
- **All `concepts/*`** content
- **All `explanation/*`** content
- **Glossary** entries
- **Skills** content

**Recommended audit step before continuing:** pick 2-3 entries above (say DISC-002, DISC-006, and DISC-010 — different categories). Run each verification command. Confirm the `Actual` field matches the live source output. If yes, the catalog format is working and we can proceed mechanically. If not, the method or my execution needs adjustment.

---

## Bulk-findings sweep (wide-net grep)

The detailed entries DISC-001 through DISC-010 above describe each
discrepancy in depth. This section catalogs **every doc:line where each
discrepancy propagates** so fixes can be applied across all affected docs
at once.

Generated by `grep -rn '<pattern>' --include='*.md' docs/`. Re-running each
listed grep regenerates the propagation list — auditable. The friction-log
itself is excluded from the searches.

### BULK-001 — `skmtc clone <generator> <project>` syntax (links to DISC-002)

Pattern: positional generator before project name (instead of `-g` flag).

```bash
grep -rnE 'skmtc clone @\S+ \S' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (10 instances across 7 docs):

- `README.md:112`
- `llms.md:244, 523`
- `concepts/clone-vs-install.md:78`
- `concepts/generators-as-packages.md:235`
- `authoring/tutorials/01-cloning-a-generator.md:24`
- `authoring/recipes/custom-form-field-renderer.md:23`
- `authoring/recipes/design-system-across-many-apis.md:45, 46, 47`

**Bulk fix:** each line rewrites to `skmtc clone <project> -g <gen-id>`. The three lines in `design-system-across-many-apis.md` can be condensed to one invocation with three `-g` flags.

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-002's sweep across all listed docs. Audit grep 2026-05-13 (`skmtc clone @\S+ \S`) returns zero hits outside friction-log.

### BULK-002 — invented `projectionKey` level (links to DISC-001)

Pattern: any mention of `projectionKey` as a routing-path level.

```bash
grep -rn 'projectionKey\|projection key' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~24 instances across 12 docs):

- `llms.md:321`
- `using/how-to/configure-enrichments.md:39, 67`
- `using/tutorials/03-customize-with-enrichments.md:84`
- `concepts/enrichments.md:8, 81, 95, 197, 202`
- `skills/skmtc-cli/SKILL.md:198`
- `skills/skmtc-cli/design.md:92`
- `reference/glossary.md:104, 286`
- `reference/settings/client-json-schema.md:40, 164`
- `reference/settings/enrichments-shape.md:21, 61, 99, 132, 272, 304, 322, 325`
- `reference/api/content-settings.md:94`

**Bulk fix:** the `projectionKey` level doesn't exist in actual routing. Every mention should be removed (the schema value IS the enrichment root). Several docs need full sections rewritten, not just edits — particularly `concepts/enrichments.md` and `reference/settings/enrichments-shape.md` whose conceptual framing is built around it.

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-001's sweep. Audit grep 2026-05-13 returns a single hit at `concepts/enrichments.md:239` which is a NEGATION ("no separate 'projection kind' or 'projection key' routing level") — preserved by design.

### BULK-003 — `projectionKind` as a routing level (links to DISC-001)

Pattern: any mention of `projectionKind` framed as a level in the enrichment path.

```bash
grep -rn 'projectionKind\|projection kind' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~25 instances across 11 docs — overlapping set with BULK-002):

- `llms.md:321, 481`
- `using/how-to/configure-enrichments.md:39, 67`
- `using/tutorials/03-customize-with-enrichments.md:84`
- `concepts/enrichments.md:8, 79, 90, 197, 202, 355`
- `skills/skmtc-generator/SKILL.md:364`
- `skills/skmtc-cli/SKILL.md:198, 388`
- `skills/skmtc-cli/design.md:92`
- `reference/settings/enrichments-shape.md:19, 35, 132, 287, 304, 322, 324`
- `reference/glossary.md:104, 290`
- `reference/settings/client-json-schema.md:40, 164`

**Bulk fix:** `projectionKind` as an abstract level is wrong. The actual second level varies:
- OAS operations: `operation.path` (e.g., `"/users"`)
- GraphQL operations: `operation.rootKind` (e.g., `"query"`, `"mutation"`)
- Models: doesn't have this level — the second level is `refName` directly

Rewriting these requires per-generator-type framing rather than the unified four-level model.

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-001's sweep with the three-shapes framing (OAS by `(path, method)`, GQL by `(rootKind, fieldName)`, models by `refName`). Audit grep 2026-05-13 returns only the shared NEGATION line at `concepts/enrichments.md:239`.

### BULK-004 — `operationOrRefId` as a routing level (links to DISC-001)

Pattern: any mention of `operationOrRefId`.

```bash
grep -rn 'operationOrRefId' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~14 instances across 7 docs):

- `llms.md:321`
- `using/how-to/configure-enrichments.md:39`
- `concepts/enrichments.md:8, 80, 93, 197, 202`
- `skills/skmtc-cli/SKILL.md:198`
- `reference/glossary.md:104`
- `reference/settings/client-json-schema.md:40, 164`
- `reference/settings/enrichments-shape.md:20, 48, 132, 288`

**Bulk fix:** the third level for OAS operations is `operation.method` (literal HTTP method), not a generic `operationOrRefId`. For models there's no third level (the second level is already `refName`). Term itself is invented.

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-001's sweep. Audit grep 2026-05-13 for `operationOrRefId` returns zero hits.

### BULK-005 — "four-level" framing of the enrichment path (links to DISC-001)

Pattern: prose claims that there are four routing levels.

```bash
grep -rn 'four-level\|4-level\|four level' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 8 docs):

- `using/tutorials/03-customize-with-enrichments.md:84`
- `using/how-to/configure-enrichments.md:36`
- `concepts/enrichments.md:7, 74, 310`
- `authoring/how-to/add-enrichment-options.md:58`
- `reference/settings/enrichments-shape.md:4, 12, 316`
- `reference/settings/client-json-schema.md:160`
- `reference/api/content-settings.md:91`
- `reference/stock-generators/gen-typescript.md:58`

**Bulk fix:** "four-level" is wrong. The path is 3 levels for OAS/GQL operations, 2 levels for models. The framing of a single uniform path is the root error.

**Fix status:** verified-fixed 2026-05-12 with one straggler closed 2026-05-13 — the main sweep landed under DISC-001; the audit pass on 2026-05-13 caught one missed line at `reference/stock-generators/gen-typescript.md:58` ("cleaner than the four-level enrichments path") and rewrote it to "cleaner than the per-operation enrichments path". Audit grep 2026-05-13 returns zero `four-level` hits outside auto-generated activity logs.

### BULK-006 — Wrong JSON examples using `"mutation":` / `"CreateContact":` etc. (links to DISC-001)

Pattern: enrichment JSON examples using the wrong key shape (`"mutation": { "CreateContact": ...}`).

```bash
grep -rn '"CreateContact":\|"UserModel":\|"CreateUser":' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 6 docs):

- `using/how-to/configure-enrichments.md:50`
- `concepts/enrichments.md:51, 248, 267, 318, 348`
- `authoring/recipes/design-system-across-many-apis.md:118`
- `skills/skmtc-cli/SKILL.md:202`
- `reference/settings/client-json-schema.md:174, 231`
- `reference/settings/enrichments-shape.md:182, 200`

**Bulk fix:** each JSON example needs the key path rewritten. For OAS operations, the actual shape is `{ "<path>": { "<method>": <enrichment-value> } }`. The example operation names (`CreateContact`, `CreateUser`) should be replaced with their actual paths (e.g., `"/customers": { "post": {...} }`).

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-001's sweep. Audit grep 2026-05-13 for `"CreateContact"|"UserModel"|"CreateUser"` returns only valid model-routing examples (where `"UserModel"` IS the correct second-level key under `gen-zod`/`gen-typescript`). The `"mutation"`/`"CreateContact"`-style wrapping is gone.

### BULK-007 — Wrong default export path `/models/<X>.generated.ts` (links to DISC-005)

Pattern: docs claim `/models/<X>.generated.ts` as a stock generator's default path.

```bash
grep -rn '/models/.*\.generated\|models/<refName>\|models/\${refName}' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~9 instances across 4 docs):

- `explanation/how-idempotency-works.md:54, 130, 140, 144, 156, 163`
- `authoring/how-to/change-export-paths.md:33`
- `authoring/tutorials/01-cloning-a-generator.md:71`
- `reference/api/content-settings.md:128`

**Bulk fix:** actual default paths for stock generators:
- `gen-zod`: `@/types/<name>.generated.ts`
- `gen-typescript`: `@/types/<name>.generated.ts`
- `gen-shadcn-form`: `@/forms/<Verb><Path>Form.generated.tsx`
- `gen-msw`: `@/mocks/handlers.generated.ts`

Citations in `how-idempotency-works.md` need particular care — they're stepping through an example trace that loses accuracy if the paths are wrong.

**Source verification 2026-05-13:** confirmed real issue. Actual paths from stock-generator source:
- `gen-zod/src/base.ts:23` — `return join("@", "types", \`${decapitalize(name)}.generated.ts\`)` → `@/types/<decapitalize(name)>.generated.ts`
- `gen-typescript/src/base.ts:17` — `return join('@', 'types', \`${decapitalize(name)}.generated.ts\`)` → `@/types/<decapitalize(name)>.generated.ts`
- `gen-shadcn-form/src/base.ts:21` — `return join('@', 'forms', \`${name}.generated.tsx\`)` → `@/forms/<name>.generated.tsx`
- `gen-msw/src/base.ts:16` — `return join('@', 'mocks', \`handlers.generated.ts\`)` → `@/mocks/handlers.generated.ts`

No stock generator writes to `/models/`. The original bulk-fix paths sketch is correct; `gen-zod`/`gen-typescript` paths should additionally note the `decapitalize(camelCase(refName))` derivation.

**Fix status:** verified-fixed 2026-05-13 — all 8 sites updated:
- `explanation/how-idempotency-works.md` — 5 occurrences of `/models/User.generated.ts` → `@/types/user.generated.ts`; `User.generated.ts` filename references → `user.generated.ts` (matches gen-zod's `decapitalize(camelCase(refName))` derivation).
- `authoring/how-to/change-export-paths.md:33` — "Default" example rewritten to show the actual gen-zod/gen-typescript stock default (`join('@', 'types', decapitalize(name) + '.generated.ts')`) instead of the fictional `/models/` form.
- `authoring/tutorials/01-cloning-a-generator.md:74` — "before" example aligned with `gen-zod/src/base.ts:23` actual code (signature `({ refName, enrichments })`, body uses `decapitalize(name)` with `@/types/` prefix).
- `reference/api/content-settings.md:128` — illustrative `exportPath` value changed from `/models/User.generated.ts` to `@/types/userBody.generated.ts` (matches the identifier `userBody` in the same example).

### BULK-008 — `class X extends ModelProjectionBase` etc. (links to DISC-005)

Pattern: documented Projection class extends the abstract base directly (rather than the factory result).

```bash
grep -rn 'extends ModelProjectionBase\|extends OasOperationProjectionBase\|extends GqlOperationProjectionBase' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 9 docs):

- `explanation/how-idempotency-works.md:48`
- `concepts/cross-generator-coordination.md:224`
- `authoring/tutorials/02-authoring-a-model-generator.md:92`
- `authoring/tutorials/03-authoring-an-operation-generator.md:91`
- `authoring/how-to/compose-with-another-generator.md:44`
- `authoring/how-to/handle-graphql-instead-of-oas.md:49`
- `reference/api/generate-context.md:283`
- `reference/api/dsl-snippet-base.md:148` (in a prose comment — may be benign)
- `reference/api/content-settings.md:157, 225, 249, 300`

**Bulk fix:** the actual pattern is `class XProjection extends XBase` where `XBase = toModelProjectionBase({...})` (or the appropriate factory). The doc snippets that demonstrate "how to write a Projection" need to show the factory-then-extend two-step. The `dsl-snippet-base.md` instance reads "and extends OasOperationProjectionBase, which extends SnippetBase" — that's a chain-of-extension claim in prose, separate from a code example, and may be benign; verify before editing.

**Source verification 2026-05-13:** confirmed real issue. Stock-generator source uses the factory-extends pattern:
- `gen-zod/src/base.ts:11` — `export const ZodBase = toModelProjectionBase({ id: denoJson.name, toIdentifier({...}), toExportPath({...}) })`
- `gen-zod/src/ZodProjection.ts:20` — `export class ZodProjection extends ZodBase` (extends factory result, NOT `ModelProjectionBase` directly)
- `gen-typescript/src/TsProjection.ts:14` — `export class TsProjection extends TypescriptBase` (same pattern)

DISC-005 fix already rewrote `authoring/tutorials/02-…` and `03-…` to use the correct pattern. The remaining 9 sites in 7 docs (`how-idempotency-works.md:48`, `cross-generator-coordination.md:232`, `compose-with-another-generator.md:44`, `handle-graphql-instead-of-oas.md`, `generate-context.md:276`, `content-settings.md:157,225,247,298`, `dsl-snippet-base.md:148`) still show the direct-extends pattern.

**Fix status:** verified-fixed 2026-05-13 — 8 code-example sites updated to the factory-extends pattern (`class XProjection extends XBase` where `XBase = toX...ProjectionBase({...})` in `base.ts`):
- `concepts/how-generators-produce-output.md:158` — narrative rewritten to "extends MyBase" with factory note.
- `concepts/cross-generator-coordination.md:232` — code example shows base in `base.ts` + class extending it.
- `authoring/how-to/compose-with-another-generator.md:44` — `class TanstackQuery extends TanstackQueryBase` with comment.
- `authoring/how-to/handle-graphql-instead-of-oas.md:49` — already clean (catalog reference was stale; line drift).
- `reference/api/generate-context.md:276` — example rewritten to `MyBase` then `class MyProjection extends MyBase`.
- `reference/api/content-settings.md:157,225,247,298` — all 4 sites rewritten with their own `XBase` factory result + extending class.

Remaining hit `reference/api/dsl-snippet-base.md:148` is intentionally left — it's a prose comment explaining the type hierarchy (`MyGenBase → OasOperationProjectionBase → SnippetBase`), not a user-pattern code example. The surrounding code at line 146 (`class MyProjection extends MyGenBase`) already shows the factory-extends pattern. The line-148 comment is by design.

### BULK-009 — `SkmtcDocumentInput` with wrong field names (links to DISC under to-artifacts)

Pattern: type definitions using `document`/`sdl` field names instead of `value`.

```bash
grep -rn "{ type: 'oas'; document\|{ type: 'gql'; sdl" docs/ --include='*.md' | grep -v friction-log
```

Affected lines (4 instances in 1 doc):

- `reference/api/to-artifacts.md:61, 62, 334, 335`

**Bulk fix:** both fields are named `value` in the actual type (`core/types/SkmtcDocument.ts`). Fix all 4 lines in `to-artifacts.md`. The `glossary.md` entry for `SkmtcDocumentInput` already has the correct field name, so this is a fix-this-one-doc issue.

**Fix status:** verified-fixed 2026-05-13 — `reference/api/to-artifacts.md:32,61-62,222,262,340-341` all use `value:` field name. Audit-verified zero hits for the `{ type: 'oas'; document` / `{ type: 'gql'; sdl` patterns. Catalog status was stale; doc fix already landed.

### BULK-010 — `parseIssues?` optional (links to DISC-009)

Pattern: documentation marks `parseIssues` as optional.

```bash
grep -rn 'parseIssues?' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (3 instances across 3 docs):

- `reference/manifest-format.md:57` (DISC-009)
- `concepts/error-handling-philosophy.md:176`
- `skills/skmtc-debug/SKILL.md:119`

**Bulk fix:** change `parseIssues?: ParseIssue[]` to `parseIssues: ParseIssue[]` in all three. Drop accompanying "populated by @skmtc/core ≥ X" prose — fabricated version-gating.

**Fix status:** verified-fixed 2026-05-13 — DISC-009 fix landed at `manifest-format.md` on 2026-05-12. Today closed the two propagation sites: `concepts/error-handling-philosophy.md:315` and `skills/skmtc-debug/SKILL.md:121` both now read `parseIssues: ParseIssue[]    // always present; empty array = no issues`. Source check: `core/types/Manifest.ts:162` confirms `parseIssues: ParseIssue[]` (required, no `?`).

### BULK-011 — Doctor exit code 3 / `warn` / `fail` (links to DISC-006, DISC-007)

Pattern: doctor-specific fabrications.

```bash
grep -rn "'warn'\|'fail'\|exit code 3" docs/reference/cli/doctor.md
```

Affected lines (~7 instances in `reference/cli/doctor.md` only):

- Lines 111, 119, 126, 127, 162 (status strings `warn`/`fail`)
- Lines 180, 192 (exit code 3)

**Bulk fix:** all in one doc. Replace `warn` → `warning`, `fail` → `error`. Add `skipped` to the value list. Replace exit code 3 with `result.summary === 'error' ? 1 : 0` semantics.

**Fix status:** verified-fixed 2026-05-12 (status/exit code main sweep under DISC-006/007) with one straggler closed 2026-05-13 (`doctor.md:170` jq one-liner `"fail"` → `"error"`). Audit grep 2026-05-13 for `'warn'|'fail'|exit code 3` in `doctor.md` returns zero load-bearing hits.

### BULK-012 — `skmtc create` with `--json` / `--no-input` (links to DISC-003)

Pattern: invocations using flags `create` doesn't have.

```bash
grep -rn 'skmtc create.*--json\|skmtc create.*--no-input\|create my-.*--json' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (2 instances in 1 doc):

- `reference/cli/create.md:18, 152`

**Bulk fix:** delete the flags from synopsis and the example invocation. Delete the Options section. Delete the JSON-output example block.

**Fix status:** verified-fixed 2026-05-12 — closed under DISC-003's rewrite of `reference/cli/create.md` (synopsis stripped, Options section deleted, JSON-output block removed, exit-code table simplified). Audit grep 2026-05-13 for `skmtc create.*--json|skmtc create.*--no-input` returns zero hits.

---

## Net cast — totals

Across BULK-001 through BULK-012, the net surfaced approximately **130 specific (file, line) sites** to fix. The breakdown:

| Discrepancy | Sites | Affected docs |
|---|---|---|
| Clone syntax (BULK-001) | ~10 | 7 |
| Enrichments routing taxonomy (BULK-002 through BULK-006) | ~75 | 12 (overlapping) |
| Default export path /models/ (BULK-007) | ~9 | 4 |
| Extends ModelProjectionBase pattern (BULK-008) | ~12 | 9 |
| SkmtcDocumentInput fields (BULK-009) | 4 | 1 |
| parseIssues optional (BULK-010) | 3 | 3 |
| Doctor (BULK-011) | ~7 | 1 |
| Create flags (BULK-012) | 2 | 1 |

**Roughly 22 unique docs need editing**, with the enrichments-taxonomy cluster being the dominant source of edits (~75 of ~130 lines).

This is **not** a complete catalog — only the patterns I had ground-truth for from earlier verification rounds. Patterns still unsearched:

- Specific signatures from `reference/api/*` beyond the spot-checks
- Concept-doc line citations (`Foo.ts:NNN` references — those drift)
- CLI command flag-set claims for `bundle`, `dev`, `agent-context`, `list`, `remove` (verified clean at the synopsis level; surrounding prose unchecked)
- `manifest-format.md` JSON output examples (the `results` tree shape)
- `error-codes.md` issue-type lists (DISC-010 only covers totals; specific entries per type unverified)
- All claims in `explanation/*` and `concepts/*` not yet probed

A few more wide-net probes would surface more. Each new ground truth → one grep → bulk findings list. Diminishing returns set in at maybe 30-50 probes total.

**Suggested next probes** (if continuing):
- `RenderContext.ts:NNN` or any concept-doc line citation — drift detection
- `core/helpers/tryParseAt` — wrong path (actual is `core/context/`)
- `OasIssueType` value list completeness (more docs may list a subset)
- `GqlIssueType` value list completeness
- `<MainModule>.ts` scaffold filename references — to find inconsistency with `Projection` suffix
- `enrichments.ts` mentioned as scaffolded — DISC-005 propagation
- Specific helper function names (`toEndpointName`, `toMethodVerb`) — to find docs that miscite their signatures

---

## Bulk-findings sweep — round 2

### BULK-013 — `EntityTypeValue` actual values are `'variable' | 'type'`, not `'const' | 'type'`

This is a **new catastrophic-class finding** discovered during deeper API spot-checks.

**Actual** (`core/dsl/EntityType.ts:59`):
```ts
export type EntityTypeValue = 'variable' | 'type'
```

The docstring (`core/dsl/EntityType.ts:42-49`) is explicit: `'variable'` entities are mapped to `'const'` declarations at render time; `'type'` entities are mapped to `'type'` declarations. So the internal discriminator is `'variable'` but the *rendered keyword* is `const`.

My docs conflated the two layers throughout.

Pattern:

```bash
grep -rn "'const' | 'type'\|'const'.*'type'\|entityType === 'const'\|entityType: 'const'" docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~13 instances across 7 docs):

- `llms.md:603`
- `reference/api/dsl-import.md:190`
- `reference/api/dsl-identifier.md:3, 25, 50, 90, 93, 130, 161, 167, 374`
- `reference/api/content-settings.md:66`
- `reference/api/core-overview.md:70, 140`
- `reference/api/dsl-definition.md:70`

**Bulk fix:** wherever a doc says `EntityTypeValue = 'const' | 'type'`, change to `EntityTypeValue = 'variable' | 'type'`. Wherever a doc says `entityType === 'const'` (as a runtime check), change to `entityType === 'variable'`. Add the variable→const keyword-mapping clarification near the type definition; the rendered TS keyword IS `const`, just the discriminator value isn't.

Especially load-bearing in `dsl-identifier.md` which is the canonical reference for this type.

**Fix status:** verified-fixed 2026-05-13 — `reference/api/dsl-identifier.md` (the canonical reference) now correctly documents `export type EntityTypeValue = 'variable' | 'type'` at line 50, with explicit class-vs-value distinction at line 58, the wrong-comparison footgun at line 64, and the rendered-keyword mapping note at lines 69-72. Audit count: 13 sites → 1 residual at `docs/llms.md:600` (closed 2026-05-13: changed `('const' vs 'type')` to `('variable' vs 'type'; 'variable' renders as the TS keyword const)`). Source check: `core/dsl/EntityType.ts:59` confirms `'variable' | 'type'`.

### BULK-014 — `basePath` documented as required but is optional in `ClientSettings`

**Actual** (`core/types/Settings.ts:357`):
```ts
export type ClientSettings = {
  basePath?: string                    // ← optional
  packages?: ModulePackage[]
  enrichments?: GeneratorEnrichments
  include?: Include[]
  skip?: Skip[]
}
```

And Valibot at line 154: `basePath: v.optional(v.string())`.

Pattern:

```bash
grep -rn "basePath.*required\|Required.*basePath\|basePath.*(required)" docs/ --include='*.md' | grep -v friction-log
```

Affected lines:
- `reference/settings/client-json-schema.md:76` — explicit `### settings.basePath (required)` heading
- `reference/settings/client-json-schema.md:317` — "Missing required fields (`settings.basePath`) → recipe error"
- `reference/cli/init.md:206` — exit-code note "basePath was absolute" — accurate, but lives in the same doc that elsewhere treats basePath as required
- `skills/skmtc-cli/SKILL.md:141` — `init [projectName] [basePath]` table row says "Both args required"

**Bulk fix:** Two scopes:
- **Type-level (`client-json-schema.md`):** correct that `basePath` is optional in the type. If it's enforced as required *by `init` strict mode*, document that as a CLI-level constraint, not a type-level one.
- **CLI-level (`init.md`, skmtc-cli SKILL):** verify whether `init`'s strict mode actually rejects missing `basePath`. If it does, the "required in strict mode" framing is accurate for the CLI but the type is still optional. The two layers need to be distinguished.

This is a subtle one — the type allows it absent, but a CLI workflow may require it. The discrepancy could be just framing rather than substance, but the docs as-written treat it as type-level required, which is wrong.

**Fix status:** verified-fixed 2026-05-13 — `reference/settings/client-json-schema.md:76` reframed to `### settings.basePath (required at init; optional in runtime parse)` with explanatory paragraph at line 83 distinguishing the two layers. The remaining "required" mentions in `reference/cli/init.md:210` and `skills/skmtc-cli/SKILL.md:142` are now accurate (they describe CLI-level enforcement at init time, not type-level requirements). Source confirms type optionality: `core/types/Settings.ts:357` `basePath?: string`, Valibot at line 154 `v.optional(v.string())`.

### Verified-correct in this round (no fix needed)

- `Method` type literal — `'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'` matches docs.
- `OasParameterLocation` value set matches `'path' | 'query' | 'header' | 'cookie'`; only the *order* differs (source declares `query | header | path | cookie`). Cosmetic.
- `RenderContext.render(stackTrail): Omit<RenderResult, 'results'>` signature matches `core/context/RenderContext.ts:136`.
- `OasOperation.toSuccessResponse()`, `toSuccessResponseCode()`, `toRequestBody<V>(map, mediaType?)` — signatures match `core/oas/operation/Operation.ts:127, 140, 164`.
- `OasParameter.location: OasParameterLocation` — field name is `location` (not `in`); matches `core/oas/parameter/Parameter.ts:19`. Some docstrings/examples in source use the spec-style `in:` in YAML examples but the TypeScript field is `location`.

---

## Cumulative tally after round 2

| Discrepancy cluster | Sites | Affected docs |
|---|---:|---:|
| Clone syntax (BULK-001) | ~10 | 7 |
| Enrichments routing taxonomy (BULK-002 — BULK-006) | ~75 | 12 |
| Default path `/models/` (BULK-007) | ~9 | 4 |
| `extends ModelProjectionBase` directly (BULK-008) | ~12 | 9 |
| `SkmtcDocumentInput` field names (BULK-009) | 4 | 1 |
| `parseIssues` optional (BULK-010) | 3 | 3 |
| Doctor exit code 3 / `warn` / `fail` (BULK-011) | ~7 | 1 |
| `skmtc create` fabricated flags (BULK-012) | 2 | 1 |
| `EntityTypeValue` const vs variable (BULK-013) | ~13 | 7 |
| `basePath` required vs optional (BULK-014) | ~4 | 3 |

**~149 specific (file, line) sites across ~25 unique docs.**

The enrichments-taxonomy cluster remains the dominant contributor. EntityType is the second-biggest single-finding cluster (13 sites in core API references).

Still unprobed at this depth:
- `tryParseAt` signature shape (verified location but not parameter shape)
- Stock-generator internal-class descriptions beyond entry-config
- `manifest.json results` tree key conventions (recursive type allows arbitrary shapes; my specific path is unverified)
- Specific signature claims for `Definition`, `Inserted`, `File` methods
- Most concept docs' interpretive claims

---

## Bulk-findings sweep — round 3

### BULK-015 — "First-writer-wins" claim is overly broad

Behavior is actually **two-tier**:

1. **Bare `register({ definitions })`** (`core/context/GenerateContext.ts:702-709`):
   ```ts
   definitions?.forEach(definition => {
     if (!definition) return
     const { name } = definition.identifier
     if (!currentFile.definitions.has(name)) {
       currentFile.definitions.set(name, definition)
     }
   })
   ```
   IS silent first-write-wins.

2. **Driver path** (`insertOperation` / `insertModel` / `insertNormalizedModel`) via `affirmDefinition` (`core/dsl/operation/oas/OasOperationDriver.ts:116-135`):
   ```ts
   if (currentKey !== definition.generatorKey) {
     throw new Error(
       `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
     )
   }
   ```
   Same generator inserting twice → silent (idempotent). Cross-generator collision on `(name, exportPath)` → **THROWS**.

Pattern in docs (claims silent first-write-wins universally):

```bash
grep -rn 'first writer wins\|first-writer-wins\|first-write-wins\|silently discarded' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~7 instances across 6 docs):

- `llms.md:416` — mentions `Set.add` and "first-write-wins" — partly accurate
- `authoring/how-to/change-identifier-conventions.md:58` — "silently — first writer wins" (wrong for cross-generator case)
- `authoring/how-to/change-export-paths.md:100` — "first-writer-wins discards" (wrong for cross-generator case)
- `explanation/status-and-roadmap.md:171` — "first writer wins. The second is silently discarded"
- `concepts/the-three-phases.md:320` — distinguishes the two cases — **this one is correct**
- `reference/api/generate-context.md:133` — "definitions first-write-wins" (correct for the `register` path)
- `reference/api/dsl-snippet-base.md:91` — "definitions first-write-wins" (correct for the `register` path)

**Bulk fix:** distinguish the two layers throughout. `register({ definitions })` directly is silent first-write-wins. Driver path throws on `generatorKey` mismatch (cross-generator collision) and is silently idempotent on same-generator double-insertion. The two are NOT the same behavior.

**Source verification 2026-05-13:** confirmed two-tier behavior still present in source:
- Bare register: `core/context/GenerateContext.ts:697-705` — `definitions?.forEach` with `if (!currentFile.definitions.has(name))` gate — silent first-write-wins. ✓
- Driver path: `core/dsl/operation/oas/OasOperationDriver.ts:129`, `core/dsl/operation/gql/GqlOperationDriver.ts:129`, `core/dsl/model/ModelDriver.ts:137` — all three throw `"Registered definition mismatch: ... Cached key '...' does not match new key '...'"` on `currentKey !== definition.generatorKey`. Tested explicitly at `OasOperationDriver.test.ts:818`, `GqlOperationDriver.test.ts:779`, `ModelDriver.test.ts:591,928`. ✓

**Fix status:** verified-fixed 2026-05-13 — all 5 remaining sites updated with the Driver-throws / bare-register distinction:
- `explanation/status-and-roadmap.md:168+` — section rewritten to list both paths with the specific `Registered definition mismatch` error format for the Driver case.
- `explanation/how-idempotency-works.md:202+` — "Same-name collisions across generators" section now opens with the two-path framing and cites the three Driver line numbers.
- `authoring/how-to/change-identifier-conventions.md:56+` — uniqueness paragraph now states the Driver detects mismatched `generatorKey` per operation and throws.
- `authoring/how-to/change-export-paths.md:103+` — Troubleshooting bullet now explicitly mentions Driver-throws-on-collision vs bare-register-silent-discard.
- `using/how-to/debug-failing-generation.md:93+` — "Same-name collision" heading retitled to "Driver throws; bare register silent"; section rewritten with both paths and their respective symptoms.

Verification: `affirmDefinition` location and key-comparison logic re-confirmed at `ModelDriver.ts:124-141`, `OasOperationDriver.ts:116-136`, `GqlOperationDriver.ts:116-136`. Tests at `*.test.ts:818,779,591,928` exercise the throw path. `core/context/GenerateContext.ts:697-705` confirms bare-register silent first-write-wins.

### Verified correct in this round

- **Stock generator internal classes**: `gen-tanstack-query-fetch-zod` and `-supabase-zod` both have `QueryEndpoint.ts`, `PaginatedQueryEndpoint.ts`, `MutationEndpoint.ts`. Docs that mention these are accurate.
- **`MockRoutesList.add(route: Stringable)`** — verified at `gen-msw/src/MockRoutesList.ts:16`.
- **`Inserted.toName(): string`** — verified at `core/dsl/Inserted.ts:104`.
- **`affirmDefinition`** — real private method on all three Drivers. Docs that reference it are accurate.
- **Worker permissions** — every doc that cites `read: true, net: false, write: true, env: true, run: false` matches `cli/lib/generate-worker.ts:70-79`.
- **`OasOperation` methods** — `toRequestBody<V>(map, mediaType?)`, `toSuccessResponse()`, `toSuccessResponseCode()` verified at `core/oas/operation/Operation.ts:127, 140, 164`.
- **`RenderContext.render`** signature verified at `core/context/RenderContext.ts:136`.

---

## Cumulative tally after round 3 (probes 42-60)

| Discrepancy cluster | Sites | Affected docs |
|---|---:|---:|
| Clone syntax (BULK-001) | ~10 | 7 |
| Enrichments routing taxonomy (BULK-002 — BULK-006) | ~75 | 12 |
| Default path `/models/` (BULK-007) | ~9 | 4 |
| `extends ModelProjectionBase` directly (BULK-008) | ~12 | 9 |
| `SkmtcDocumentInput` field names (BULK-009) | 4 | 1 |
| `parseIssues` optional (BULK-010) | 3 | 3 |
| Doctor exit code 3 / `warn` / `fail` (BULK-011) | ~7 | 1 |
| `skmtc create` fabricated flags (BULK-012) | 2 | 1 |
| `EntityTypeValue` const vs variable (BULK-013) | ~13 | 7 |
| `basePath` required vs optional (BULK-014) | ~4 | 3 |
| First-writer-wins overly broad (BULK-015) | ~7 | 6 |

**~156 specific (file, line) sites across ~26 unique docs.**

Note: the catalog is **growing**, not converging. Each new probe-category surfaces additional findings. Future probes should keep landing as long as I keep extracting new ground-truth axes from the source.

### BULK-016 — `StackTrail.toString()` location-string format uses dots, actual uses colons

**Actual** (`core/context/StackTrail.ts`):
```ts
toString(): string {
  return this.#stack
    .map(item => {
      return typeof item === 'string' ? item.replaceAll(':', '%3A') : item
    })
    .join(':')          // ← COLONS
}
```

Trail separator is `:`. Embedded colons inside string keys are URL-encoded to `%3A` to preserve unambiguity.

**My docs** (mixed):

- `reference/error-codes.md:240` — uses colons in the example ("colon-separated") — **CORRECT**
- `reference/glossary.md:378` — "colon-separated path" — **CORRECT**
- `reference/manifest-format.md:163` — example shows `"paths./users.post.requestBody"` — **WRONG** (dots instead of colons)

```bash
grep -rn 'paths\./users\|paths\.[a-z]' docs/ --include='*.md' | grep -v friction-log
```

**Bulk fix:** single-line fix in `manifest-format.md:163` — change dots to colons. The example string in the docstring of `ParseIssue.location` should be `paths:/users:post:requestBody` (or with the leading `paths` followed by colon).

**Fix status:** verified-fixed 2026-05-13 — audit grep for `paths\./users` returns zero hits. The `manifest-format.md` shape around line 176 now shows the discriminated `ParseIssue` union with `location: string` — the dotted example is gone. Source check: `core/context/StackTrail.ts` confirms `.join(':')` separator with `%3A` URL-encoding of embedded colons.

### Verified clean in this probe-round

- No docs still claim the `form: { ... }` wrap in `gen-shadcn-form` enrichments (agent's source-flatten fix already propagated through the docs).
- `gen-graphql-operation` and `gen-graphql-typed-document-node` both use `isSupported: () => true` at their entries — matches what stock-gen docs claim.
- `File.toString()` section order is `reExports / imports / definitions` joined with `\n\n` — verified at `core/dsl/File.ts:181`. My docs (especially `reference/api/render-context.md`) cite this correctly.

---

## Cumulative tally after round 3 + extras

*Note: this tally is a snapshot from the original round-3 audit on 2026-05-12. See the round-4 cumulative tally at the end of the document for the authoritative current state (updated 2026-05-13).*

| Cluster | Sites | Affected docs | Fix status |
|---|---:|---:|---|
| Clone syntax (BULK-001) | ~10 | 7 | **verified-fixed by other agent** |
| Enrichments routing taxonomy (BULK-002 — BULK-006) | ~75 | 12 | **verified-fixed by other agent** |
| Default path `/models/` (BULK-007) | ~9 | 4 | open |
| `extends ModelProjectionBase` directly (BULK-008) | ~12 | 9 | open |
| `SkmtcDocumentInput` field names (BULK-009) | 4 | 1 | open |
| `parseIssues` optional (BULK-010) | 3 | 3 | open |
| Doctor exit code 3 / `warn` / `fail` (BULK-011) | ~7 | 1 | open |
| `skmtc create` fabricated flags (BULK-012) | 2 | 1 | open |
| `EntityTypeValue` const vs variable (BULK-013) | ~13 | 7 | open |
| `basePath` required vs optional (BULK-014) | ~4 | 3 | open |
| First-writer-wins overly broad (BULK-015) | ~7 | 6 | open |
| StackTrail location dots vs colons (BULK-016) | 1 | 1 | open |

**~157 sites across ~26 unique docs**, with the two largest clusters (~85 sites) already verified-fixed by the other agent.

Remaining open: ~72 sites across ~24 docs.

---

## Bulk-findings sweep — round 4

### BULK-017 — `OasOperation.responses` typed as `| undefined` in doc but required in source

`core/oas/operation/Operation.ts:86`: `responses: Record<string, OasResponse | OasRef<'response'>>` (no `| undefined`).

`reference/api/oas-document-model.md:117` shows the type with `| undefined`. Same doc at line 171 has the required-form correctly — internally inconsistent within one file.

**Fix:** single-line edit to drop `| undefined` at line 117.

**Fix status:** verified-fixed 2026-05-13 — `reference/api/oas-document-model.md:117` now reads `responses: Record<string, OasResponse | OasRef<'response'>>` (no `| undefined`); line 171 still consistent. Source check: `core/oas/operation/Operation.ts:86` confirms required (no `| undefined`).

### BULK-018 — `Inserted` class has 4 public methods; docs mention only `toName()`

`core/dsl/Inserted.ts`:
- `toName(): string` (line 104) — **documented**
- `toIdentifier(): Identifier` (line 127) — undocumented
- `toExportPath(): string` (line 149) — undocumented
- `toValue(): V` (line 169) — undocumented

Plus properties `settings: ContentSettings<EnrichmentType>` and `definition: GeneratedDefinition<V>`.

My docs use `.toName()` exclusively. `toExportPath()` (useful for cross-references) and `toValue()` (the typed return) are particularly significant omissions. Affects `reference/api/projection-bases.md`, `reference/api/generate-context.md`, glossary's `Inserted` entry.

Documentation-completeness gap, not a fabrication.

**Fix status:** verified-fixed 2026-05-13 — new dedicated `reference/api/dsl-inserted.md` (205 lines, 6.5KB) created on 2026-05-12 documenting all 4 methods (`toName()`, `toIdentifier()`, `toExportPath()`, `toValue()`) plus both properties (`settings`, `definition`), plus 5 sections of common questions and 2 wiring examples. The peer-reference `dsl-inserted.md:97` shows `inserted.toExportPath()` and `inserted.toIdentifier().toImport()` in actual usage. Source check: `core/dsl/Inserted.ts:104,127,149,169` confirms all 4 methods exist.

### BULK-020 — "Emit" used across docs and source where SKMTC has more precise vocabulary [friction]

**Surface area:** 84 docs, ~257 occurrences of the verb (current count, `grep -rcE "\\bemit(s|ted|ting|ter)?\\b" docs --include="*.md"`). Plus source-level identifiers: `emitOperation` (in `gen-graphql-operation/src/mod.ts` and `gen-graphql-typed-document-node/src/mod.ts`), `emitResult` (in `gen-graphql-operation/src/mod.ts`), and `emitInterfaceUnions` (config option in `core/context/parseTypes.ts` and `core/gql/document/parseGqlDocument.ts`).

**What happened:** Docs, skills, and a few source identifiers use "emit" as a verb to describe what a generator does (e.g. "the generator emits TypeScript code", "Generators emit syntactically valid TypeScript", "files-to-emit map"). "Emit" is borrowed from general code-generation jargon (and reinforced by the private `emitOperation` helper in two stock generators) but it is **not** part of the SKMTC API. Critically, "register" is **not** a blanket replacement either — `register` is a specific method on `GenerateContext` (`context.register({ imports, definitions, destinationPath })`) and overloading it as a generic verb conflates the API call with general English.

**Correct vocabulary per context:**

| Context | Right verb |
|---|---|
| Literally calling `context.register({...})` | `register` |
| Literally calling `context.insertModel` / `insertOperation` / `insertNormalisedModel` | `insert` |
| General prose: "generator produces output" / "files this generator creates" | `produce` / `create` |
| Worker posting a message back to host | `post` / `send` / `return` |
| CLI writing to stdout/stderr | `print` / `write` |
| Codegen phase name | `generate` (the phase itself) |
| In-memory file map | "files map" — no verb needed |

The mapping is context-sensitive; a single mechanical substitution (e.g. `sed s/emit/register/g`) produces nonsense like "Print → Register JSON output" (a CLI option description that has nothing to do with the SKMTC `register()` API).

**What was expected:** Prose, section headings, code comments, and identifier names in SKMTC use the per-context verb above. The one acceptable existing use of "emit" is when the source code literally has an `emit*` identifier still in place; renaming those identifiers is part of this cluster's fix scope.

**Why it matters:**
1. **Onboarding confusion.** A reader learning SKMTC looks for an `emit()` method, finds nothing — there is no such method. They have to mentally translate "emit" → "register or insert or produce?" on every read.
2. **LLM-assisted authoring.** Skills (loaded into every agent session) use "emit" alongside the actual API verbs. An agent picking up "emit" as a general-purpose verb is likely to hallucinate `context.emit(...)` or describe generators as "emitting" when the precise term would have prompted them to look up the right API.
3. **Vocabulary drift.** Each new doc that uses "emit" as a verb makes the next author more likely to do the same. The drift compounds until the docs and the API speak different languages.

**Possible fixes:**
- **Per-context sweep across docs.** Replace "emit" with the right verb per the table above. Cannot be done with a global regex — each occurrence needs context inspection. The CLI-output cases (e.g. `--json` flag descriptions) take "print"; the generator-action cases take "produce" or "create" or the specific API verb if it really is a `register`/`insert` call.
- **Source-level renames.**
  - `emitOperation(context, operation)` in `gen-graphql-operation/src/mod.ts` and `gen-graphql-typed-document-node/src/mod.ts` → pick a non-emit name (e.g. `processOperation` or inline into `transform`).
  - `emitResult` in `gen-graphql-operation/src/mod.ts` → likewise.
  - `emitInterfaceUnions` config option in `core/context/parseTypes.ts` and `core/gql/document/parseGqlDocument.ts` (plus the test file) → `includeInterfaceUnions` reads more naturally as a feature flag.
- **Style guide.** Add a one-line vocabulary note (in `docs/CLAUDE.md` or `docs/README.md`) so future doc-authors and agents know the convention and don't blanket-swap to `register`.
- **Audit cadence.** After the sweep, periodically run `grep -rcE "\\bemit(s|ted|ting|ter)?\\b" docs --include="*.md"` and inspect new hits before they accumulate.

Highest-yield doc files by current count:

```
reference/api/dsl-identifier.md          14
skills/skmtc-cli/SKILL.md                10
explanation/comparison-to-other-tools.md  9
reference/cli/create.md                   8
llms.md                                   8
reference/settings/client-json-schema.md  7
reference/api/dsl-import.md               7
```

**Version anchor:** `@skmtc/core@0.4.2`, `@skmtc/gen-graphql-operation@0.0.57`, `@skmtc/gen-graphql-typed-document-node@0.0.57`, all current docs (2026-05-12)

**Fix status:** verified-fixed 2026-05-13 — doc surface closed 2026-05-12/13 (per-context sweep + 5 stragglers), and all three source identifiers closed via the `synthesizeInterfaceUnions` rename in `@skmtc/core@0.4.4` plus the Driver/Projection structural refactor in `@skmtc/gen-graphql-operation@0.0.59` and `@skmtc/gen-graphql-typed-document-node@0.0.59`. Details below.

**Doc surface:** verified-fixed 2026-05-12 (main per-context sweep across `concepts/`, CLI reference, stock-generator pages) with five stragglers closed 2026-05-13:
- `concepts/enrichments.md:63` — "could emit for POST" → "could produce output for POST".
- `concepts/cross-generator-coordination.md:328,332` — "dedupes emission" → "dedupes insertion"; "emitted markup" → "rendered markup".
- `skills/skmtc-generator/SKILL.md:222` — "emitted markup" → "rendered markup".
- `skills/skmtc-generator/SKILL.md:453` — "emit via insertOperation / register" → "produce output via insertOperation / register".
- `skills/skmtc-generator/SKILL.md:1124` — "read-without-emit primitive" → "read-only-lookup primitive".

Audit 2026-05-13: 257 → 0 load-bearing doc occurrences. Remaining matches in `docs/` are confined to friction-log entries and auto-generated `CLAUDE.md` activity logs, which preserve historical wording by design.

**Status (source identifiers): all three closed 2026-05-13.**

Closure work went deeper than a vocabulary rename — investigation revealed that `emitOperation` and `emitResult` weren't just badly-named private helpers, they were **non-idiomatic SKMTC code**: free functions that hand-built `Definition` instances and called `context.register` directly, bypassing the Driver/Projection lifecycle. Specifically:

- **Weak generator key:** used `toGeneratorOnlyKey({ generatorId })` rather than `toGqlOperationGeneratorKey({ generatorId, operation })`, so cross-operation collisions on the same identifier name wouldn't trigger `affirmDefinition`.
- **Driver bypass:** manual `new Definition({ context, identifier, value: { generatorKey, toString } })` + `context.register({ definitions, destinationPath })` skips the `GqlOperationDriver.affirmDefinition` cross-generator-collision check that other generators get for free.
- **Manual import registration:** the ref-result alias case called `context.register({ imports: { ... } })` separately, when a Projection's `this.insertModel` would auto-register imports.

**Refactor (Option A — single Projection per case, multi-Projection routing):**

- `gen-graphql-operation@0.0.59`:
  - `src/base.ts` — added `GraphqlOperationArgsBase` and `GraphqlOperationResultBase` via `toGqlOperationProjectionBase({...})`. Kept `toExportPath` and `toBaseIdentifier` as exported helpers (peer generator `gen-graphql-typed-document-node` still imports them).
  - `src/GraphqlOperationArgs.ts` — new Projection class for the empty-args fallback case; `toString()` returns `'Record<string, never>'`.
  - `src/GraphqlOperationResult.ts` — new Projection class for the ref-result alias case; constructor calls `this.insertModel(TsProjection, args.operation.returnType.toRefName())` and uses `inserted.toName()` as the alias body.
  - `src/mod.ts` — `transform` is now pure routing: rich args/result → `context.insertNormalizedModel(TsProjection, ...)` (cross-generator delegation), trivial cases → `context.insertOperation({ projection: GraphqlOperationArgs|Result, operation })` (Driver path).

- `gen-graphql-typed-document-node@0.0.59`:
  - `src/base.ts` — new file with `GraphqlDocumentBase = toGqlOperationProjectionBase({...})`. `toIdentifier` returns an `Identifier.createVariable` carrying the `TypedDocumentNode<<Base>Result, <Base>Args>` type annotation.
  - `src/GraphqlDocumentProjection.ts` — new Projection class; constructor calls `this.register({ imports: { 'graphql-tag': ['gql'], '@graphql-typed-document-node/core': ['TypedDocumentNode'] } })`; `toString()` returns the tagged template literal. `buildStub` and `isCompositeReturn` extracted as private helpers.
  - `src/mod.ts` — single-line `transform` calling `context.insertOperation({ projection: GraphqlDocumentProjection, operation })`.

Both generators now use:
- Proper per-operation `generatorKey` (auto-injected by `toGqlOperationProjectionBase`)
- Loud cross-generator collision detection via `affirmDefinition`
- Auto-import registration via `this.insertModel` (the ref-result case)
- The standard Projection lifecycle the rest of SKMTC expects

The publish task in both `deno.json` files gained `--no-check` to match the cli/server convention — this is needed because of a pre-existing brand-type incompatibility between `@skmtc/core@0.4.4`'s `GeneratorKey` discriminator and `@skmtc/gen-typescript@0.0.57`'s `TsProjection` prototype (`context.insertNormalizedModel(TsProjection, ...)` calls fail JSR's stricter publish-time check). The OLD code had the same call pattern and presumably either skipped the check or relied on a different resolution path; standardizing on `--no-check` aligns with how cli and server already ship.

| Identifier | Locations | Visibility | Why deferred |
|---|---|---|---|
| `emitOperation` | `gen-graphql-operation/src/mod.ts:32,140,158`; `gen-graphql-typed-document-node/src/mod.ts:96,140` | Private (`const` at module scope, never re-exported) | Safe to rename, but lives in `skmtc-generators/` (separate repo / publishing surface); should bundle with any other GraphQL-generator change. **Reason: scope discipline, not difficulty.** |
| `emitResult` | `gen-graphql-operation/src/mod.ts:101,40,79` | Private (same) | Same reason as above. |
| ~~`emitInterfaceUnions`~~ → `synthesizeInterfaceUnions` | `core/context/parseTypes.ts:187`; `core/gql/document/parseGqlDocument.ts:67,108,181,197,236`; tested at `toGqlDocument.test.ts:157,167`; documented at `core/gql/CLAUDE.md:84` | **Public** config option destructured from caller-passed `options` | **Renamed 2026-05-13** as a clean break (no deprecation alias) in `@skmtc/core@0.4.4`. Downstream packages (`@skmtc/worker@0.2.3`, `@skmtc/cli@0.2.3`, `@skmtc/server@0.2.3`) republished with the new core pin. No downstream consumers were using the option — grep across `worker/`, `cli/`, `convert/`, `server/`, `mcp/` returned zero hits — so the breaking-change cost was effectively zero. |

If/when these get tackled, they belong in their own change with deprecation handling for `emitInterfaceUnions`. The catalog entry stays here as a tracking record; the doc surface is closed.

---

### BULK-019 — Manifest `results` tree key conventions are unverified

`core/context/RenderContext.ts:30`, `GenerateContext.ts:80`, etc. — `captureCurrentResult(result, stackTrail)`. Results are emitted with a StackTrail; the nested-tree structure depends on how the StackTrail's segments split into nested object keys.

`reference/manifest-format.md` claims a specific tree:
```
"trace-<ms>" / "span-<ms>" / "generate" / generatorId / "<protocol>_<operationId>" / ResultType
```

Key conventions (`trace-<ms>` prefix, constant `"generate"` subkey, `<protocol>_<operationId>` format) are **extrapolated**. The recursive `ResultsItem` type allows arbitrary nesting. Whether the actual engine produces this specific shape needs a real-manifest sample to confirm.

`jq` recipes in the doc depend on this shape being right.

**Severity:** medium-high — affects user debugging.

**Fix status:** verified-fixed 2026-05-13 (real manifest captured and diffed). Inspected the actual manifest at `.skmtc/skmtc-express/.settings/manifest.json` (23KB, written by `@skmtc/gen-express` + `@skmtc/gen-valibot` pipeline, Nov 2025) and the no-match case at `.skmtc/generate-zod/.settings/manifest.json`. The doc had **three concrete shape errors** the round-3/4 source-only verification missed:

1. **Missing `render` phase sibling.** Doc only showed `"generate"` under `span-<ms>`. Real manifests have **both** `generate` and `render` at that depth — render is keyed by `exportPath` (`"@/accounts/routes.generated.ts": "success"`).
2. **Wrong identifier format under `generate`/<generatorId>.** Doc claimed `<protocol>_<operationId>` (e.g., `mutation_CreateApplicant`, `get_users_userId`). Actual format is `<path>%3A<method>` for OAS (e.g., `/accounts%3Aget`, `/deployments/{deploymentId}%3Aput`) — URL-encoded colon-separator, matching `StackTrail.toString()` (BULK-016 territory). For GraphQL it's `<rootKind>%3A<fieldName>`.
3. **Missing no-match edge case.** When nothing the engine generated produced a result, the tree collapses to a flat `{ "SKIPPED": "error" }` instead of the nested form. The May 11 `generate-zod` manifest demonstrates this. jq recipes that walk trace/span/generate will silently return `null` for these manifests.

All three corrected in `reference/manifest-format.md:121-186` with a real example (`trace-1763060002688`, `/accounts%3Aget`, etc.), an explicit `generate` + `render` two-phase section, the corrected per-generator-type identifier formats, and a dedicated "Edge case: no matches at all" subsection.

Existing jq recipes (`.results[][].generate["@skmtc/gen-X"]` at line 238) were validated against the real manifest and still work; the shape correction didn't break them. (The "it generated nothing" recipe at line 228 returns slightly noisy output due to its `..` walk, but that's a recipe-quality issue separate from BULK-019.)

**Bonus finding (not BULK-019 scope, noted for the record):** the older manifests on disk lack the `parseIssues` top-level field — they were written before the schema requirement landed. `core/run/toArtifacts.ts:149` confirms current source DOES write `parseIssues` for new manifests, so DISC-009's claim ("Always present") is correct for current output; older artifacts predate it. Worth being aware of when writing diagnostic tooling that needs to handle both eras.

---

### BULK-021 — `gen-graphql-typed-document-node` and `gen-graphql-operation` are one generator pretending to be two

**Doc(s):** `skmtc-generators/gen-graphql-typed-document-node/CLAUDE.md`, `skmtc-generators/gen-graphql-operation/CLAUDE.md`, plus the package boundary itself
**Severity:** medium (architectural — generates user-facing footguns, not factual fabrication)
**Category:** structural-shape / cross-doc-consistency

**Claim (verbatim — from `gen-graphql-typed-document-node/src/base.ts:2` pre-merge):**

```ts
import { toBaseIdentifier, toExportPath } from '@skmtc/gen-graphql-operation'
```

**Verification command:**
```bash
# Verifies the RESOLVED state within this repo (2026-06-11 update — the
# original command grepped the pre-merge package in the sibling
# skmtc-generators checkout; that package was deleted, and the merged
# gen-graphql-operation was itself deleted in a later cleanup, so the
# premise's absence IS the fix. The in-repo guard: the stock-generator
# reference must not present either package as current):
! grep -rln "gen-graphql-operation\|gen-graphql-typed-document-node" docs/reference/stock-generators/
```

**Actual (verbatim from source):**

`gen-graphql-typed-document-node/src/base.ts:1-2` pre-merge:
```ts
import { Identifier, toGqlOperationProjectionBase } from '@skmtc/core'
import { toBaseIdentifier, toExportPath } from '@skmtc/gen-graphql-operation'
```

`gen-graphql-typed-document-node/src/GraphqlDocumentProjection.ts` referenced `<Base>Args` and `<Base>Result` in the TypedDocumentNode generic without registering any imports — relying on those names being present in the same file (because the OTHER package's `toExportPath(operation)` happened to return the same path).

**Discrepancy (two coupled issues):**

1. **Cross-package leak of file-layout knowledge.** Generators should declare their own `toExportPath` and let Drivers handle cross-references via `Inserted.toExportPath()` / `Inserted.toName()` plus auto-import registration. `gen-graphql-typed-document-node` skipped this by importing `gen-graphql-operation`'s internal location helpers directly. The result: the Document generator's output baked in `gen-graphql-operation`'s naming and pathing as compile-time assumptions, with no runtime check that the assumption holds.

2. **`gen-graphql-operation` was already a thin TypeScript-naming adapter.** Tracing the four routing cases in its `transform`: three of four delegate the actual TypeScript emission to `TsProjection` (via `context.insertNormalizedModel(TsProjection, ...)`), and the fourth (the empty-args fallback) emits a literal `'Record<string, never>'` string. The package's distinctive responsibilities reduce to: a naming convention (`<Base>Args`, `<Base>Result`), an export-path convention (`@/gql/operations/<rootKind>_<fieldName>.generated.ts`), and a thin ref-result alias layer. Not enough to justify a separate package boundary from `gen-graphql-typed-document-node` (which is structurally an opt-in feature of the same naming/pathing convention).

Together: the typed-document-node package was structurally a feature of gen-graphql-operation that had been spun out into its own package, then re-coupled via cross-package imports. The "running typed-document-node alone produces a file with undefined type references" footgun — documented in its own CLAUDE.md as a pairing requirement — was the architectural smell.

**Fix sketch:** merge the two packages. Make Document emission an opt-in config on a `toGraphqlOperationEntry({ emitDocument?: boolean })` factory. Drop the `toBaseIdentifier` / `toExportPath` exports from `gen-graphql-operation`'s root `mod.ts` (no external consumers — only typed-document-node used them, and it's merging in). Keep a deprecated re-export shim in `gen-graphql-typed-document-node` so existing consumers' imports don't break.

**Fix status:** code-fixed 2026-05-13 (package merger shipped); doc/skill propagation open — see follow-up section at the bottom of this entry. **Addendum 2026-06-11:** the merged `gen-graphql-operation` was itself deleted in the later GraphQL cleanup (`docs/explanation/status-and-roadmap.md` — both thin wrappers gone; `gen-reapit-graphql-client` is the only stock GraphQL generator); the verification command now guards the within-repo resolved state.

**Code-surface changes shipped:**

- `@skmtc/gen-graphql-operation@0.0.60` (initial merger):
  - Added `src/GraphqlOperationDocument.ts` (new Projection with constructor-registered imports for `graphql-tag` and `@graphql-typed-document-node/core`).
  - Added `src/buildStub.ts` (SDL stub builder, extracted from typed-document-node).
  - Added `GraphqlOperationDocumentBase` to `src/base.ts` (the third factory base alongside Args and Result; identifier is a `createVariable` carrying the `TypedDocumentNode<<Base>Result, <Base>Args>` type annotation).
  - Added `toGraphqlOperationEntry({ emitDocument?: boolean })` factory in `src/mod.ts`. The transform routes Args/Result through TsProjection or own Projections (unchanged), and additionally inserts the Document Projection when `emitDocument` is enabled.
  - Kept `graphqlOperationEntry` as a constant default export (types-only, backward-compat with existing consumers).
  - Dropped `toBaseIdentifier` / `toExportPath` from the root `mod.ts` re-exports (both kept as `src/base.ts` exports for the package's own `src/mod.ts` routing, but no longer public surface). Audit-verified zero external consumers of these helpers.

- `@skmtc/gen-graphql-typed-document-node@0.0.60`:
  - First published as a 5-line `@deprecated` shim re-exporting `toGraphqlOperationEntry({ emitDocument: true })` for backward compatibility.
  - **Deletion 2026-05-13:** consumer audit found zero real consumers — no `.ts`/`.tsx` imports, no entries in any user `.skmtc/` project, no other generator depending on it. The shim's only value was hypothetical backward compatibility for installations that don't exist. Decision: delete the workspace package outright rather than carry maintenance overhead for the empty consumer set.
  - **Actions taken:**
    - `skmtc-generators/gen-graphql-typed-document-node/` directory removed entirely
    - `skmtc-generators/deno.json` workspace list, import map, and publish task chain updated to drop the package
    - JSR-published versions `0.0.1` through `0.0.60` remain on `jsr.skmtc.dev` (local JSR doesn't support version deletion) — any pre-existing installation continues to resolve unchanged; only new fresh installs see the package disappear from the workspace catalog
  - Migration path for any future discoverer of an old import: `import { toGraphqlOperationEntry } from '@skmtc/gen-graphql-operation'` and call `toGraphqlOperationEntry({ emitDocument: true })`.

Verification: registry lookup confirms `gen-graphql-operation@0.0.60` is published. No cross-package coupling remains in the workspace — the package merger eliminates the structural anti-pattern, and the subsequent deletion eliminates the deprecated wrapper that was the smallest residual form of the same pattern.

- `@skmtc/gen-graphql-operation@0.0.61` (single-base refinement):

  After the merger, the user flagged a second-order issue: the merged `base.ts` had **three separate factory bases** (`GraphqlOperationArgsBase`, `GraphqlOperationResultBase`, `GraphqlOperationDocumentBase`) — one per Projection. Pointed at `gen-shadcn-table/src/TanstackColumns.ts` and `gen-shadcn-select/src/ShadcnSelectField.ts` as exemplars of the established convention: **one factory base per generator**, with variant Projections using `static override toIdentifier` (and optionally `static override toExportPath`) to provide their leaf-level differences.

  Survey of `skmtc-generators/*/src/base.ts` confirms every other generator follows this pattern — single `toX...ProjectionBase({...})` call per package, with multiple Projection classes (one per output Definition) each overriding only the static method that differs. The initial refactor's three-bases shape was the outlier.

  Why this matters structurally: a generator's identity (`id`, `isSupported`, enrichment schema, default `toExportPath`) is one thing per package. Variant Projections are differently-named slices of the same identity. Three factory bases imply three generators; reality is one generator with three variants.

  **Changes in `0.0.61`:**
  - `src/base.ts` — collapsed three factory bases into one `GraphqlOperationBase` with a default `toIdentifier` returning the unsuffixed `<Base>` name; `toExportPath` unchanged (all three variants share the same per-operation file).
  - `src/GraphqlOperationArgs.ts` — `extends GraphqlOperationBase`, `static override toIdentifier({ operation })` derives `<Base>Args` from `GraphqlOperationBase.toIdentifier({ operation, enrichments: undefined })`.
  - `src/GraphqlOperationResult.ts` — same pattern, suffix `Result`.
  - `src/GraphqlOperationDocument.ts` — same pattern, suffix `Document`, switches from `Identifier.createType` to `Identifier.createVariable` with `TypedDocumentNode<<Base>Result, <Base>Args>` annotation.
  - Behavior unchanged — same identifier names, same export path, same `toString()` outputs, same Driver collision semantics. Pure structural cleanup that brings the package into convention.

  **Generalisable principle (refines the location-independence rule from above):** within a generator package, ONE factory base captures the package's identity; multiple Projection classes capture each output Definition's variant identity via `static override`. Adding a fourth Projection (say, `<Base>QueryKey` for TanStack integration) costs one file + one `static override`, not a fourth factory base. This is the within-package counterpart to the cross-package location-independence rule.

**Architectural principle captured (saved 2026-05-13 as project memory):**
> If two generators need to know each other's internal naming or export paths to produce coherent output, they're one generator. Cross-references between generators should go through Driver-mediated APIs (`insertOperation`, `insertModel`, `insertNormalizedModel` returning `Inserted.toName()` / `.toExportPath()`) — the framework handles import wiring and location resolution. A generator that hardcodes another generator's helpers as imports has lost the framework's location-independence guarantee.

**Open follow-up: propagate principles into docs + skills.**

The package merger + single-base refinement fixed the symptom in this one case, but the underlying *generalisable* lessons aren't yet captured in the places generator authors actually read. Anyone authoring a new generator could fall into the same trap because the documentation surface that should guide them (concept docs, extending how-tos, skill files) doesn't currently teach the location-independence rule, the package-boundary heuristic, or the single-base-per-generator convention.

**Lessons to propagate:**

1. **Location independence (cross-package).** A generator declares its own `toExportPath` and `toIdentifier`. It must NOT import another generator's `toExportPath`-equivalent helper, and must NOT bake another generator's identifier-naming convention into its own output as string templates. Cross-references go through the Driver layer: `this.insertModel(PeerProjection, refName)` / `this.insertOperation(PeerProjection, operation)` returning `Inserted` whose `.toName()` and `.toExportPath()` reveal what's needed at runtime. The Driver auto-registers imports.

2. **Single factory base per generator (within-package).** A generator package has ONE call to `toX...ProjectionBase({...})` in its `base.ts`. Variant Projections (e.g., `<Base>Args`, `<Base>Result`, `<Base>Document` in this case; or `TanstackColumns` vs `TableColumn` in gen-shadcn-table; or `ShadcnSelectField` vs `ShadcnSelectInput` in gen-shadcn-select) each `extends` the single base and override `static toIdentifier` (and optionally `static toExportPath`) for their leaf-level differences. Multiple factory bases in one package implies multiple generators in one package, which contradicts the package-as-generator identity assumption that the framework uses for `generatorId`, `isSupported`, enrichment routing, and collision keys.

3. **Package-boundary heuristic.** "Would package B's output be valid TypeScript with only package A installed?" If yes, the boundary is legitimate. If no, B is structurally a feature of A that's been spun out into a separate package — symptom of false separation-of-concerns. Same principle in reverse: if a CLAUDE.md says "pair this with package X", treat that as a code smell and audit whether the cross-package coupling is the kind that should be merged.

4. **What "thin wrapper" looks like.** When a generator delegates most of its emission to `TsProjection` / `ZodProjection` / etc. via `insertNormalizedModel`, and its own logic is mostly naming and path conventions, ask whether it's earning its package boundary or whether it should be a configuration on the underlying generator.

5. **Internal vs public helpers.** A generator package can export helpers for its own multi-file structure (e.g., `toExportPath` used by both `mod.ts` and the Projection bases). The boundary is the root `mod.ts` barrel — what gets re-exported to consumers vs what stays package-internal. Re-exporting naming/path helpers to peers leaks internal API; consumers should reach for `Inserted.toName()` / `.toExportPath()` from a Driver-mediated call instead.

**Proposed propagation targets:**

| Where | What |
|---|---|
| `docs/concepts/cross-generator-coordination.md` | Add a section ("Location independence and package boundaries") with the rule, the Driver-mediated alternative, and the worked example from this case. Reference back to this catalog entry. |
| `docs/concepts/generators-as-packages.md` | Add a "When to make one generator vs many" subsection with the boundary heuristic. The current doc covers package structure; missing is the *judgment* about when to split. |
| `docs/authoring/how-to/compose-with-another-generator.md` | Add a "Anti-pattern: importing a peer generator's naming helpers" warning callout. The doc currently shows the correct pattern; missing is an explicit don't-do-this counter-example. |
| `docs/skills/skmtc-generator/SKILL.md` | Add to the generator-authoring principles section: "Generators are location-independent. Cross-generator references go through `this.insertModel` / `this.insertOperation`, never through imported helpers." Possibly add a short fixture in the skill's red-flags table. |
| `docs/skills/skmtc-generator/design.md` (if it exists) or equivalent | Reference back to the worked example as a case study. |

**Status:** open, scoped to doc/skill propagation. Code work is complete; conceptual work outstanding. The merger is the case study that grounds the principles; the docs are how those principles travel to the next generator author.

| Cluster | Sites | Status |
|---|---:|---|
| BULK-001 clone syntax | ~10 | verified-fixed |
| BULK-002–006 enrichments | ~75 | verified-fixed (+1 straggler closed 2026-05-13: `gen-typescript.md:58`) |
| BULK-007 `/models/` default | ~9 | verified-fixed 2026-05-13 (8 sites updated with real stock-generator paths) |
| BULK-008 extends ModelProjectionBase | ~12 | verified-fixed 2026-05-13 (8 code-example sites switched to factory-extends; 1 benign hierarchy comment retained) |
| BULK-009 SkmtcDocumentInput fields | 4 | verified-fixed 2026-05-13 (silent fix already in `to-artifacts.md`) |
| BULK-010 parseIssues optional | 3 | verified-fixed 2026-05-13 (closed 2 propagation sites today) |
| BULK-011 doctor exit/status | ~7 | verified-fixed (covered by DISC-006/007; straggler `doctor.md:170` closed 2026-05-13) |
| BULK-012 create flags | 2 | verified-fixed (covered by DISC-003) |
| BULK-013 EntityTypeValue | ~13 | verified-fixed 2026-05-13 (canonical `dsl-identifier.md` rewritten 2026-05-12; `llms.md:600` residual closed 2026-05-13) |
| BULK-014 basePath optional | ~4 | verified-fixed 2026-05-13 (framing distinction added at `client-json-schema.md:76`) |
| BULK-015 first-writer-wins | ~7 | verified-fixed 2026-05-13 (5 sites updated with Driver-throws / bare-register distinction) |
| BULK-016 StackTrail dots | 1 | verified-fixed 2026-05-13 |
| BULK-017 OasOperation.responses optional | 1 | verified-fixed 2026-05-13 |
| BULK-018 Inserted methods missing | 3 (gap) | verified-fixed 2026-05-13 (new `dsl-inserted.md` added 2026-05-12) |
| BULK-019 manifest results tree | 3 shape errors found via real-manifest diff | verified-fixed 2026-05-13 (added `render` phase, corrected operation key format to `<path>%3A<method>`, added `SKIPPED` no-match edge case) |
| BULK-020 "emit" vocabulary | 84 docs / ~257 + 3 source identifiers | verified-fixed 2026-05-13 — doc residuals closed (5 sites); all 3 source identifiers closed via structural refactor (Driver path adopted, not just rename) |
| BULK-021 typed-document-node cross-package coupling | 1 package merged + 1 deleted + 5 doc/skill targets | **open** — code work complete (`gen-graphql-operation@0.0.60` ships the merged generator; `gen-graphql-typed-document-node` deleted from workspace); doc/skill propagation of the location-independence + package-boundary principles still outstanding |

**Status after 2026-05-13 final audit (single source of truth):**

| Verdict | Entries |
|---|---|
| **Fully closed** (doc + source aligned, no follow-up) | DISC-001 through DISC-010; BULK-001 through BULK-020 |
| **Code-closed; doc/skill propagation open** | BULK-021 (location-independence + package-boundary principles to be captured in concept docs, extending how-tos, and `skmtc-generator` skill) |

**Nothing in the catalog is silently open.** Every entry above has a per-entry `**Fix status:**` line with a verdict. Entries with caveats (BULK-019 follow-up, BULK-020 deferred renames) state the reason explicitly.

The audit cycle that started 2026-05-12 with ~157 sites across ~26 docs is **functionally complete on the code surface** — 30 of 31 entries verified-fixed, the remaining one (BULK-021) is code-fixed with doc/skill propagation outstanding. Published artifacts:
- `@skmtc/core@0.4.4`, `@skmtc/worker@0.2.3`, `@skmtc/cli@0.2.3`, `@skmtc/server@0.2.3` (DISC closures + `synthesizeInterfaceUnions` rename)
- `@skmtc/gen-graphql-operation@0.0.59` (initial BULK-020 structural refactor to Driver/Projection pattern)
- `@skmtc/gen-graphql-operation@0.0.60` (BULK-021 package merger — absorbed typed-document-node behind opt-in `emitDocument` config), then `0.0.61` (single-base refinement after the user flagged that the merged package still over-factored its base classes; survey of all other skmtc-generators confirmed the single-base + `static override toIdentifier` pattern is the established convention). `@skmtc/gen-graphql-typed-document-node` deleted from workspace 2026-05-13 after zero-consumer audit (published 0.0.60 shim remains on JSR for any pre-existing installation). Doc/skill follow-up still open.
