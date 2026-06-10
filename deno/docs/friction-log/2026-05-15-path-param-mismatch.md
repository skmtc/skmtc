# 2026-05-15 — Path-param mismatch + 4-form invoice/job migration

Migrated four hand-coded dialog forms (`RecordPaymentDialog`,
`SendInvoiceDialog` send + resend modes, `CompleteJobDialog`) to
`gen-shadcn-form`. The path-param naming mismatch between OpenAPI and
React Router blocked the first migration mid-stream and required an
API-level rename + full regen pipeline (`chanfana → openapi → tsp →
openapi → skmtc`).

## Knowledge acquired

Cloned `gen-shadcn-form` + `gen-tanstack-query-fieldplan`, plus the
consumer pipeline that feeds them.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `gen-shadcn-form` emits `useSafeParams(z.object({ <oasParamName>: z.string() }))` verbatim — the form reads the URL via whatever name the OpenAPI path used. If the React Router param has a different name, `useSafeParams` throws at mount via Zod. No alias seam exists. | Generator skill §customization-seams should call out path-param naming as a *runtime* coupling (not just a generator convention) — the consumer's URL param names must match the OAS. |
| K2 | `EnumSelect` (the default routing for string-enum schemas in `schemaToField.ts`) renders the enum *value* as both the `<option>` value and the visible text. No enrichment surface lets the consumer remap value→label. The customary workaround is a hand-coded component override (`fieldConfig.component`) pointing at a `FooField.tsx` that contains the label map. | Generator-feature gap. A small `enumLabels: Record<string, string>` field on `fieldConfig` would close this. Mention in skill §anti-patterns: "for non-trivial enum copy, write a wrapper component — there is no labels enrichment." |
| K3 | A `client.json` skip-list entry that doesn't match any path in the current OAS is silently a no-op. Renaming OAS path params (or any segment) silently invalidates every existing skip entry referencing the old path. No CLI warning. | CLI skill §filters should warn: "skip-list entries are exact-match string keys; if the OAS path changes, the entry stops matching." Also a candidate for a `skmtc doctor` check (`skip-stale-entries`). |
| K4 | The generated mutation hook signature for a POST with body is `mutateAsync({ <pathParam>, body: {...bodyFields} })` — `body` is its own nested object. Hand-written hooks in this codebase used flat-spread `mutateAsync({ <pathParam>, ...bodyFields })`. The two shapes look similar enough at call sites to slip past type-checking if the body is empty (`mutateAsync({ invoiceId })` typechecks but sends no body). | Migration playbook docs should call out: "every existing consumer of the hand-coded hook needs an explicit `body: {}` (or `body: {...}`)" — a typed but silent regression otherwise. |
| K5 | The `pnpm --filter @fieldplan/api generate:openapi` script fetches from a live `localhost:8787/docs/openapi.json`, so the API dev server must be running. A from-cold regen is: start `pnpm dev:api` → wait until `/docs/openapi.json` returns 200 → `generate:openapi` → `generate:tsp` → `pnpm --filter @fieldplan/typespec build` → `skmtc generate`. Six-step sequence, easy to skip a step. | Not a SKMTC concern per se, but worth a recipe in the consumer's `CLAUDE.md`. Not in scope for this skill. |
| K6 | The `gen-shadcn-form` skip list in this project is exhaustive (every endpoint is opted-out by default). New endpoint migrations require a *remove from skip* + *add enrichment* paired edit. Forgetting one half: enrichment present + skip present → silently no output. | The CLI's order-of-evaluation note (`isSupported → include → skip`) is correct but doesn't emphasise this all-skip pattern. Recipe-style doc: "exhaustive skip list as opt-in model." |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Path-param name coupling has no alias seam | blocker | open |
| 2 | Skip-list entries silently invalidated by OAS path renames | friction | open |
| 3 | No enum-label enrichment for `EnumSelect` | friction | open |
| 4 | Generated vs hand-coded hook signatures diverge silently | friction | open |
| 5 | Thin-Dialog-wrapper pattern recurs and isn't codified | win | open |

---

### 1. Path-param name coupling has no alias seam [blocker]

Migrating `RecordPaymentDialog`. The OpenAPI path was
`/v2/billing/invoices/{id}/payments` and the React Router route was
`invoices/:invoiceId`. The generator emitted
`useSafeParams(z.object({ id: z.string() }))` and the form crashed at
mount with a ZodError (`id` undefined).

**What happened:** Discovered post-generation, on inspecting the form
output. No generator option to alias `{id}` to `:invoiceId`. Three
options surfaced: (a) rename OpenAPI source-side, (b) rename URL
routes everywhere, (c) add a `pathParamAlias` enrichment. The user
chose (a) — a full chanfana-source rename of `:id` → `:invoiceId` for
14 invoice endpoint files + routes mounting + portal endpoint, then a
four-step regen (`openapi → tsp → openapi → skmtc`). This added
substantial scope to what was meant to be a 30-minute Tier A
migration.

