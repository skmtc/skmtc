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

**Tier 1 progress:**

- [ ] `reference/cli/overview.md`
- [ ] `reference/cli/init.md`
- [ ] `reference/cli/create.md`
- [ ] `reference/cli/clone.md`
- [ ] `reference/cli/install.md`
- [ ] `reference/cli/list.md`
- [ ] `reference/cli/remove.md`
- [ ] `reference/cli/generate.md`
- [ ] `reference/cli/bundle.md`
- [ ] `reference/cli/dev.md`
- [ ] `reference/cli/doctor.md`
- [ ] `reference/cli/agent-context.md`
- [ ] `using/tutorials/*` (CLI syntax in tutorials)
- [ ] `using/how-to/*` (CLI syntax in how-tos)
- [ ] `using/recipes/*` (CLI syntax in recipes)
- [ ] `extending/tutorials/*`
- [ ] `extending/how-to/*`
- [ ] `extending/recipes/*`
- [ ] `reference/settings/*`

---

## Entries

---

### DISC-001: Enrichment routing key path is wrong across all docs

**Doc(s):** `concepts/enrichments.md`, `reference/settings/enrichments-shape.md`, `reference/settings/client-json-schema.md`, `using/how-to/configure-enrichments.md`, `using/tutorials/03-customize-with-enrichments.md`, `extending/how-to/add-enrichment-options.md`, plus multiple recipe docs and 2 glossary entries
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
grep -n "enrichments\." core/dsl/operation/oas/toOasOperationProjectionBase.ts core/dsl/model/toModelProjectionBase.ts core/dsl/operation/gql/toGqlOperationProjectionBase.ts
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

**Fix status:** verified-fixed 2026-05-12 — rewrote `reference/settings/enrichments-shape.md`, `concepts/enrichments.md`, `using/how-to/configure-enrichments.md`, `using/tutorials/03-customize-with-enrichments.md`, `extending/how-to/add-enrichment-options.md`, `reference/settings/client-json-schema.md`, `reference/glossary.md` (dropped "Projection key" and "Projection kind"), `reference/api/content-settings.md`, `llms.md`, `skills/skmtc-cli/SKILL.md`, `skills/skmtc-cli/design.md`, `skills/skmtc-generator/SKILL.md`, `reference/stock-generators/gen-shadcn-form.md`, `extending/recipes/design-system-across-many-apis.md`. Also flattened `gen-shadcn-form/src/enrichments.ts` to drop the `form: { ... }` wrap so the schema's root IS the payload directly (consumer reads `this.settings.enrichments?.title` instead of `this.settings.enrichments?.form?.title`).

---

### DISC-002: `skmtc clone` syntax — generators are a `-g` flag, not positional args

**Doc(s):** `extending/tutorials/01-cloning-a-generator.md`, `extending/recipes/design-system-across-many-apis.md`, `extending/recipes/custom-form-field-renderer.md`, `using/recipes/multi-project-monorepo.md`, plus several how-to docs that show cloning in passing
**Severity:** high
**Category:** cli-flag

**Claim (verbatim — from `extending/tutorials/01-cloning-a-generator.md`):**

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

**Fix status:** verified-fixed 2026-05-12 — corrected syntax in `extending/tutorials/01-cloning-a-generator.md`, `extending/recipes/design-system-across-many-apis.md`, `extending/recipes/custom-form-field-renderer.md`, `concepts/clone-vs-install.md`, `concepts/generators-as-packages.md`, `README.md`, `llms.md` (two places). Final grep for `skmtc clone @skmtc` returns no hits outside friction-log.

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

**Doc(s):** `reference/cli/create.md`, `extending/tutorials/02-authoring-a-model-generator.md`, `extending/tutorials/03-authoring-an-operation-generator.md`
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

