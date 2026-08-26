# Glossary

> Alphabetized terminology with one-line definitions and links to
> fuller treatment.

## Coming from React or other codegen tools

Analogues, not equivalences — landing pads for readers arriving with
React or generic-codegen priors. Once a term lands, switch to the
SKMTC-native definition below; the analogues lose detail.

| Term | ≈ Analogue | The catch |
|---|---|---|
| Projection | An exportable React component | In memory until Render; coordinate by name, not source text |
| Snippet | A JSX expression embedded in a parent | No file-scope name; registers imports against the parent's `destinationPath` |
| `SnippetBase` | The shared base of component and expression | The literal DSL spine — Projections and Snippets both descend from it |
| `toTs*ProjectionBase` factories | Factories returning specialized component base classes | Three flavors — pick by what drives the Definition: refName, OAS operation, or GQL operation |
| `Definition` | The `export const Component = …` wrapper | The Driver adds the `export const`; don't write it in `toString()` |
| `ContentSettings` | A props bag computed before construction | Built from the Projection's static methods, then handed to the constructor |
| `Identifier` | A name + per-language kind | The kind drives declaration keywords and imports under `verbatimModuleSyntax` |
| `Stringable` | Anything with `.toString()` | The composition contract for template-literal interpolation |
| `CustomValue` | An inline TS fragment not from the schema | Wraps hand-written expressions so they compose with the DSL |
| Import | `import { X } from 'y'` | Register via `register({ imports })`; raw `import` lines in templates land in the file body |
| `Driver` | A render function that constructs and mounts | Cache lookup → construct on miss → register Definition and imports |
| `GenerateContext` | A Redux store + React's reconciler | Owns the dispatch loop, file map, manifest results, StackTrail |
| `transform` | A `useEffect` body per `(operation, variant)` | Returns `void`; output happens via `register` / `insert*` calls |
| `isSupported` | A feature-flag check | Capability gate, not user intent — user intent is `include` / `skip` |
| `toIdentifierName` / `toExportPath` | Pure `(name, file)` functions | Must be pure — the cross-generator cache depends on it |
| `toEnrichments` | A `useSelector` keyed to this operation + variant | Walks the enrichment routing hierarchy for its protocol |
| `Inserted` | A `useQuery` result handle | `.toName()` for the identifier; `.settings` and `.definition` for the rest |
| `GeneratorKey` | A composite primary key | Pipe-delimited; compared in `affirmDefinition` to detect collisions |
| `findDefinition` | A cache `.get(key)` | Looks up by `(name, exportPath)`; `undefined` on miss |
| `affirmDefinition` | A cache integrity check | Key mismatch throws "Registered definition mismatch" |
| Cache key vs. `GeneratorKey` | Map key vs. row identity | The cache key is narrower by design; the integrity check catches collisions loudly |
| Variant | A case of "one source item, several artifacts" | Named string axis; `'main'` is always present |
| Variants-aware generator | A component that renders per prop | Folds `variant` into `toIdentifierName`, typically via `withVariant` |
| Variants-unaware generator | A component that ignores the variant prop | Every caller's variant resolves to the shared `'main'` Definition |
| `withVariant(base, variant)` | PascalCase-aware concatenation | `withVariant('Form', 'main')` → `'Form'`; kebab-case variants become PascalCase suffixes |
| `'main'` | The always-present default branch | Engine-guaranteed; filled in when no enrichments are configured |
| Project | A workspace folder for one schema-to-code mapping | Lives at `<root>/.skmtc/<project>/`; not the consumer app |
| `client.json#settings` | A `tsconfig.json`-style config | Carries `basePath`, `source`, `enrichments`, `include`, `skip` |
| `enrichments` | Per-item prop overrides | Routed per protocol: path/method (OAS), rootKind/fieldName (GQL), or refName (models) |
| `basePath` | The `@` alias root in `tsconfig.paths` | Required, relative; must match the consumer bundler's alias |
| `include` | An allow-list | Empty array = no filter |
| `skip` | A deny-list | `skip` wins over `include` |
| `manifest.json` | A build-output manifest like `stats.json` | Read it for diagnostics before guessing |
| Parse phase | A schema → AST step | Lenient input, strict diagnostics |
| Generate phase | The reconcile / render pass | Produces the in-memory `File` map; where every `transform` runs |
| Render phase | Writing the AST out to source files | No formatter runs — consumers format their own output |
| `ParseIssue` | A non-fatal compile warning | Prunes downstream dependents without aborting the run |
| `StackTrail` | A breadcrumb trail | Every issue's location is a trail's `toString` |