**What was expected:** That the path-param-from-URL hook would gate
on an alias, or that the generator would document the OAS↔route
naming requirement loudly. Neither was the case.

**Why it matters:** Every form-generation migration depends on the
consumer team having previously enforced uniform OAS↔route param
naming. Most teams don't — `{id}` is a generic OpenAPI default that
collides with domain-prefixed URL params (`:invoiceId`, `:jobId`,
`:userId`). This is the same shape of problem as the
`project_location_create_endpoint_customerid` memory note (which
documented the inverse case: customerId in body instead of path).
Both point at "path-param naming is a load-bearing convention with
no enforcement and no seam."

**Possible fixes:** Unresolved.
- A `pathParamAlias: { id: 'invoiceId' }` enrichment on the form schema would let consumers patch over the mismatch without an API rename.
- `skmtc doctor` could detect mismatches by reading the React Router config (project-specific; probably too coupled).
- A scaffolded note in the generator skill: "before migrating, run `rg ':invoiceId' src/router*` and check it matches the OAS path-param name — rename one side before generating."
- Long-term, a SKMTC-level convention: "OAS path params SHOULD be domain-prefixed (`{invoiceId}` not `{id}`)" with a stock generator that lints OAS.

**Version anchor:** `@skmtc/core@0.5.0`, `@skmtc/gen-shadcn-form` (cloned, post-variants migration).

**Status:** open

---

### 2. Skip-list entries silently invalidated by OAS path renames [friction]

After renaming OAS `{id}` → `{invoiceId}`, all the existing skip-list
entries in `client.json` referencing `/v2/billing/invoices/{id}/...`
became dead — they no longer matched any path in the new OAS. No
warning from `skmtc generate`; output simply included endpoints that
were previously opt-out.

**What happened:** I caught it only by mentally tracing what would
happen with the renamed paths, then writing a Python pass to migrate
all `{id}` → `{invoiceId}` substrings in the skip list. Without that
defensive sweep, `gen-shadcn-form` would have generated forms for
every invoice action endpoint (send, resend, void, mark-complete,
mark-overdue, sync-accounting, etc.) — a quiet 10× expansion of the
output set.

**What was expected:** That `skmtc generate` would either warn about
unmatched skip-list entries, or that path-renames would be detected
as the dominant cause.

**Why it matters:** Skip lists are the primary opt-in/opt-out lever
for the form generator in this codebase. Silent invalidation is a
correctness bug, not a polish issue — the consumer's intent (which
endpoints to generate) is lost. Worse, the failure mode is
*addition* of unwanted artifacts, which CI/lint won't catch.

**Possible fixes:**
- `skmtc generate` could emit a parseIssue (warning level) for every
  skip-list entry that doesn't match a current OAS path. Already
  consistent with the existing parseIssue model.
- `skmtc doctor` check `skip-stale-entries/<project>` returning the
  stale set.
- Either fix would land in `@skmtc/core` (the filter evaluator).

**Version anchor:** `@skmtc/core@0.5.0`, `@skmtc/cli@<current>`.

**Status:** open

---

### 3. No enum-label enrichment for `EnumSelect` [friction]

The `RecordPaymentDialog` had a payment-method enum (`cash`, `card`,
`bank_transfer`, `check`, `stripe`, `gocardless`, `other`) with
human-readable labels in the hand-coded version (`Cash`, `Card`,
`Bank Transfer`, …). The generated form emitted a raw `<select>` with
the wire values as both `<option>` value AND visible text.

**What happened:** Inspected the generated output, saw
`<option value="bank_transfer">bank_transfer</option>`. Checked
`fieldConfig` shape in `enrichments.ts` — no label-mapping field.
Workaround per skill: hand-write a `PaymentMethodField.tsx` component
and point at it via `fieldConfig.component`. We accepted the UX
regression for this migration rather than authoring the component.

**What was expected:** That a common operation — labeled enum
dropdowns — would have a first-class enrichment, given how cheap
the implementation would be on the generator side.

**Why it matters:** Every enum field on every form-migration
candidate hits this. The Tier B `ApproveQuoteDialog`,
`CompleteJobDialog` (notes-only, OK), and most settings-tab forms
have at least one enum-with-labels. Either every consumer writes a
`FooField.tsx` (proliferation), or every consumer accepts wire-value
labels (UX regression). The third option doesn't exist yet.

**Possible fixes:**
- `fieldConfig.enumLabels: Record<string, string>` — the `EnumSelect`
  snippet would render `<option value="<k>">${labels[k] ?? k}</option>`.
- Or `fieldConfig.enumOptions: Array<{ value: string; label: string }>`
  for ordering control too.
