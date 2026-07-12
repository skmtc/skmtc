# SKMTC architectural invariants

Ground truth for the SKMTC codebase. A candidate response that violates any of these is incorrect, no matter how reasonable it looks.

## 1. No plugin registry, no dependency graph, no topological sort

Cross-generator coordination is a `Map` cache keyed by `(identifier.name, exportPath)`. Generator order does not affect output. There is no manifest of generators, no DAG, no init order. Do not propose adding one.

## 2. Render does not run Prettier or Biome

No formatter runs inside `@skmtc/core`. Generated output is unformatted by design; consumers format separately. Do not propose adding a formatter step to the render phase.

## 3. Generator source code IS the customization surface

Stock generators have *deliberately* hardcoded export paths, peer imports, and naming choices. These are not bugs — they are customization seams. To customize beyond what enrichments expose, the correct response is "clone the generator package and edit", not "make the stock generator configurable".

One critical distinction:

- **Parametric config is legitimate.** Example: `toTypescriptEntry({ scalars: {...} })`. The *shape* of the configuration is fixed across consumers; only the *values* differ per consumer's input (different schemas have different scalar names). These values can't be hardcoded because they vary per input.

- **Binary feature toggles are anti-pattern.** Example: `toGraphqlOperationEntry({ emitDocument: true })`. A "should this generator emit X" decision is exactly the kind of opinion the generator's source encodes. Consumers who want X clone and add it; consumers who don't want X clone and remove it.

First-pass test: *"would two consumers of this generator legitimately set this flag to different values, or are we trying to ship two slightly different generators in one package?"* If the latter, it's two opinions masquerading as one configurable generator. Clone-to-customize handles it cleanly and avoids shipping every consumer the dead-code path of the flag-off case.

## 4. OasSchema is a union type, not a class hierarchy

`OasSchema` is the union of: `OasArray | OasBoolean | OasInteger | OasNumber | OasObject | OasString | OasUnknown | OasUnion` (see `core/oas/schema/Schema.ts`). Each member class independently implements `.isRef()` returning `false`, so callers can exhaustively narrow under `switch (schema.type)`.

`OasRef<T>` is a parallel sibling **not in the `OasSchema` union**. It implements `.isRef()` returning `true`. Code that accepts either uses the type `OasSchema | OasRef<'schema'>`.

Both the `OasSchema` member classes and `OasRef` extend `OasBase` — a real, existing shared base for parse-context plumbing and basic utilities (see `core/types/OasBase.ts`). The rule is **not** "no shared base ever." The rule is:

- **Do not add a base above the union that provides the type-discriminator methods** (`.isRef()` and any future narrowing methods). Those must remain independently implemented per sibling so the discriminated union narrows correctly.
- **A second-tier base providing only infrastructure** (like the existing `OasBase`) is fine.

Do not refactor the existing per-sibling `.isRef()` onto a shared parent. Do not propose introducing a `BaseSchema` / `BaseOasSchema` / `AbstractOasSchema` class *above* the union members.

## 5. The variant axis fans out at the engine, not the generator

A single source item can produce N Definitions via named variants under `enrichments[id][path][method]` (OAS), `[id][rootKind][fieldName]` (GQL), or `[id][refName]` (model). `'main'` is always present — the engine throws at start if a consumer wrote variants without it.

Variants flow through `ContentSettings.variant`, the `GeneratorKey`'s trailing segment (4th for operations, 3rd for models), and the per-call `variant` arg in every static method (`toIdentifier`, `toExportPath`, `toEnrichments`) and every entry callback (`transform`, `isSupported`, `toPreviewModule`, `toMappingModule`).

Cross-gen `insertOperation` / `insertModel` defaults to `'main'`; passing a non-`'main'` variant the peer doesn't declare throws at the Driver (`assertPeerVariantExists`).

## 6. Names derive from operation, not operationId

SKMTC generators derive names from HTTP method + path (deterministic). Never from `operationId` (author-controlled, emitter-dependent).

## 7. Use the SKMTC primitives by name; avoid casual codegen verbs

When referring to SKMTC operations in code or prose, name the actual exported primitives. These map to real surface on `@skmtc/core`:

- `register({ definitions, imports })` — direct write into the calling Projection's file
- `insertOperation(Projection, operation)` — cross-gen operation Projection insertion (Driver-mediated; auto-registers imports)
- `insertModel(Projection, refName)` — cross-gen model Projection insertion (Driver-mediated)
- `insertNormalizedModel(Projection, { schema, fallbackName })` — dispatches to `insertModel` for `$ref` schemas, inlines otherwise
- `defineAndRegister` — low-level Definition construction (rare; the `insertX` methods wrap this for you)
- `findDefinition` — cache lookup by `(name, exportPath)`

