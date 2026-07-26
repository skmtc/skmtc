# skmtc-generator — the variant axis

Read this when the consumer's `client.json` declares variants beyond
`main` (or you are designing a generator that should produce N
artifacts per item). The always-loaded safety rules in the
`skmtc-generator` skill still apply: `'main'` is always present (the
engine throws otherwise), and cross-generator `insert*` never
auto-inherits `this.settings.variant` — peers get `'main'` unless they
declare the variant.

Variants partition output (section-edit forms, wizard steps,
mock-scenario flavours); enrichments parameterise it — a label or
theme is an enrichment field, not a variant.

### Card: Authoring a variants-aware generator

Use the variant axis when output naturally splits into N artifacts
per item — section-edit forms for a broad PATCH endpoint, wizard
steps, mock-scenario flavours. NOT for cross-cutting overrides like a
label or theme (those are enrichment fields): variants partition
output; enrichments parameterise it.

1. **`src/base.ts`** — `toIdentifierName` folds `variant` in via
   `withVariant(base, variant)`; `toExportPath` threads `variant`
   into its `toIdentifierName` call so each variant lands in its own
   file.
2. **`src/mod.ts`** — `transform` threads `variant` into
   `context.insertOperation({ projection, operation, variant })`;
   `toPreviewModule` / `toMappingModule` thread it into every static
   call.
3. **`src/enrichments.ts` — no change.** The variant axis is
   core-owned; your schema describes the *per-variant inner* shape.
   Consumers wrap it in the variant record (`{ main: {…},
   customer: {…} }`) in `client.json`.
4. **Internal siblings** (a Body type, a Props type) — derive
   `fallbackName` from `settings.identifier.name`; it's
   variant-bound already, so siblings pick up the suffix. Canonical:
   `gen-shadcn-form/src/ShadcnForm.ts`.
5. **Cross-package peers** — `this.insertOperation(Peer, op)` with no
   variant arg; both your variants share the peer's `'main'`
   Definition (§4 "Composition").
6. **Consumer migration** — wrap existing operation-level enrichment
   in `{ main: {…} }`; variants without `'main'` throw at start.

Worked example: `gen-shadcn-form` (post-0.5.0); enforcement tests in
§12.


## Enforcement tests

- Variant axis: `core/context/GenerateContext.variants.test.ts`,
  `core/context/GenerateContext.end-to-end.test.ts`,
  `core/helpers/toVariantList.test.ts`,
  `core/helpers/withVariant.test.ts`
- Variant threading on `insert*`:
  `core/context/GenerateContext.cross-variant.test.ts`
- Auto-inherit variant tripwire:
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation"
- Variants-aware `toIdentifierName` ignoring `variant`:
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "forgets to vary toIdentifier collides on second variant"
- Variant-bound `fallbackName` composition (the `ShadcnForm` pattern):
  `core/context/GenerateContext.normalized-model-variants.test.ts`
- Bit-identical rendering across variant changes:
  `core/run/toArtifacts.regression.test.ts`