**Fix sketch (NOT YET APPLIED):** rewrite the scaffold tree per actual filenames. Verify and document the top-level `deno.json` scaffolding separately. Update `extending/tutorials/02` and `03` to match.

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/create.md` now shows the two distinct scaffold trees (model vs operation, with the `<MainModule>Projection.ts` vs `<MainModule>.ts` asymmetry called out) and notes `enrichments.ts` is not scaffolded; also documents the top-level `deno.json` and `mod.ts` written by `Generator.createFiles`. `extending/tutorials/02-authoring-a-model-generator.md` rewritten to extend `SchemaMetaBase = toModelProjectionBase({...})` rather than the abstract `ModelProjectionBase` directly, and to resolve the schema inside the constructor via `context.resolveSchemaRefOnce(refName, baseId)` instead of accessing `this.schema`. `extending/tutorials/03-authoring-an-operation-generator.md` rewritten with the same factory-extends pattern and the enrichment example flattened (no wrapper key) to match the DISC-001 flattened convention.

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

**Fix status:** verified-fixed 2026-05-12 — `reference/cli/doctor.md` status list now reads `ok` / `warning` / `error` / `skipped` (4 values, matching `CheckStatus`); JSON example rewritten to match the actual `DoctorResult`/`Check` shape (`skmtcRootPath`, `globalStateDir`, `cliVersion`, `projects`, `checks: { id, status, message, hint?, data? }`, top-level `summary: CheckStatus`); CI example rewritten to read `.summary` rather than the fabricated `.summary.fail`. Followup not in DISC-007 scope: the workspace/project check-ID tables in `doctor.md` still describe a fictional check set; the actual checks are `shim-lockfile`, `project-deno-json/<n>`, `project-base-path/<n>`, `project-core-pin/<n>`, `project-bundle/<n>`, `project-manifest/<n>`. That needs a separate catalog entry — leaving the table alone for now to avoid scope creep.

---

### DISC-008: `reference/cli/clone.md` documents `--force` flag that isn't wired in `cli/mod.ts`

**Doc(s):** `reference/cli/clone.md`, mentioned in `extending/tutorials/01-cloning-a-generator.md`
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
- `extending/tutorials/01-cloning-a-generator.md:24`
- `extending/recipes/custom-form-field-renderer.md:23`
- `extending/recipes/design-system-across-many-apis.md:45, 46, 47`

**Bulk fix:** each line rewrites to `skmtc clone <project> -g <gen-id>`. The three lines in `design-system-across-many-apis.md` can be condensed to one invocation with three `-g` flags.

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

### BULK-005 — "four-level" framing of the enrichment path (links to DISC-001)

Pattern: prose claims that there are four routing levels.

```bash
grep -rn 'four-level\|4-level\|four level' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 8 docs):

- `using/tutorials/03-customize-with-enrichments.md:84`
- `using/how-to/configure-enrichments.md:36`
- `concepts/enrichments.md:7, 74, 310`
- `extending/how-to/add-enrichment-options.md:58`
- `reference/settings/enrichments-shape.md:4, 12, 316`
- `reference/settings/client-json-schema.md:160`
- `reference/api/content-settings.md:91`
- `reference/stock-generators/gen-typescript.md:58`

**Bulk fix:** "four-level" is wrong. The path is 3 levels for OAS/GQL operations, 2 levels for models. The framing of a single uniform path is the root error.

### BULK-006 — Wrong JSON examples using `"mutation":` / `"CreateContact":` etc. (links to DISC-001)

Pattern: enrichment JSON examples using the wrong key shape (`"mutation": { "CreateContact": ...}`).

```bash
grep -rn '"CreateContact":\|"UserModel":\|"CreateUser":' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 6 docs):

- `using/how-to/configure-enrichments.md:50`
- `concepts/enrichments.md:51, 248, 267, 318, 348`
- `extending/recipes/design-system-across-many-apis.md:118`
- `skills/skmtc-cli/SKILL.md:202`
- `reference/settings/client-json-schema.md:174, 231`
- `reference/settings/enrichments-shape.md:182, 200`

**Bulk fix:** each JSON example needs the key path rewritten. For OAS operations, the actual shape is `{ "<path>": { "<method>": <enrichment-value> } }`. The example operation names (`CreateContact`, `CreateUser`) should be replaced with their actual paths (e.g., `"/customers": { "post": {...} }`).

### BULK-007 — Wrong default export path `/models/<X>.generated.ts` (links to DISC-005)

Pattern: docs claim `/models/<X>.generated.ts` as a stock generator's default path.

```bash
grep -rn '/models/.*\.generated\|models/<refName>\|models/\${refName}' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~9 instances across 4 docs):

