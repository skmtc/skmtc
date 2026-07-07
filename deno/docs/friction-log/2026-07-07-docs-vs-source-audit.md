# Docs-vs-source audit — 2026-07-07

Fan-out audit: one agent per doc page diffed its claims against current
source, with an adversarial verify pass. **Partial run** — 36 of 126
pages audited before usage credits ran out, and the verify pass never
executed. So the 195 discrepancies + 53 gaps in the companion
`2026-07-07-docs-vs-source-audit-findings.json` are **unverified audit
output**, not confirmed defects. The systematic clusters below were
spot-verified against source by hand; the long tail (`misc`, and the
gaps) still needs per-item triage.

## Headline

The `concepts/` and `authoring/` trees teach the **pre-0.8 generator
API**. Core was redesigned (the language-enters-via-imports work,
core 0.8.0+), and the teaching docs were not carried forward. Six
clusters (below) were hand-verified against current source and recur
across ~30 pages; each is a real defect, not a false positive.

## Verified systematic clusters

Each was confirmed by reading current source. A representative
verification command (runnable from `skmtc/deno/`) is given; it exits 0
while the doc drift exists.

### 1. `transform` lost its `acc` accumulator (8 findings, mostly error)

Docs teach `transform: ({ context, operation, acc }) => acc` with `acc`
threaded between siblings as a fold. Source has
`transform: ({ context, operation, variant }) => void` — no `acc`
anywhere in `core/dsl/operation/` (OAS or GQL).

```bash
grep -q 'variant: string' core/dsl/operation/oas/types.ts && ! grep -rq '\bacc\b' core/dsl/operation/
```

Pages: `concepts/how-generators-produce-output.md`,
`concepts/the-three-phases.md`, `concepts/the-graphql-pipeline.md`,
`concepts/variants.md`, `authoring/recipes/composing-multi-generator-stacks.md`,
`authoring/how-to/handle-graphql-instead-of-oas.md`.

### 2. `toEnrichmentSchema` is a required config field (11 findings, mostly error)

Docs frame enrichment schema as add-only-if-needed. Source makes
`toEnrichmentSchema` **required** on both the Entry configs
(`toModelEntry`, `toOasOperationEntry`) and the projection-base
configs. A no-config generator must pass core's `emptyEnrichmentSchema`.
Doc example snippets that omit it fail `deno check`.

```bash
grep -q 'toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>' core/dsl/model/toModelEntry.ts
```

Pages: the two authoring tutorials (02, 03 — **the base.ts + Entry
examples are already fixed**, see below), `authoring/how-to/add-enrichment-options.md`,
`authoring/recipes/design-system-across-many-apis.md`, `concepts/enrichments.md`,
`concepts/projections-and-snippets.md`.

### 3. Enrichments are a three-scope umbrella with a trailing variant level (14 + 7 findings, mostly error)

Docs teach a flat schema whose root is the payload, keyed
`enrichments[id][refName]` / `[id][path][method]`. Source resolves a
`{ subject, generator, stack }` umbrella, and the subject key path has a
trailing **variant** level: `['enrichments', id, refName, variant]` /
`[..., path, method, variant]`. `'main'` must be present. The
projection reads the *parsed umbrella* off `settings.enrichments`, not
the raw leaf.

```bash
grep -q "config.id, refName, variant" core/dsl/model/toModelProjectionBase.ts
```

Pages: `authoring/how-to/add-enrichment-options.md` (wrong end-to-end),
`concepts/enrichments.md`, both authoring tutorials,
`authoring/recipes/*`, `concepts/how-generators-produce-output.md`,
`concepts/the-three-phases.md`, `concepts/the-graphql-pipeline.md`.

### 4. `insertOperation` takes a single object argument (15 findings)

Docs show positional `insertOperation(MyProjection, op)`. Source is
`insertOperation({ projection, operation, ... })`. Related, unverified
sub-claims in the same cluster: `insertNormalizedModel` returns a
`DefinitionBase` (has `.identifier`/`.value`, **not** a `.toName()`),
and `context.register` takes `reExports?: ReExportBase[]` /
`imports` arrays, not the concise `Record` shape.

```bash
grep -q 'insertOperation<V extends GeneratedValue' core/context/GenerateContext.ts
```

Pages: `concepts/the-three-phases.md`, `concepts/cross-generator-coordination.md`,
`concepts/projections-and-snippets.md`, `concepts/the-type-system.md`,
`authoring/how-to/compose-with-another-generator.md`,
`authoring/recipes/composing-multi-generator-stacks.md`.

### 5. `concepts/attribution-and-gen-maps.md` is heavily stale (12 findings, 7 error) — VERIFIED

Confirmed against source: `AttributionState` is `{ postPass?: ... }`
with **no `enabled` field** (capture is always-on);
`runPostPassForFiles` **does not exist**; `attribute()` returns
`{ generatorId, schemaPointer, variant, definitionName, producerName }`
— every field name in the doc is wrong (`genId`/`srcPtr`/`defName`);
pointers are protocol-agnostic (no `oas:`/`gql:` prefix); the sidecar
registry entry field is `type`, not `kind`. This page needs a
near-total rewrite.

```bash
! grep -q 'enabled' core/types/AttributionState.ts && ! grep -rq runPostPassForFiles core/ && grep -q 'type: v.union' core/anchors/sidecar.ts
```

### 6. Bundle behavior is inverted (12 findings) — VERIFIED

Confirmed: remote-only (all-`jsr:`) projects DO carry a local
`bundle.js` and need a matching `worker.ts` snapshot; `install` always
rebundles. Docs say the opposite.

```bash
grep -q 'Remote-only' cli/lib/bundle-freshness.ts
```

## Already fixed this session

- Scaffold `toEnrichmentSchema` bug (Entry + base templates in
  `cli/lib/{model,operation}-generator.ts`) + regression tests.
- Invalid hyphenated model Entry identifier (`schema-metaEntry` →
  `schemaMetaEntry`).
- Tutorial 02/03 `base.ts` examples (added `toEnrichmentSchema`).

## Next actions

1. Author-directed: confirm the intended current enrichment authoring
   model, then rewrite `authoring/how-to/add-enrichment-options.md` and
   `concepts/enrichments.md` as the canonical sources; the tutorials
   and recipes follow.
2. Resume the audit on the remaining 90 pages (the workflow caches
   completed agents; re-run `docs-vs-source-audit`).
3. Graduate each hand-verified cluster into `discrepancy-catalog.md`
   with its pinned command so `verify-catalog.ts` guards it.
4. Triage the 113 `misc` findings + 53 gaps per-item (raw data in the
   companion JSON).
