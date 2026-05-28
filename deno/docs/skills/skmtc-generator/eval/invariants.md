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

## 7. Vocabulary: the real API verbs vs "emit"

The cross-generator coordination API has these method names — use them when referring to the API:

- `context.insertOperation(...)` — register an operation Projection
- `context.insertModel(...)` — register a model Projection by `RefName`
- `context.insertNormalizedModel(...)` — dispatches to `insertModel` only when the schema is a `$ref`, otherwise inlines
- `this.register({ definitions, imports })` — the lower-level write directly to the calling Projection's file. Almost always the `insertX` methods are preferable; they auto-register imports.

Do **not** invent "emit" as a SKMTC API verb. There is no `context.emit(...)`. Mistakes look like: describing cross-gen coordination as "the generator emits …" when the actual call is `insertOperation` / `insertModel` / etc., or proposing a new method called `emit*` on `GenerateContext`.

"emit" as plain English for "produce output" is fine and is used widely in core's own documentation (`types/Settings.ts`, `types/Preview.ts`, `context/CoreContext.ts`). This rule is about API verbs, not about banning a word.

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

When composing a Projection from peer types, prefer `insertOperation` / `insertModel` / `insertNormalizedModel` over hand-rolling `this.register({ definitions: [new Definition(...)], imports: { ... } })`. The Driver-mediated path:

- Computes per-(operation × generatorId) cache keys correctly (no manual `toGeneratorOnlyKey({ generatorId })` calls).
- Detects cross-generator collisions loudly via `affirmDefinition` (otherwise "first write wins" silently).
- Auto-registers imports into the calling Projection's file (no manual `imports: { [targetPath]: [targetName] }`).
- Is idempotent — re-inserting the same peer returns the cached instance.

When a generator author finds themselves calling `context.register({ definitions: [new Definition(...)] })` directly, that's a strong signal an `insertX` method exists that does the same thing better.