Do **not** use casual codegen verbs as substitutes for these:

- ❌ `emit` — no `context.emit()` method exists; say `register` / `insertOperation` / `insertModel`
- ❌ `dispatch` / `dispatcher` — no dispatcher in the API; say `insertOperation` / `insertNormalizedModel`
- ❌ `stitch` — no stitching primitive; say `register({ imports })`

These words don't map to anything exported from `@skmtc/core`. Using them in code or prose fabricates a mental model that doesn't connect to the actual API surface. (Source: canonical `docs/llms.md` operational-principles table.)

Drift caveat: some core JSDoc still uses `emit` as plain English for "produce output" (`types/Settings.ts`, `types/Preview.ts`, `context/CoreContext.ts`). This is an incomplete cleanup, not a legitimate exception. The rule above is canonical; legacy uses don't grant license.

## 8. Generator location-independence + single-base

Generators must not import naming or path helpers from peer generator packages. A generator package has exactly ONE factory base; variant Projections use `static override toIdentifier`, `static override toExportPath`, etc., within the same package.

Cross-generator references use the `@skmtc/gen-foo` package alias declared in `deno.json`, never relative paths into a sibling generator's `src/`.

## 9. Projections DO have a class hierarchy (distinct from §4)

Generator authoring extends an existing Projection base — this is the expected pattern:

```
SnippetBase                                    (core/dsl/SnippetBase.ts — abstract root)
├── ModelProjectionBase<EnrichmentType>        (core/dsl/model/ModelProjectionBase.ts)
├── OasOperationProjectionBase<EnrichmentType> (core/dsl/operation/oas/OasOperationProjectionBase.ts)
└── GqlOperationProjectionBase<EnrichmentType> (core/dsl/operation/gql/GqlOperationProjectionBase.ts)
```

Authors extend one of the three via the corresponding factory: `toModelProjectionBase<EnrichmentType>(...)`, `toOasOperationProjectionBase<EnrichmentType>(...)`, or `toGqlOperationProjectionBase<EnrichmentType>(...)`. Within a generator package, variant Projections extend the package's own factory base (returned by `to*ProjectionBase(...)` at the package's mod.ts top) and override the relevant `static` methods.

§4's "no class hierarchy" rule applies **only to OAS schema types**, not to Projections. Do not propose flattening or rewriting the Projection class tree. Do not attempt to write a Projection without extending one of these bases.

## 10. Generated files are pure regenerable artifacts

`*.generated.ts` (and other `.generated.*`) files are overwritten on every `skmtc generate`. They must not contain placeholder content (`// TODO`, `# TODO`, `FIXME`, GraphQL `# TODO: select fields`, etc.) that requires consumer hand-editing. Any consumer edits get wiped on the next regenerate; users may not notice until production.

The two viable shapes for any piece of output:

1. **Emit complete, working output** — the generator knows enough to produce a usable artifact.
2. **Don't emit that piece at all** — let the consumer wire it up in their own non-generated code.

The "scaffold a stub for the consumer to fill in" middle ground silently breaks the regenerate cycle. If a generator finds itself wanting to emit a placeholder, the placeholder is a signal the responsibility belongs in the consumer's non-generated code, not in the generator's output.

## 11. Driver-mediated insertion over manual `register`

When composing a Projection from peer types, prefer `insertOperation` / `insertModel` / `insertNormalizedModel` over hand-rolling `this.register({ definitions: [new TsDefinition(...)], imports: { ... } })`. The Driver-mediated path:

- Computes per-(operation × generatorId) cache keys correctly (no manual `toGeneratorOnlyKey({ generatorId })` calls).
- Detects cross-generator collisions loudly via `affirmDefinition` (otherwise "first write wins" silently).
- Auto-registers imports into the calling Projection's file (no manual `imports: { [targetPath]: [targetName] }`).
- Is idempotent — re-inserting the same peer returns the cached instance.

When a generator author finds themselves calling `context.register({ definitions: [new TsDefinition(...)] })` directly, that's a strong signal an `insertX` method exists that does the same thing better.

## 12. The language lives on the import graph — nowhere else (core 0.8.0+)