## SKMTC vocabulary — load-bearing terms

Every term in this list maps to a specific construct in `@skmtc/core`'s
exported surface. When writing about SKMTC, prefer these terms. Terms
that don't appear here (and aren't in the alphabetized entries below)
likely don't have a referent in the code.

| Category | Terms |
|---|---|
| **Pipeline phases** | Parse, Generate, Render — the three phases `CoreContext` runs in order |
| **Primitive methods on `GenerateContext`** | `register`, `insertOperation`, `insertModel`, `insertNormalizedModel`, `defineAndRegister`, `findDefinition` |
| **DSL nouns** | `File`, `Definition`, `Identifier`, `Snippet`, `Projection`, `Inserted`, `ContentSettings`, `Stringable` |
| **Static-method contracts on projection classes** | `toIdentifierName`, `toIdentifierType`, `toExportPath`, `toEnrichments`, `isSupported` |
| **Driver orchestration classes** | `OasOperationDriver`, `GqlOperationDriver`, `ModelDriver` |

---

## A

### `affirmDefinition`

The Driver-side integrity check on every cache hit: the cached
`Definition`'s `generatorKey` must match the caller's, else it throws
"Registered definition mismatch". See
[files-and-dedup](../concepts/files-and-dedup.md#the-integrity-layer-affirmdefinition--generatorkey).

### Agent-native operation modes

The three modes every state-touching CLI command supports: interactive
(TTY + Ink UI), strict text (non-TTY plain stdout), and strict JSON
(`--json` flag). See [CLI overview](cli/overview.md).

## B

### basePath

The `settings.basePath` field in `client.json`: both the on-disk root
for generated files and the bundler `@` alias root in the consuming
app. See
[projects-and-workspaces](../concepts/projects-and-workspaces.md#basepath-alignment-with-the-consuming-app).

### Bundle

`bundle.js` — the compiled JS file the SKMTC Worker loads, produced by
`deno bundle worker.ts -o bundle.js`. See
[the-worker-runtime](../concepts/the-worker-runtime.md).

### Bundle freshness

The invariant that `bundle.js` matches the current `deno.json#imports`.
Drift triggers a refuse-with-recipe error in strict-mode `generate`;
the `skmtc doctor` check `project-bundle/<project>` surfaces stale
bundles.

## C

### Cache key

The `(identifier.name, exportPath)` pair that looks up a `Definition`
in `File.definitions`; decides *whether* to reuse, while the
[Generator key](#generator-key) decides *that* reuse is safe. See
[files-and-dedup](../concepts/files-and-dedup.md#cache-key-vs-integrity-key).

### Capability gate

A generator's `isSupported({ operation })` predicate deciding whether
it handles a given operation/model; `false` yields a `notSupported`
manifest outcome. See
[anatomy of a generator](../authoring/anatomy-of-a-generator.md).

### Cascade pruning

The `removeErroredItems` mechanism that prunes consumers of a failed
`$ref` from the parsed document, one hop deep. See
[error-handling-philosophy](../explanation/error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems).

### clone-to-customize

The design philosophy: stock generators ship hardcoded values that mark
customization seams; users `skmtc clone` the generator and edit the
source. See [clone-vs-install](../concepts/clone-vs-install.md).

### `ContentSettings`

The `settings` instance property on Projection classes, computed by the
Driver from the Projection's static methods; carries `identifier`,
`exportPath`, and `enrichments` for the current item.

### CustomValue

An escape-hatch Snippet wrapping an arbitrary TypeScript fragment not
expressible through the OAS-derived schema model; the `type: 'custom'`
branch of [`schemaToValueFn`](#schematovaluefn) dispatch. See
[the CustomValue reference](api/dsl-custom-value.md).

## D

### Definition

The `export const NAME = VALUE;` (or `export type NAME = …;`) wrapper
around a Projection's output value, created by Drivers and carrying the
`generatorKey` that feeds [`affirmDefinition`](#affirmdefinition). See
[files-and-dedup](../concepts/files-and-dedup.md).

### Deduplication

The behavior of `register` calls on the same `File`: `imports` dedup
via `Set.add`, `definitions` via `Map.has` first-write-wins,
`reExports` per module-and-entity-type. See
[files-and-dedup](../concepts/files-and-dedup.md#the-dedup-rules).

### `destinationPath`

The file path a Snippet's imports or child definitions register against
— the file being registered *into* right now, as opposed to
[`exportPath`](#exportpath). See
[stringable-composition](../concepts/stringable-composition.md#exportpath-vs-destinationpath).

### Driver

The orchestrator class for inserting a Projection
(`OasOperationDriver`, `GqlOperationDriver`, `ModelDriver`): computes
settings, performs the cache lookup, instantiates on miss or affirms on
hit, registers the `Definition`. See
[files-and-dedup §What Drivers do](../concepts/files-and-dedup.md#what-drivers-do--in-one-sentence-each).

## E

### Eject / adopt

Taking ownership of a generated file (`eject`: rename to drop the
generated suffix, record in `settings.ejected`, generators stop
writing it) and returning it to generation (`adopt`). See
[eject](cli/eject.md) and [adopt](cli/adopt.md).

### Enrichment

User-supplied per-operation or per-model configuration declared in
`client.json` and validated against the generator's Valibot schema from
`toEnrichmentSchema`. See [enrichments](../concepts/enrichments.md).

### `EnrichmentRequest`

A generator-initiated request (`{ prompt, enrichmentSchema, content }`)
for an LLM-fillable enrichment, returned by the optional
`toEnrichmentRequest(refName)`. See
[enrichments §AI-driven enrichments](../authoring/how-to/add-enrichment-options.md#ai-driven-enrichments--enrichmentrequest).

### Entity type (`TsIdentifier.type`)

The per-language declaration discriminant on a language package's
identifier subclass — TypeScript's vocabulary is
`'variable' | 'type' | 'class' | 'interface' | 'namespace'`. See
[stringable-composition](../concepts/stringable-composition.md#identifier-and-entity-kinds).

### `exportPath`

The file path where a Projection's `Definition` lives, returned by the
static `toExportPath`; contrast
[`destinationPath`](#destinationpath). See
[stringable-composition](../concepts/stringable-composition.md#exportpath-vs-destinationpath).

## F

### `fallbackName`

The name a Projection uses when the schema being normalized isn't a
named `$ref`; passed to `insertNormalizedModel` for inline schemas. See
[cross-generator-coordination](../concepts/cross-generator-coordination.md).

### File (DSL class)

The in-memory representation of a generated file: three maps
(`imports`, `reExports`, `definitions`), each with its own dedup rule;
serialized by Render via `file.toString()`. See
[files-and-dedup](../concepts/files-and-dedup.md).

## G

### Gen-map (anchors)

The attribution sidecar an opted-in run writes next to each generated
file, mapping byte ranges of output back to the generator, schema
location, and variant that produced them. Toggled by
`client.json#settings.anchors.enabled` or `--anchors` /
`--no-anchors` on [generate](cli/generate.md).

### Generator

A JSR package (or local TypeScript directory) implementing the
generator protocol: exports an entry function via `toOasOperationEntry`,
`toGqlOperationEntry`, or `toModelEntry`. See
[generators-as-packages](../concepts/generators-as-packages.md).

### Generator key

A branded composite identifier on every `Definition` — four shapes (OAS
operation, GQL operation, model, generator-only) — used by
[`affirmDefinition`](#affirmdefinition) to detect cache-hit collisions.
See
[files-and-dedup](../concepts/files-and-dedup.md#the-generator-key-shapes).

### Global state

`~/.skmtc/` — auth token, shadow project state, schema caches. Lives
outside any project; check it when local state alone doesn't explain a
failure.

## H

### Hub (skmtc-hub)

The hosted service behind `login`, `publish`, `push`, and `pull`:
accounts (users or orgs) own published stacks and the projects that
run them. See
[what-is-skmtc-hub](../explanation/what-is-skmtc-hub.md).

## I

### `Identifier`

Neutral naming data (name + opaque per-language `kind` + `exported` +
`typeName`), created via the language package's `createVariable` /
`createType` factories. See
[stringable-composition](../concepts/stringable-composition.md#identifier-and-entity-kinds).

### `include` / `skip` filters

`client.json#settings.include` and `.skip` — operation/model
allow-lists and deny-lists; filter order is `isSupported` → `include`
→ `skip`. See
[skip or include operations](../using/how-to/skip-or-include-operations.md).

### `insertModel`

The `GenerateContext` method that inserts a model Projection via
`ModelDriver` and returns an [`Inserted`](#inserted). See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#contextinsertoperation-projection-operation--and-contextinsertmodelmyprojection-refname).

### `insertNormalizedModel`

The `GenerateContext` method for inserting a Projection from an
*inline* schema (no `$ref`); calls the projection's
[`schemaToValueFn`](#schematovaluefn) and registers the result under
`fallbackName`. See
[the-type-system](../concepts/the-type-system.md#where-schematovaluefn-is-called-from).

### `insertOperation`

The `GenerateContext` method for inserting an operation Projection (OAS
or GraphQL) via the appropriate Driver; returns an
[`Inserted`](#inserted). See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#contextinsertoperation-projection-operation--and-contextinsertmodelmyprojection-refname).

### `Inserted`

The return type of `insertOperation` and `insertModel`: carries the
peer Projection's `ContentSettings`, its `Definition`, and helpers like
`.toName()`. See
[cross-generator-coordination](../concepts/cross-generator-coordination.md).

### Integrity key

Synonym for [Generator key](#generator-key) in contexts contrasting it
with the [Cache key](#cache-key).

### `isSupported`

A generator's capability-gate predicate. See
[Capability gate](#capability-gate).

## J

### `JsonFile`

Sibling to [`File`](#file-dsl-class) for JSON output: one `content`
field, serialized with `JSON.stringify`, last-write-wins on conflicts.
See
[files-and-dedup §JsonFile](../concepts/files-and-dedup.md#jsonfile--the-sibling-for-json-output).

## L

### Lenient input, strict diagnostics

The error-handling philosophy: parse fails open (one bad item doesn't
kill the run), but every dropped item and type inference is logged as a
`ParseIssue`. See
[error-handling-philosophy](../explanation/error-handling-philosophy.md).

### `List`

The typed list-builder utility in `@skmtc/lang-typescript`
(`ListObject`, `ListArray`, `ListParams`, `ListLines`, plus record and
key-value helpers). See
[stringable-composition §The List builder](../concepts/stringable-composition.md#the-list-builder).

## M

### Manifest

`manifest.json` — the canonical record of every generation run, written
to `.skmtc/<project>/.settings/manifest.json` and overwritten per run.
See [the-manifest](../concepts/the-manifest.md) and the
[manifest-format reference](manifest-format.md).

### `MAX_LOOKUPS`

The constant `10` in `OasRef` limiting `$ref` chain resolution depth;
exceedance throws "Max lookups reached", catching cycles and
pathologically deep chains.

### `modelDepth`

The per-`(generatorId, refName)` counter on `GenerateContext` that
detects self-referential schemas at generate time, letting a `Ref`
Snippet render a deferred form instead of recursing. See
[the-type-system §Handling recursive types](../concepts/the-type-system.md#handling-recursive-types--the-modeldepth-counter).

### `Modifiers`

The `{ required?, nullable?, description? }` triple on every
`TypeSystemValue`; polarity is `required`, not `optional`. See
[the-type-system §Modifiers](../concepts/the-type-system.md#modifiers--required-not-optional).

## O

### `OasRef`

The class representing an OpenAPI `$ref`; constructed during parse with
a live reference to the in-progress document, resolves lazily. See
[refs-and-resolution](../concepts/refs-and-resolution.md).

### `OasSchema`

The discriminated union of schema variant classes (`OasObject`,
`OasArray`, `OasUnion`, the scalar variants, `OasUnknown`) — sibling
classes with a `.type` discriminator, not a class hierarchy.

### `oasType`

The runtime tag on parsed OAS items (`'schema'`, `'parameter'`,
`'response'`, etc.), used by `OasRef.resolveOnce` for the
type-integrity check.

## P

### Parse phase

The first engine phase — converts `SkmtcDocumentInput` to
`SkmtcParsedDocument` under lenient input, strict diagnostics. See
[the-three-phases](../concepts/the-three-phases.md).

### `ParseContext`

The Parse-phase context class: parser state, the issue list, and the
cascade-pruning maps. See
[the ParseContext reference](api/parse-context.md).

### `ParseIssue`

A structured diagnostic entry produced during parse. See
[error-codes](error-codes.md) and the
[manifest format](manifest-format.md).

### Peer-pin check

The pre-flight verification on `skmtc clone` that the cloned
generator's `@skmtc/core` version matches the project's pin; override
with `--force`.

### Preview (manifest)

A manifest entry pairing a `PreviewModule` with a source descriptor,
produced by a generator's optional `toPreviewModule` hook for UI / IDE
tooling. See
[the-manifest](../concepts/the-manifest.md#previews--for-tooling).

### Projection

A named, file-level generated artifact, wrapped in `Definition` and
cached by `(identifier.name, exportPath)`; pull-based — instantiated
only when an `insert*` call asks for it. See
[projections-and-snippets](../concepts/projections-and-snippets.md).

## R

### Recipe error

A structured error from strict-mode CLI commands when a required
argument is missing: Usage, Example, and a Discover line pointing at
the follow-up command. Exit code 2.

### refConsumers

`ParseContext.#refConsumers` — a map recording every `$ref` encounter,
used during cascade pruning to identify consumers of a failed schema.
See [the StackTrail reference](api/stack-trail.md).

### refErrors

`ParseContext.#refErrors` — errors keyed by the `$ref` they
invalidated, used during cascade pruning. See
[the StackTrail reference](api/stack-trail.md).

### `register`

The lowest-level registration method on `GenerateContext`, mutating the
file map at `destinationPath`; the only legitimate way to add imports.
See
[how-generators-produce-output §register](../concepts/how-generators-produce-output.md#contextregister-destinationpath-imports-definitions-reexports-).

### "Registered definition mismatch"

The runtime error thrown by [`affirmDefinition`](#affirmdefinition)
when two different generators land on the same cache key. See
[files-and-dedup §Reading a mismatch error](../concepts/files-and-dedup.md#reading-a-registered-definition-mismatch-error).

### Remote-only project

A SKMTC project whose `deno.json#imports` contains only JSR-installed
generators (no local clones); bundles and generates like any other
project.

### Render phase

The third engine phase — serializes the file map to `{ path: content }`
artifacts; pure serialization, no formatter. See
[the-three-phases](../concepts/the-three-phases.md).

### `RenderContext`

The Render-phase context class: a thin wrapper around file iteration
and `file.toString()`. Does not format output.

### `ResultsHandler`

The log handler that converts `logger.warn` / `logger.error` calls
into manifest `results` leaves — a generator that logs an error
contributes to the results tree without throwing. See
[the-manifest §results](../concepts/the-manifest.md#results--what-happened-per-generator-item-pair).

### `ResultType`

The leaf-value type in the manifest's `results` tree
(`'success' | 'warning' | 'error' | 'skipped' | 'notSupported'`);
`'success'` does not guarantee output — check `files`. See
[manifest-format](manifest-format.md#results).

## S

### Sandbox API

A hosted-execution alternative to the local Worker: the host posts the
schema to a remote SKMTC service, which runs the engine and returns
artifacts + manifest. Authenticated via a stored token.

### Schema source

The OAS or GraphQL document SKMTC generates from — positional on
`skmtc generate <project> <source>` or pinned in `client.json#source`.

### `schemaToValueFn`

The static dispatch every `ModelProjection` class exposes: receives a
schema-plus-context bag and returns a structurally matching
[`TypeSystemValue`](#typesystemvalue). See
[the-type-system](../concepts/the-type-system.md).

### `SkmtcDocumentInput`

A discriminated union — `{ type: 'oas', value }` or
`{ type: 'gql', value }` — that the Worker receives on the `GENERATE`
message.

### `SkmtcParsedDocument`

The parsed counterpart to `SkmtcDocumentInput`:
`{ type: 'oas', value: OasDocument }` or
`{ type: 'gql', value: GqlDocument }`.

### Snippet

An anonymous, embeddable generated fragment: no `settings`, no
`exportPath`, no cache participation; embedded via template-literal
interpolation. See
[projections-and-snippets](../concepts/projections-and-snippets.md).

### `SnippetBase`

The root class for all DSL elements — provides `context`,
`generatorKey`, and `register()`; both Projections and Snippets extend
it.

### Stack (hub)

A published, immutable version of a SKMTC project on the hub —
identity `deno.json#name` (`@account/slug`), addressed by semver.
Produced by [publish](cli/publish.md); hub projects pin one.

### `StackTrail`

The mutable stack of string frames threaded through Parse that tracks
the walker's position; stringifies as a colon-separated path. See
[the StackTrail reference](api/stack-trail.md).

### Strict mode

CLI behavior when `--no-input` is passed (or stdout is non-TTY): no Ink
UI, no prompts, required arguments up front; failures produce recipe
errors on stderr.

### Stringable

The structural type for anything with a `toString(): string` method —
the DSL's composition mechanism via template-literal interpolation. See
[stringable-composition](../concepts/stringable-composition.md).

### `synthesizeArgsObject`

Core helper that turns a `GqlOperation`'s typed argument list into an
`OasObject` schema; returns `undefined` for argument-less operations.
See
[the-graphql-pipeline §synthesizeArgsObject](../concepts/the-graphql-pipeline.md#synthesizeargsobject--turning-arguments-into-a-schema).

## T

### `transform`

The per-item hook in a generator's `mod.ts` entry, called once per
matched `(operation | model, variant)`; returns `void` — output happens
via side effects (`register`, `insert*`). See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#why-transform-returns-nothing).

### `tryParseAt`

The per-item parse-isolation helper: runs a parser callback inside a
`stackTrail.trace`, catches throws, logs an error issue, and returns
`undefined` so the entry is omitted. See
[error-handling-philosophy §Tier 1](../explanation/error-handling-philosophy.md#tier-1-per-item-isolation-via-tryparseat).

### `TypeSystemValue`

The discriminated-union intermediate representation a model generator
produces from an `OasSchema` — twelve structural variants, each
carrying [`Modifiers`](#modifiers). See
[the-type-system](../concepts/the-type-system.md).

## V

### Variant

A named axis below `(operation, method)` / `(rootKind, fieldName)` /
`refName` along which one source item produces *N* Definitions
instead of one (section-edit forms, wizard steps, mock scenarios).
Defaults to `'main'`. See [variants](../concepts/variants.md).

### `verbatimModuleSyntax`

The TypeScript compiler option requiring `import { type X }` for
type-only imports; SKMTC's `Identifier` tracks entity types to render
correct imports under it.

## W

### Webhook

The OpenAPI 3.1 subject for server-initiated calls: structurally an
Operation Object keyed by **name** rather than URL path, with inverted
request/response semantics — a distinct subject (`OasWebhook`), never
routed through an operation generator. See
[webhook generators](api/webhook-generators.md).

### Worker

The sandboxed Deno Worker thread that runs the engine, one-shot per
generate run. See
[the-worker-runtime](../concepts/the-worker-runtime.md).

### `worker.ts`

A derived file in `.skmtc/<project>/worker.ts`, templated from
`deno.json#imports` by `skmtc bundle`; regenerated, not hand-edited.

## Cross-references

- [The three phases](../concepts/the-three-phases.md) — fuller treatment of most terms here
- [Manifest format](manifest-format.md)
- [Error codes](error-codes.md)
