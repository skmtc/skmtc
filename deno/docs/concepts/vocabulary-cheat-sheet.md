# Vocabulary cheat sheet — SKMTC nouns to familiar analogues

SKMTC's DSL has its own vocabulary (`Projection`, `Snippet`,
`Driver`, `ContentSettings`, …). New contributors and LLMs coming
from training-data priors typically don't anchor on these terms
immediately. This page maps each SKMTC noun to a familiar concept
from React / TS codegen / general systems so the mental model lands
faster.

These are **analogues, not equivalences.** They're meant as
landing pads — once you've found the doc you need, switch to the
SKMTC-native vocabulary, because the analogues miss important details.

## DSL vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **Projection** | An exportable React component / a `.tsx` file you'd write by hand | Projections live in memory until Render serialises them; they're not files on disk during Generate. Coordinate by NAME, not by source-text reading. |
| **Snippet** | A JSX expression or template fragment — `<Foo />` you'd embed inside a parent component | Snippets have no file-scope name; they're spliced into a Projection's `toString()` via `${this.snippet}`. They register imports against the parent's `destinationPath`. |
| **`SnippetBase`** | The shared base of a React component and a JSX expression | The class hierarchy `SnippetBase → SnippetBase descendant` is the literal DSL spine — both Projections and Snippets descend from it. |
| **`toTsModelProjectionBase` / `toTsOasOperationProjectionBase` / `toTsGqlOperationProjectionBase`** | Factories that return specialised React.Component-style base classes for `<UserType>`, `<EditForm>`, `<MutationHook>` | Three flavours of Projection base, each a class returned by a lang-veneer factory with its own static-method contract (`toIdentifierName`, `toExportPath`, …). Pick the right one based on what drives the Definition: a refName, an OAS operation, or a GQL operation. |
| **`Definition`** | A `Component` instance + the `export const Component = …` wrapper | The Driver wraps a Projection's value in a `Definition`. The `export const` prefix is added at File-serialisation time — don't write it yourself in `toString()`. |
| **`ContentSettings`** | A React-component `props` bag, computed by the engine before construction | Carries `(identifier, exportPath, enrichments, variant)`. The engine builds it by calling the Projection's static methods, then hands it to the constructor. |
| **`Identifier`** | A name + an opaque per-language `kind` (TypeScript: `'variable'` or `'type'`) | Use `createVariable('Foo')` or `createType('Foo')` from `@skmtc/lang-typescript`. The kind flows into declaration keywords and import statements under `verbatimModuleSyntax`. |
| **`Stringable`** | Any value with a `.toString()` method | The composition contract — a Snippet, a Projection, a `CustomValue`, an `Identifier`, or a raw string are all interchangeable in template-literal interpolation. |
| **`CustomValue`** | An inline TS fragment that doesn't come from the OAS document | When you need to splice a TS literal that's not derivable from the schema (a hand-written expression), wrap it in `CustomValue` so it composes with the rest of the DSL. |
| **`Import`** | A line at the top of the file: `import { X } from 'y'` | Registered via `this.register({ imports: { 'y': ['X'] } })`. Don't write raw `import` statements inside template literals; they land in the file body, not the header. |

## Engine vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **`Driver`** | A React render function for Projections — it constructs and mounts | `OasOperationDriver`, `GqlOperationDriver`, `ModelDriver` each handle one flavour. They look up the cache, construct the Projection if absent, register the Definition, and stitch imports. |
| **`GenerateContext`** | The orchestrator — like a Redux store + React's reconciler | Owns the per-generator dispatch loop, the file map, the manifest results, the StackTrail. Most cross-generator coordination goes through `context.insertOperation` / `insertModel` / `insertNormalizedModel`. |
| **`transform` (in an entry config)** | A `useEffect` body — runs per `(operation, variant)` pair | Returns `void` for both OAS and GraphQL — the return value is ignored. Output happens via `register` / `insertOperation`, not the return. |
| **`isSupported`** | A `feature flag check` for whether the generator handles this operation | Capability gate, NOT user-intent gate. Use `client.json`'s `include` / `skip` for user intent. Gating on enrichment presence is an anti-pattern. |
| **`toIdentifierName` / `toExportPath`** | Pure functions producing `(name, file)` for a given operation | Must be pure — no `this`, no async, no env reads. The cross-generator cache depends on this. |
| **`toEnrichments`** | A `useSelector` over `context.settings.enrichments` keyed to this operation+variant | The static walks `enrichments.<id>.<path>.<method>.<variant>` for OAS or `<rootKind>.<fieldName>.<variant>` for GQL. |
| **`Inserted`** | The return value of `useQuery` — a handle to the inserted thing | `.toName()` gives the identifier name (use this in your template literal). `.settings` gives the `ContentSettings`. `.definition` gives the wrapped Definition. |

