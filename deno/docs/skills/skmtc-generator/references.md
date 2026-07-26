# skmtc-generator — cross-references

## 12. Cross-references

- Concept docs: [`concepts/definitions-and-files.md`](../../concepts/definitions-and-files.md), [`concepts/how-generators-produce-output.md`](../../concepts/how-generators-produce-output.md), [`concepts/projections-and-snippets.md`](../../concepts/projections-and-snippets.md), [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md), [`concepts/files-and-dedup.md`](../../concepts/files-and-dedup.md), [`concepts/the-three-phases.md`](../../concepts/the-three-phases.md), [`concepts/variants.md`](../../concepts/variants.md), [`concepts/languages.md`](../../concepts/languages.md)
- API reference: [`reference/api/`](../../reference/api/) — full DSL surface
- Per-generator clone seams: [`reference/stock-generators/`](../../reference/stock-generators/)
- Tutorials / how-tos / recipes: [`authoring/tutorials/`](../../authoring/tutorials/), [`authoring/how-to/`](../../authoring/how-to/), [`authoring/recipes/`](../../authoring/recipes/)
- Design rationale: [`explanation/design-philosophy.md`](../../explanation/design-philosophy.md), [`explanation/why-clone-to-customize.md`](../../explanation/why-clone-to-customize.md)
- Consolidated LLM reference: [`llms.md`](../../llms.md) — the full operational-principles table is canonical there; §4 here is the authoring-weighted digest

### Tests that enforce the invariants

The rules above are prose; these tests are the executable specs —
when in doubt whether a rule still applies, read or run the test.

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
- `GeneratorKey` serialize/parse contract:
  `core/dsl/GeneratorKeys.test.ts` → round-trip tests
- Variant-bound `fallbackName` composition (the `ShadcnForm` pattern):
  `core/context/GenerateContext.normalized-model-variants.test.ts`
- Bit-identical rendering across variant changes:
  `core/run/toArtifacts.regression.test.ts`