- `explanation/how-idempotency-works.md:54, 130, 140, 144, 156, 163`
- `extending/how-to/change-export-paths.md:33`
- `extending/tutorials/01-cloning-a-generator.md:71`
- `reference/api/content-settings.md:128`

**Bulk fix:** actual default paths for stock generators:
- `gen-zod`: `@/types/<name>.generated.ts`
- `gen-typescript`: `@/types/<name>.generated.ts`
- `gen-shadcn-form`: `@/forms/<Verb><Path>Form.generated.tsx`
- `gen-msw`: `@/mocks/handlers.generated.ts`

Citations in `how-idempotency-works.md` need particular care — they're stepping through an example trace that loses accuracy if the paths are wrong.

### BULK-008 — `class X extends ModelProjectionBase` etc. (links to DISC-005)

Pattern: documented Projection class extends the abstract base directly (rather than the factory result).

```bash
grep -rn 'extends ModelProjectionBase\|extends OasOperationProjectionBase\|extends GqlOperationProjectionBase' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (~12 instances across 9 docs):

- `explanation/how-idempotency-works.md:48`
- `concepts/cross-generator-coordination.md:224`
- `extending/tutorials/02-authoring-a-model-generator.md:92`
- `extending/tutorials/03-authoring-an-operation-generator.md:91`
- `extending/how-to/compose-with-another-generator.md:44`
- `extending/how-to/handle-graphql-instead-of-oas.md:49`
- `reference/api/generate-context.md:283`
- `reference/api/dsl-snippet-base.md:148` (in a prose comment — may be benign)
- `reference/api/content-settings.md:157, 225, 249, 300`

**Bulk fix:** the actual pattern is `class XProjection extends XBase` where `XBase = toModelProjectionBase({...})` (or the appropriate factory). The doc snippets that demonstrate "how to write a Projection" need to show the factory-then-extend two-step. The `dsl-snippet-base.md` instance reads "and extends OasOperationProjectionBase, which extends SnippetBase" — that's a chain-of-extension claim in prose, separate from a code example, and may be benign; verify before editing.

### BULK-009 — `SkmtcDocumentInput` with wrong field names (links to DISC under to-artifacts)

Pattern: type definitions using `document`/`sdl` field names instead of `value`.

```bash
grep -rn "{ type: 'oas'; document\|{ type: 'gql'; sdl" docs/ --include='*.md' | grep -v friction-log
```

Affected lines (4 instances in 1 doc):

- `reference/api/to-artifacts.md:61, 62, 334, 335`

**Bulk fix:** both fields are named `value` in the actual type (`core/types/SkmtcDocument.ts`). Fix all 4 lines in `to-artifacts.md`. The `glossary.md` entry for `SkmtcDocumentInput` already has the correct field name, so this is a fix-this-one-doc issue.

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

### BULK-011 — Doctor exit code 3 / `warn` / `fail` (links to DISC-006, DISC-007)

Pattern: doctor-specific fabrications.

```bash
grep -rn "'warn'\|'fail'\|exit code 3" docs/reference/cli/doctor.md
```

Affected lines (~7 instances in `reference/cli/doctor.md` only):

- Lines 111, 119, 126, 127, 162 (status strings `warn`/`fail`)
- Lines 180, 192 (exit code 3)

**Bulk fix:** all in one doc. Replace `warn` → `warning`, `fail` → `error`. Add `skipped` to the value list. Replace exit code 3 with `result.summary === 'error' ? 1 : 0` semantics.

### BULK-012 — `skmtc create` with `--json` / `--no-input` (links to DISC-003)

Pattern: invocations using flags `create` doesn't have.

```bash
grep -rn 'skmtc create.*--json\|skmtc create.*--no-input\|create my-.*--json' docs/ --include='*.md' | grep -v friction-log
```

Affected lines (2 instances in 1 doc):

- `reference/cli/create.md:18, 152`

**Bulk fix:** delete the flags from synopsis and the example invocation. Delete the Options section. Delete the JSON-output example block.

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
- `extending/how-to/change-identifier-conventions.md:58` — "silently — first writer wins" (wrong for cross-generator case)
- `extending/how-to/change-export-paths.md:100` — "first-writer-wins discards" (wrong for cross-generator case)
- `explanation/status-and-roadmap.md:171` — "first writer wins. The second is silently discarded"
- `concepts/the-three-phases.md:320` — distinguishes the two cases — **this one is correct**
- `reference/api/generate-context.md:133` — "definitions first-write-wins" (correct for the `register` path)
- `reference/api/dsl-snippet-base.md:91` — "definitions first-write-wins" (correct for the `register` path)

**Bulk fix:** distinguish the two layers throughout. `register({ definitions })` directly is silent first-write-wins. Driver path throws on `generatorKey` mismatch (cross-generator collision) and is silently idempotent on same-generator double-insertion. The two are NOT the same behavior.

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

### Verified clean in this probe-round

- No docs still claim the `form: { ... }` wrap in `gen-shadcn-form` enrichments (agent's source-flatten fix already propagated through the docs).
- `gen-graphql-operation` and `gen-graphql-typed-document-node` both use `isSupported: () => true` at their entries — matches what stock-gen docs claim.
- `File.toString()` section order is `reExports / imports / definitions` joined with `\n\n` — verified at `core/dsl/File.ts:181`. My docs (especially `reference/api/render-context.md`) cite this correctly.

---

## Cumulative tally after round 3 + extras

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

### BULK-018 — `Inserted` class has 4 public methods; docs mention only `toName()`

`core/dsl/Inserted.ts`:
- `toName(): string` (line 104) — **documented**
- `toIdentifier(): Identifier` (line 127) — undocumented
- `toExportPath(): string` (line 149) — undocumented
- `toValue(): V` (line 169) — undocumented

Plus properties `settings: ContentSettings<EnrichmentType>` and `definition: GeneratedDefinition<V>`.

My docs use `.toName()` exclusively. `toExportPath()` (useful for cross-references) and `toValue()` (the typed return) are particularly significant omissions. Affects `reference/api/projection-bases.md`, `reference/api/generate-context.md`, glossary's `Inserted` entry.

Documentation-completeness gap, not a fabrication.

### BULK-019 — Manifest `results` tree key conventions are unverified

`core/context/RenderContext.ts:30`, `GenerateContext.ts:80`, etc. — `captureCurrentResult(result, stackTrail)`. Results are emitted with a StackTrail; the nested-tree structure depends on how the StackTrail's segments split into nested object keys.

`reference/manifest-format.md` claims a specific tree:
```
"trace-<ms>" / "span-<ms>" / "generate" / generatorId / "<protocol>_<operationId>" / ResultType
```

Key conventions (`trace-<ms>` prefix, constant `"generate"` subkey, `<protocol>_<operationId>` format) are **extrapolated**. The recursive `ResultsItem` type allows arbitrary nesting. Whether the actual engine produces this specific shape needs a real-manifest sample to confirm.

`jq` recipes in the doc depend on this shape being right.

**Severity:** medium-high — affects user debugging.
**Status:** open, needs real-manifest sample.

---

## Cumulative tally after round 4

| Cluster | Sites | Status |
|---|---:|---|
| BULK-001 clone syntax | ~10 | verified-fixed |
| BULK-002–006 enrichments | ~75 | verified-fixed |
| BULK-007 `/models/` default | ~9 | open |
| BULK-008 extends ModelProjectionBase | ~12 | open |
| BULK-009 SkmtcDocumentInput fields | 4 | open |
| BULK-010 parseIssues optional | 3 | open |
| BULK-011 doctor exit/status | ~7 | open |
| BULK-012 create flags | 2 | open |
| BULK-013 EntityTypeValue | ~13 | open |
| BULK-014 basePath optional | ~4 | open |
| BULK-015 first-writer-wins | ~7 | open |
| BULK-016 StackTrail dots | 1 | open |
| BULK-017 OasOperation.responses optional | 1 | open |
| BULK-018 Inserted methods missing | 3 (gap) | open |
| BULK-019 manifest results tree | 1 (unverified) | open |

**~161 sites + 3 doc-completeness gaps + 1 unverified shape across ~26 docs.**
