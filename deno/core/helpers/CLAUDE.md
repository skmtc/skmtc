# core/helpers — directory guide

Pure-function utilities shared across the codebase. No
context-dependent state; nothing that touches `GenerateContext`.

**Variant-axis helpers:**

- `withVariant(baseName, variant)` — folds a variant name into an
  identifier name. Returns `baseName` unchanged for `'main'`;
  PascalCases each kebab segment and appends otherwise. Used by
  every variants-aware generator's `toIdentifier`.
- `toVariantList({opEnrichments, generatorId, operationLabel})` —
  enumerates the variants the engine should fan out over for one
  operation. Throws `"must include a 'main' variant"` when other
  variants are declared without `'main'`. Called from
  `GenerateContext.#runOasOperationGenerator` and
  `#runGqlOperationGenerator`.

**Naming and string helpers:**

- `strings.ts` — `capitalize`, `decapitalize`.
- `naming.ts` — `toEndpointName`, `toMethodVerb` (used in
  generator `toIdentifier` bodies).
- `sanitizePropertyName`, `protectedKeywords` — JS-keyword
  conflict avoidance.
- `parseModuleName`, `refFns`, `isImported`, `formatNumber`,
  `isEmpty`, `isGeneratorName`, `collateExamples`,
  `toResolvedArtifactPath` — narrower-purpose utilities.

**Logging / tracing:**

- `tracer.ts`, `ResultsLog.ts` — instrumentation glue.

Each helper has a sibling `.test.ts` file. Variant helpers
specifically:

- `withVariant.test.ts` — `'main'` passthrough, kebab → PascalCase
  joining, multi-segment names.
- `toVariantList.test.ts` — the four classification cases (absent,
  primitive, empty object, populated object) plus the
  missing-`'main'` throw.

Concept doc for the variant axis: `docs/concepts/variants.md`.
