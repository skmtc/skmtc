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

**Workspace-path helpers** (every reader of `settings.packages` and of
artifact paths goes through these — never re-implement the strip):

- `toWorkspacePath(path)` — the canonical workspace-relative spelling:
  drops a leading `@/` or `./` and a trailing `/`; the workspace root
  itself is `''`. A bare specifier (`zod`, `@tanstack/query`) passes
  through untouched.
- `isUnderRoot({path, rootPath})` — folder containment in canonical
  spelling. A root contains itself and everything below it, never a
  sibling that shares the prefix.
- `matchPackage({path, packages})` — the package roots containing a
  path as `{outermost, innermost}` (roots may nest: a nested root is a
  subpath export). Used by `lang-typescript/normalizeModuleName` and
  `lang-kotlin/toPackageName`.

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