## Identity / caching vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **`GeneratorKey`** | A composite primary key in a SQL table | Pipe-delimited string: 4 segments for operations (`id\|path\|method\|variant` OAS, `id\|rootKind\|fieldName\|variant` GQL), 3 for models (`id\|refName\|variant`). Driver compares old vs. new key in `affirmDefinition` to detect collisions. |
| **`findDefinition({name, exportPath})`** | A cache `.get(key)` | Looks up an existing Definition by `(name, exportPath)` in the target file. Returns `undefined` on miss. |
| **`affirmDefinition`** | A cache integrity check — "does the existing entry match what I'm about to insert?" | Compares cached Definition's `generatorKey` to the call's computed `generatorKey`. Mismatch → `"Registered definition mismatch"` throw. Same key → reuse cached. |
| **Cache key vs. `GeneratorKey`** | Map key vs. row identity column | The cache key (`name, exportPath`) is intentionally narrower than `GeneratorKey`. A variants-aware Projection that forgets to fold variant into `toIdentifierName` produces the same cache key for two variants — the Driver's integrity check fires loudly instead of silently producing duplicate exports. |

## Variant vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **Variant** | A discriminated-union case for "one source item, several artifacts" | Named string axis below `[path][method]` (OAS ops), `[rootKind][fieldName]` (GQL ops), or `[refName]` (models). `'main'` is always present. See [`concepts/variants.md`](./variants.md). |
| **Variants-aware generator** | A React component that renders differently based on a prop | Its `toIdentifierName` folds `variant` into the returned name (typically via `withVariant`). Distinct `(name, exportPath)` per variant → distinct Definitions. |
| **Variants-unaware generator** | A React component that ignores the variant prop | Destructures `variant` and discards it. Every variant of every caller resolves to the same `'main'` Definition; that Definition is shared (cache hit). |
| **`withVariant(base, variant)`** | A string-concatenation helper that's PascalCase-aware | `withVariant('Form', 'main')` → `'Form'`. `withVariant('Form', 'line-items')` → `'FormLineItems'`. The kebab-case→PascalCase transform is invertible because the variant regex bans uppercase. |
| **`'main'`** | The "default branch" of a switch statement that's always present | Guaranteed by the engine — fills it in when no enrichments are configured; throws if other variants are declared without it. |

## CLI / consumer vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **Project** | A workspace folder for one schema-to-code mapping | Lives at `<root>/.skmtc/<project>/`. One project = one schema source + one set of generators + one `client.json`. NOT the consumer app. |
| **`client.json#settings`** | A `tsconfig.json`-style config: paths, filters, overrides | Carries `basePath`, `source`, `enrichments`, `include`, `skip`. |
| **`enrichments`** | Per-item prop overrides | Routed by `[generatorId][path][method][variant]` for OAS, `[rootKind][fieldName][variant]` for GQL, or `[refName][variant]` for models. |
| **`basePath`** | The `@` alias root in `tsconfig.paths` | Required, relative. Must match the consumer bundler's `@` alias config — generators produce `@/<subdir>/…` paths assuming this alignment. |
| **`include`** | A `tsconfig.json#include` allow-list | Empty array = no filter. Names a generator (string form), `(path, method, variant[])` tuples for operations, or `(refName, variant[])` tuples for models (object forms). |
| **`skip`** | A `tsconfig.json#exclude` deny-list | Same shapes as `include`. `skip` wins over `include`. |
| **`manifest.json`** | A build-output manifest like Webpack's `stats.json` | Records every (generator × item) outcome plus per-source artifacts. Read it for diagnostics before guessing. |

## Pipeline vocabulary

| SKMTC term | Familiar analogue | What's different |
|---|---|---|
| **Parse phase** | A schema → AST step | OAS / GraphQL JSON → `OasDocument` / `GqlDocument`. |
| **Generate phase** | The reconcile / render pass | OAS / GQL objects → in-memory `File` map. Where every generator's `transform` runs. |
| **Render phase** | Writing the AST out to source files | `File` map → `{ path: content }`. NO formatter runs — consumers format their own output. |
| **`ParseIssue`** | A non-fatal compile warning | Captured per-item. `removeErroredItems` prunes downstream dependents but doesn't abort the run. |
| **`StackTrail`** | A breadcrumb trail / browser-history stack of what we were doing when a thing happened | Frames: root, generator id, operation, variant. Each `captureCurrentResult` records the trail. |

## What this page is NOT

- A reference. The reference docs are in `docs/reference/`. This is
  a landing-pad doc — once you've found what you need, switch to
  SKMTC-native vocabulary because the analogues lose important
  detail.
- Exhaustive. Specialised types (`OasObject` and friends,
  `EnrichmentRequest`, the `Inserted` generic parameters, …) live
  in the reference. This page covers what an LLM or a new
  contributor is most likely to land on in their first session.

## Cross-references

- Skill: [`../skills/skmtc-generator/SKILL.md`](../skills/skmtc-generator/SKILL.md) — operational principles for authoring.
- Concept: [`projections-and-snippets.md`](./projections-and-snippets.md) — the DSL vocabulary in depth.
- Concept: [`variants.md`](./variants.md) — the variant axis.
- Reference: [`../reference/glossary.md`](../reference/glossary.md) — formal definitions.