- Either way: a small addition to the cloned generator's `EnumSelect`
  snippet + `fieldConfig` Valibot schema. Local to this consumer's
  clone; upstreaming is a separate concern.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned).

**Status:** open

---

### 4. Generated vs hand-coded hook signatures diverge silently [friction]

When migrating the `SendInvoiceDialog`, the wizard consumer
`InvoiceReviewStepContent.tsx` called the hand-coded
`useSendInvoice` as `sendInvoice.mutateAsync({ invoiceId })`. The
generated hook's signature is
`mutateAsync({ invoiceId, body: { via?, toAddress?, subject?, message? } })`
— `body` is mandatory (even if empty). The hand-coded version
flat-spread the body fields onto the call args.

**What happened:** TypeScript flagged the call after I removed the
hand-coded hook from `billing-hooks.ts`. Fix was changing the call
to `mutateAsync({ invoiceId, body: {} })`. Simple to fix, but the
divergence is *silent* if the body is empty — you can typecheck a
no-body POST that the API expects to receive a JSON object.

**What was expected:** That the generated and hand-coded shapes
would be equivalent enough that swapping was a no-op.

**Why it matters:** Any consumer of a hand-coded mutation that's
about to be replaced by a generated one needs an audit pass for call
sites. The transformation is mechanical (wrap body fields in
`{ body: … }`), but invisible at the type level when the body is
optional. Migration playbooks should make this explicit.

**Possible fixes:**
- Add to the form-migration recipe in this project's `CLAUDE.md`:
  "audit every `mutateAsync` call site for body-shape divergence."
- Generator-level: could `useXxx` accept either shape via a discriminated
  union? Probably not worth the complexity.
- A pre-migration grep recipe: `rg "useSendInvoice\(\)" src/` and
  audit each call site before deleting the hand-coded hook.

**Version anchor:** `@skmtc/gen-tanstack-query-fieldplan` (cloned).

**Status:** open

---

### 5. Thin-Dialog-wrapper pattern recurs and isn't codified [win]

Across all four migrations this session, the same pattern emerged:
the hand-coded "FooDialog" became a thin file
(`src/components/<area>/FooDialog.tsx`) that wraps the generated
form in a `<Dialog>` chrome, passes `onCancel={close}` and
`onSaved={close}`, and forwards `open`/`onOpenChange` to the
consumer. The generated form remains pristine; only the dialog
wrapper is hand-written.

**What happened:** I converged on this without prompting because
the generator doesn't emit Dialog chrome (and shouldn't — Dialog vs
Sheet vs route-level mount is a consumer decision). After the third
migration the pattern was obvious: every dialog-shaped form gets a
~30-line wrapper that's 80% boilerplate.

**Why it matters:** An agent doing the next dialog migration might
reach for the wrong thing — they might try to inline the Dialog into
the consumer mount site (losing the per-form file), or worse, try to
add a `dialogWrapper` enrichment to the generator (mixing chrome
concerns into form generation). The correct pattern — small wrapper
file alongside the consumer mount, generated form imported — needs to
be the prescribed answer.

**Possible fixes:**
- Add a recipe to the form-migration playbook: "dialog-shaped forms:
  rewrite the existing dialog file as a thin wrapper around the
  generated form. Keep it ~30 lines: Dialog chrome + form mount +
  close-on-saved."
- Reference example: this session produced 4 examples
  (`RecordPaymentDialog`, `SendInvoiceDialog`, `CompleteJobDialog`,
  and the implicit `SendInvoiceDialog` resend branch).
- Could be a `patterns/dialog-form.md` in the consumer's
  `patterns/` directory rather than a SKMTC-level concept.

**Version anchor:** N/A (consumer convention).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Path-param name coupling has no alias seam | Blocker that converted a single-form migration into a 14-file API rename plus full regen. Will recur for every form whose OAS path-param doesn't match its URL route param. The codebase's existing `project_location_create_endpoint_customerid` memory points at the same class of issue. | Generator-level: add `pathParamAlias` enrichment to `gen-shadcn-form`. Skill-level: pre-migration check ("does the OAS param match the URL param?") in the generator skill's task card for migrating dialog forms. |
| 2 | #2 — Skip-list entries silently invalidated by OAS path renames | Silent correctness regression: stale skip entries don't error, they produce *more* output than intended. Bites any OAS-path refactor across an exhaustive-skip project. | `@skmtc/core`: emit a `parseIssue` (warning) for every skip/include entry that didn't match any path in the current OAS run. Mirror in `skmtc doctor`. |
| 3 | #3 — No enum-label enrichment for `EnumSelect` | Every form with a wire-enum hits this. Forces either UX regression or per-enum component proliferation. Cheap to fix in the cloned generator. | Add `enumLabels: Record<string, string>` to `fieldConfig`; thread through `EnumSelect.toString()`. Local to this consumer's clone first; consider upstreaming if the pattern holds. |