The engine is language-blind. Entries (`toOasOperationEntry` / `toGqlOperationEntry` / `toModelEntry`) are pure pipeline config and take **no** `lang` field — proposing `toOasOperationEntry({ lang, … })` is incorrect. A generator declares its target language by importing its projection-base factory from a lang package (`toTsModelProjectionBase` / `toTsOasOperationProjectionBase` / `toTsGqlOperationProjectionBase` from `@skmtc/lang-typescript`; the Kotlin equivalents `toKtModelProjectionBase` / `toKtOasOperationProjectionBase` from `@skmtc/lang-kotlin`) and, for registering snippets, extending the lang snippet base (`TsSnippet` / `KtSnippet`). The language rides the class hierarchy as the static `lang` on the lang snippet base; the engine's Drivers read it ephemerally off the projection class's inherited static (`projection.lang`) whenever they create a file or build a `Definition`. There is no `resolveLang`, no config-map language resolution, and no `lang` config field anywhere.

- Projection-base factories come FROM the lang package (the veneers) — proposing a `lang` field on them (or on core's factories) is incorrect.
- Snippets carry no `Lang`; registering snippets extend the lang snippet base.
- `register` / `defineAndRegister` pass plain data — never a `Lang` object, a `createFile` closure, or a `generatorId`.
- Responses describing the interim 0.7.x model (a required `lang` field on the entry, resolution by `generatorId`) are incorrect — that model was unwound in the 0.8.0 convergence (`notes/lang/16-target-architecture.md`).
- The identifier factories (`createVariable` / `createType`), `sanitizePropertyName`, and the TS syntax helpers (`List`, `FunctionParameter`, `toPathTemplate`, …) import from `@skmtc/lang-typescript` (moved out of core under F5/F6 — `notes/lang/17-naming-layer-and-helpers-move.md`). Core's `Identifier` is neutral data (`name`, opaque `kind`, `exported`, `typeName`); core's `EntityType`, its concrete `Definition`, and the `Identifier.create*` statics no longer exist. A response that tells the user to import the factories or helpers from `@skmtc/core` today is incorrect.

## 13. Own-file `register` vs explicit `registerInto` — no fallback

Projection `register({ imports, definitions })` writes **only** to the projection's own file (`this.settings.exportPath`); the args take no `destinationPath`. Writing into a different file is a separate, explicit method: `registerInto(destinationPath, args)`. There is deliberately **no** `destinationPath ?? exportPath` fallback — proposing one (or a `destinationPath` option on projection `register`) is incorrect; the two paths are kept separate so a missing path can never silently land content in the wrong file.

Snippet `register({ imports, destinationPath })` requires `destinationPath` (snippets have no exportPath) and is **keyless** — `generatorKey` is an optional attribution (gen-maps) input, never a registration requirement (F7 closed by construction in the 0.8.0 convergence). A registering snippet must extend the lang snippet base (`TsSnippet` / `KtSnippet`); a raw `SnippetBase` subclass has no `register` at all — the correct fix for that compile error is extending the lang snippet base, not `try/catch`, not `Deno.writeFileSync`, not hardcoding the import into the template string.

## 14. `transform` returns `void`

All three entry factories type `transform` as `({ context, operation|refName, variant }) => void`, uniformly across OAS, GQL, and model entries. Output is produced only via side effects — `register` / `insertOperation` / `insertModel` / `insertNormalizedModel`; a value returned from `transform` is ignored.

## 15. Generation is create-or-reuse: files are keyed maps, producers create their own dependencies

A file is an object of keyed maps — `{ imports, definitions }` (plus `reExports`), with `definitions` mapping identifier → value. The Generate phase does nothing but write definition objects into file objects; Render serializes them. Because the maps are keyed, the file map doubles as a cache, and the whole coordination model follows:

- `insertOperation` / `insertModel` / `insertNormalizedModel` are **create-or-reuse**: a cache hit at `(identifier.name, exportPath)` returns the existing Definition; a miss constructs the dependency's Projection — which recursively creates-or-reuses ITS dependencies — and registers it.
- **Every producer creates the definitions it depends on during its own construction.** There is no execution ordering, no priorities, no multi-pass design, and no "ensure gen-X runs first" — none of these mechanisms exist, and proposing one (including workarounds like reordering the generators list or splitting generation into two runs) is incorrect.
- No author-maintained registry or pre-generation step is ever needed; the engine's cache IS the registry. Defensive duplicate-checking before an insert is also incorrect — dedup is automatic.
- The `generatorKey` recorded on each Definition (which generator + schema produced it) is what distinguishes safe duplication (same provenance → the cached Definition is reused) from a real naming collision (same name, different provenance → `affirmDefinition` throws `"Registered definition mismatch"`).

A response that treats SKMTC generation as an ordered pipeline of template passes — sequencing generators, pre-generating shared dependencies in a first pass, or hand-managing a dependency registry — has imported the wrong mental model and is incorrect regardless of how carefully it is engineered.
