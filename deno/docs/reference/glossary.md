# Glossary

> Alphabetized terminology with concise definitions and links to fuller
> treatment.

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
| **Static-method contracts on projection classes** | `toIdentifier`, `toExportPath`, `toEnrichmentSchema`, `toEnrichments`, `isSupported` |
| **Driver orchestration classes** | `OasOperationDriver`, `GqlOperationDriver`, `ModelDriver` |

### Avoid: words that map to no SKMTC surface

These are generic-codegen verbs picked up from training data. Each
sounds like it might be a SKMTC primitive but is not — `grep
@skmtc/core` for them and you'll get no method, no class, no exported
function. Using them in docs or skill text fabricates a mental model
that doesn't connect to the code.

| Don't write | Write instead (context-dependent) |
|---|---|
| **emit** / **emission** / **emitted** | `register` / Definition registration / `insert`-family call / rendered output |
| **dispatch** (as a SKMTC verb) | `insertOperation` / `insertModel` / `insertNormalizedModel` — name the method |
| **dispatcher** (referring to the engine loop) | `GenerateContext`'s iteration over `(generator × item)` pairs — name the actual class and what it iterates |
| **dispatch on `.type`** (TypeScript discriminator usage) | switch on `.type` / narrow on `.type` |
| **field-type dispatch** (referring to `schemaToField`-style code) | field-type routing |
| **stitch** / **stitched** / **stitching** (referring to import wiring) | `register({ imports, destinationPath })` — name the actual call |
| **weave** / **graft** / **thread** (any cross-File composition) | `insertOperation` / `insertModel` — name the call and what it side-effects |

The mechanical reason for this discipline: when a reader sees "the
dispatcher emits a Definition," they cannot map any clause of that
sentence to an entry point in the code. When they see "`GenerateContext`
iterates and a generator's `transform` calls `context.insertOperation`,
which constructs an `OasOperationDriver` that registers a `Definition`,"
every noun and verb is greppable.

---

## A

### `affirmDefinition`

The Driver-side integrity check that runs on every cache hit
(`core/dsl/model/ModelDriver.ts:124-144`). Confirms the cached
`Definition`'s `generatorKey` matches the caller's current key and
the cached value is an instance of the caller's Projection class.
Mismatch throws "Registered definition mismatch". See
[files-and-dedup](../concepts/files-and-dedup.md#the-integrity-layer-affirmdefinition--generatorkey).

### Agent-native operation modes

The three modes every state-touching CLI command supports: **interactive**
(TTY + Ink UI), **strict text** (non-TTY, plain stdout), **strict JSON**
(`--json` flag, single JSON object on stdout). See
[skmtc-cli skill §3](../skills/skmtc-cli/SKILL.md).

## B

### basePath

The `settings.basePath` field in `client.json`. Two roles in one
value: the on-disk root for generated files AND the bundler `@`
alias root in the consuming app. Must be relative; absolute paths
are rejected at `init` time. See [projects-and-workspaces](../concepts/projects-and-workspaces.md#basepath-alignment-with-the-consuming-app).

### Bundle

`bundle.js` — the compiled JS file the SKMTC Worker loads. Produced
by `deno bundle worker.ts -o bundle.js`. Every project builds one —
remote-only projects included; `jsr:` specifiers resolve through the
project's import map at bundle time. See [the-worker-runtime](../concepts/the-worker-runtime.md).

### Bundle freshness

The invariant that `bundle.js` matches the current
`deno.json#imports`. Drift triggers a refuse-with-recipe error in
strict-mode `generate`. The `skmtc doctor` check
`project-bundle/<project>` surfaces stale bundles.

## C

### Cache key

The `(identifier.name, exportPath)` pair used to look up a
`Definition` in `File.definitions`. Both halves are pure
functions of `(operation, enrichments)` via the Projection's
static `toIdentifier` and `toExportPath`. Decides *whether* to
reuse a cached Definition. Distinct from the [Generator key](#generator-key),
which decides *that* reuse is safe. See
[cross-generator-coordination](../concepts/cross-generator-coordination.md)
and [files-and-dedup](../concepts/files-and-dedup.md#cache-key-vs-integrity-key).

### Capability gate

A generator's `isSupported({ operation })` predicate that decides
whether the generator handles a given operation/model. Returning
`false` results in a `notSupported` outcome in the manifest. See
[skmtc-generator skill §6 scaffold C](../skills/skmtc-generator/SKILL.md).

### Cascade pruning

The mechanism in `removeErroredItems` whereby consumers of a failed
`$ref` are pruned from the parsed document. One hop deep — transitive
consumers fail later at generate time. See
[error-handling-philosophy](../concepts/error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems).

### clone-to-customize

The design philosophy: stock generators ship with hardcoded values
that mark customization seams. Users `skmtc clone` the generator
into their project and edit the source. No "configure the stock
one harder." See [clone-vs-install](../concepts/clone-vs-install.md).

### `ContentSettings`

The instance property `settings` on Projection classes, computed by
the Driver from the Projection's static methods. Carries
`identifier`, `exportPath`, and `enrichments` for the current item.

### CustomValue

An escape-hatch Snippet that wraps an arbitrary TypeScript fragment
not expressible through the OAS-derived schema model. Used for
type expressions like `Required<UserBody>` that don't correspond
to a schema definition. Participates in
[`schemaToValueFn`](#schematovaluefn) dispatch as the
`type: 'custom'` branch, where it typically passes through
unchanged.

## D

### Definition

The `export const NAME = VALUE;` (or `export type NAME = …;`)
wrapper around a Projection's output value. Created automatically
by Drivers; rarely instantiated directly. Carries a
`generatorKey` populated by the Driver, which feeds the
[`affirmDefinition`](#affirmdefinition) integrity check. Technically
extends `SnippetBase`. See
[files-and-dedup](../concepts/files-and-dedup.md).

### Deduplication

The behavior of `register` calls on the same `File`: `imports`
dedup via `Set.add`, `definitions` dedup via `Map.has`
(first-write-wins), `reExports` dedup per-module-and-entity-type.
The [`affirmDefinition`](#affirmdefinition) integrity check sits
on top of the `Map.has` gate to catch silent name collisions
between different generators. See
[files-and-dedup](../concepts/files-and-dedup.md#the-dedup-rules).

### `destinationPath`

The file path a Snippet's imports or child definitions register
against — the file *being registered into* right now. Snippets
don't have their own `exportPath`, so the parent passes
`destinationPath` as a constructor argument. For Projections,
equals `this.settings.exportPath` when registering the
Projection's own `Definition`. See
[stringable-composition](../concepts/stringable-composition.md#exportpath-vs-destinationpath).

### Driver

The orchestrator class for inserting a Projection. Three flavors:
`OasOperationDriver`, `GqlOperationDriver`, `ModelDriver`. The
constructor computes settings via the Projection's static methods,
performs the cache lookup keyed on
`(identifier.name, exportPath)`, instantiates the Projection on
miss (or runs [`affirmDefinition`](#affirmdefinition) on hit),
wraps the value in a `Definition`, calls `context.register`, and
registers an import if `destinationPath` differs from `exportPath`.
See [files-and-dedup §What Drivers do](../concepts/files-and-dedup.md#what-drivers-do--in-one-sentence-each)
and [cross-generator-coordination](../concepts/cross-generator-coordination.md).

## E

### Enrichment

User-supplied per-operation or per-model configuration declared in
`client.json` and validated against a generator's Valibot schema.
Routing keys depend on the projection-base factory: OAS operations
use `[generatorId][operation.path][operation.method]`, models use
`[generatorId][refName]`, GraphQL operations use
`[generatorId][rootKind][fieldName]`. Core owns the routing
hierarchy; the *leaf shape* is owned by the generator's
`toEnrichmentSchema`. See [enrichments](../concepts/enrichments.md).

### `EnrichmentRequest`

A generator-initiated request for an LLM-fillable enrichment.
Shape: `{ prompt, enrichmentSchema, content }`. The generator's
optional `toEnrichmentRequest(refName)` returns one of these;
host AI tooling fulfils the request and persists the result into
`client.json`. The same Valibot schema validates the LLM's output
that would validate a user-authored value — the AI path doesn't
bypass validation, it just defers the author. See
[enrichments §AI-driven enrichments](../concepts/enrichments.md#ai-driven-enrichments--enrichmentrequest).

### EntityType

A property of `Identifier` that distinguishes types (`'type'`) from
values (`'variable'` — the discriminator value; the rendered TS
declaration keyword is `const`). Determines whether imports render
as `import { X }` or `import { type X }` under
`verbatimModuleSyntax`. See
[stringable-composition](../concepts/stringable-composition.md#identifier-and-entity-type).

### `exportPath`

The file path where a Projection's `Definition` *lives* — the
file the `export const X = ...` is written into. Returned by the
Projection class's static `toExportPath`. Pure function of
`(operation, enrichments)`. Contrast with
[`destinationPath`](#destinationpath), the file being registered
into right now. See
[stringable-composition](../concepts/stringable-composition.md#exportpath-vs-destinationpath).

## F

### `fallbackName`

The name a Projection uses when the schema being normalized isn't a
named `$ref`. Passed to `insertNormalizedModel` for inline schemas
the engine can't address by refName. See
[cross-generator-coordination](../concepts/cross-generator-coordination.md).

### File (DSL class)

The in-memory representation of a generated file in
`GenerateContext.#files`. Holds three maps:
`imports: Map<module, Set<name>>`,
`reExports: Map<module, { variable, type }>`, and
`definitions: Map<name, Definition>`. Each map has its own dedup
rule. Serialized by Render via `file.toString()`, which joins
re-exports → imports → definitions. See
[files-and-dedup](../concepts/files-and-dedup.md).

## G

### Generator

A JSR package (or local TypeScript directory) implementing the
generator protocol: exports an entry function via
`toOasOperationEntry`, `toGqlOperationEntry`, or `toModelEntry`.
Lives at `@skmtc/gen-*` on JSR or `<project>/<gen-name>/` locally.
See [generators-as-packages](../concepts/generators-as-packages.md).

### Generator key

A branded composite identifier on every `Definition`, used by
[`affirmDefinition`](#affirmdefinition) to detect cache-hit
collisions where different generator-and-input pairs landed on the
same `(name, exportPath)` cache key. Four shapes:

| Shape | Format |
|---|---|
| `OasOperationGeneratorKey` | `<generatorId>\|<path>\|<method>` |
| `GqlOperationGeneratorKey` | `<generatorId>\|<rootKind>\|<fieldName>` |
| `ModelGeneratorKey` | `<generatorId>\|<refName>` |
| `GeneratorOnlyKey` | `<generatorId>` |

Mismatch on a cache hit throws "Registered definition mismatch".
Distinct from the [Cache key](#cache-key). See
[files-and-dedup](../concepts/files-and-dedup.md#the-four-generator-key-shapes).

### Global state

`~/.skmtc/` — auth token, shadow project state, schema caches. Lives
outside any project. Check this when local state alone doesn't
explain a failure.

## I

### `Identifier`

A name + entity-type marker. Created via `Identifier.createVariable`
(value; renders as `import { X }`) or `Identifier.createType`
(type; renders as `import { type X }`). The entity-type tracking is
load-bearing under `verbatimModuleSyntax: true`. See
[stringable-composition](../concepts/stringable-composition.md#identifier-and-entity-type).

### `include` / `skip` filters

`client.json#settings.include` and `.skip` — operation/model
allow-lists and deny-lists. Each accepts three entry shapes:
whole-generator (string), per-operation (object with paths +
methods), or per-model (object with refNames). Order:
`isSupported` → `include` → `skip`. See
[skmtc-cli skill §7](../skills/skmtc-cli/SKILL.md).

### `insertModel`

The `GenerateContext` method that inserts a model Projection.
Delegates to `ModelDriver`. Returns an `Inserted<V, E>` carrying
the peer's identifier and `Definition`. See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#contextinsertoperationmyprojection-op-and-contextinsertmodelmyprojection-refname).

### `insertNormalizedModel`

`GenerateContext` method for inserting a Projection from an
*inline* schema (one without a `$ref`). If the schema is a ref,
delegates to `insertModel`. Otherwise calls the projection's
[`schemaToValueFn`](#schematovaluefn), wraps the result in a
`Definition` under `fallbackName`, and registers it. The
projection-base wrapper of the same name auto-fills
`destinationPath` from `this.settings.exportPath`. See
[the-type-system](../concepts/the-type-system.md#where-schematovaluefn-is-called-from)
and [how-generators-produce-output](../concepts/how-generators-produce-output.md#contextinsertnormalizedmodelmyprojection-schema-fallbackname-destinationpath).

### `insertOperation`

`GenerateContext` method for inserting an operation Projection
(OAS or GraphQL). Delegates to the appropriate Driver. Returns
an `Inserted<V, E>` carrying the peer Projection's identifier and
`Definition`. See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#contextinsertoperationmyprojection-op-and-contextinsertmodelmyprojection-refname).

### `Inserted`

The return type of `insertOperation` and `insertModel`. Carries the
peer Projection's `ContentSettings`, the resulting `Definition`,
and helpers like `.toName()` (returns the peer's identifier name —
useful for interpolating into the caller's template). See
[cross-generator-coordination](../concepts/cross-generator-coordination.md).

### Insertable

Older name for what is now called a Projection. May still appear in
older docs or source comments. Treat as a synonym for Projection.

### Integrity key

Synonym for [Generator key](#generator-key) in contexts
contrasting it with the [Cache key](#cache-key). The integrity key
is what [`affirmDefinition`](#affirmdefinition) checks.

### `isSupported`

A generator's capability-gate predicate. See
[Capability gate](#capability-gate).

## J

### `JsonFile`

Sibling to [`File`](#file-dsl-class) for non-code output
(`package.json`, manifests, route configs). One field: `content:
Record<string, unknown>`. Serialized by
`JSON.stringify(content, null, 2)`. Last-write-wins on conflicts;
no dedup story like `File`'s. See
[files-and-dedup §JsonFile](../concepts/files-and-dedup.md#jsonfile--the-sibling-for-json-output).

## L

### Lenient input, strict diagnostics

The error-handling philosophy: parse fails open (one bad item
doesn't kill the run), but every dropped item and every type
inference is logged as a `ParseIssue`. See
[error-handling-philosophy](../concepts/error-handling-philosophy.md).

### `List`

The typed list-builder utility in
`core/typescript/List.ts`. Typed bookend styles
(`ListObject = {…}`, `ListArray = […]`, `ListParams = (…)`,
`ListLines = \n-joined`), `skipEmpty` rendering, automatic
`undefined`-filtering, and helpers `toRecord`,
`toFilteredRecord`, `toKeyValue`, `fromKeys`, `fromEntries`.
Heavy-use composition primitive across stock generators. See
[stringable-composition §The List builder](../concepts/stringable-composition.md#the-list-builder).

## M

### Manifest

`manifest.json` — the canonical record of every SKMTC generation
run. Written to `.skmtc/<project>/.settings/manifest.json` after
each `generate` and overwritten per run. Carries `files`,
`results`, `previews`, `mappings`, `parseIssues`, and run-
correlation IDs (`deploymentId`, `traceId`, `spanId`). The CLI
exit code derives from `parseIssues`. See
[the-manifest concept](../concepts/the-manifest.md) for what each
section is for; [manifest-format reference](manifest-format.md)
for the Valibot schema.

### Mapping (manifest)

A manifest entry pairing a `MappingModule`
(`{ name, exportPath, schema }`) with a source descriptor
(`OasOperationSource | GqlOperationSource | ModelSource`).
Produced by a generator's optional `toMappingModule` hook;
consumed by SKMTC UI / IDE tooling to declare input adapters or
formatters tied to a specific schema type. See
[the-manifest](../concepts/the-manifest.md#previews-and-mappings--for-tooling).

### `MAX_LOOKUPS`

The constant `10` in `OasRef`. Limits the depth of `$ref` chain
resolution. Throws "Max lookups reached" on exceedance — catches
cycles and pathologically deep chains.

### `modelDepth`

A `Record<string, number>` on `GenerateContext` that brackets
model rendering to detect self-referential schemas at generate
time. Reset to 0 by `ModelDriver` at the start and end of every
Driver invocation; incremented to 1 by
`context.resolveSchemaRefOnce(refName, generatorId)` when a
model Projection's constructor reads its own schema. A `Ref`
Snippet that finds `modelDepth[`${generatorId}:${refName}`] > 0`
knows it's looking at a self-reference and renders a deferred
form (`z.lazy(() => Name)` in Zod, bare identifier in
TypeScript) instead of recursing into a new Driver. See
[the-type-system §Handling recursive types](../concepts/the-type-system.md#handling-recursive-types--the-modeldepth-counter).
Distinct from [`MAX_LOOKUPS`](#max_lookups), which is the
parse-time `$ref`-chain depth limit on `OasRef`.

### `Modifiers`

The `{ required?, nullable?, description? }` triple carried by
every `TypeSystemValue`. Polarity is `required` (not `optional`)
— matching OAS field-requirement semantics. The reflex `!modifiers.optional`
check is wrong; the correct check is `if (!modifiers.required)`.
See [the-type-system §Modifiers](../concepts/the-type-system.md#modifiers--required-not-optional).

## O

### `OasRef`

The class representing an OpenAPI `$ref`. Constructed during parse
with a live reference to the in-progress parsed document; resolves
lazily. See [refs-and-resolution](../concepts/refs-and-resolution.md).

### `OasSchema`

The discriminated union of schema variant classes: `OasObject`,
`OasArray`, `OasUnion`, `OasString`, `OasInteger`, `OasNumber`,
`OasBoolean`, `OasUnknown`. **Not a class hierarchy** — sibling
classes with duck-typed `.isRef()` and `.type` discriminator.

### `oasType`

The runtime tag on parsed OAS items (`'schema'`, `'parameter'`,
`'response'`, etc.). Used by `OasRef.resolveOnce` for the
type-integrity check.

## P

### Parse phase

The first engine phase — converts `SkmtcDocumentInput` to
`SkmtcParsedDocument`. Lenient input, strict diagnostics. See
[the-three-phases](../concepts/the-three-phases.md).

### `ParseContext`

The Parse-phase context class. Holds the parser state, the issue
list, the protocol-specific document, and the `#refConsumers` /
`#refErrors` maps for cascade pruning. See
[reference/api/parse-context](api/parse-context.md).

### `ParseIssue`

A structured diagnostic entry produced during parse. See
[error-codes](error-codes.md) for the type values and the
[manifest format](manifest-format.md) for the structure.

### Peer-pin check

The pre-flight verification on `skmtc clone` that the cloned
generator's `@skmtc/core` version matches the project's pin. Catches
peer-dep skew before any state mutation. Override with `--force`.

### Projection

A named, file-level generated artifact. Wrapped in `Definition`.
Cached by `(identifier.name, exportPath)` in the cross-generator
coordination layer. Three projection bases: `ModelProjectionBase`,
`OasOperationProjectionBase`, `GqlOperationProjectionBase`.
**Pull-based**: a Projection is instantiated only when someone
calls `insertOperation` / `insertModel` / `insertNormalizedModel`
on it; defining the class is not enough to trigger construction.
See [projections-and-snippets](../concepts/projections-and-snippets.md)
and [how-generators-produce-output](../concepts/how-generators-produce-output.md).

### Preview (manifest)

A manifest entry pairing a `PreviewModule` (`{ name, exportPath }`)
with a source descriptor
(`OasOperationSource | GqlOperationSource | ModelSource`).
Produced by a generator's optional `toPreviewModule` hook;
consumed by SKMTC UI / IDE tooling to render "this artifact was
generated from that operation/model." See
[the-manifest](../concepts/the-manifest.md#previews-and-mappings--for-tooling).

## R

### Recipe error

A structured error response from strict-mode CLI commands when a
required argument is missing. Includes Usage, Example, and a
Discover line pointing at the follow-up command for finding valid
values. Exit code 2.

### refConsumers

`ParseContext.#refConsumers: Map<refKey, StackTrail[]>` — every
`$ref` encounter is recorded here. Used during cascade pruning to
identify which items reference a failed schema. The stored trails
are clones; see [the-stack-trail §clone-on-store](../concepts/the-stack-trail.md#the-clone-on-store-rule).

### refErrors

`ParseContext.#refErrors: Map<refKey, unknown[]>` — errors keyed by
the `$ref` they invalidated. Used during cascade pruning.
Populated automatically from `stackTrail.toStackRef()` when an
error is logged at a component position. See
[the-stack-trail §toStackRef](../concepts/the-stack-trail.md#tostackref-the-address-bridge).

### `register`

The lowest-level registration method on `GenerateContext`. Mutates
the file map at `destinationPath`: `imports` merge into a `Set`,
`definitions` insert via `Map.has` first-write-wins, `reExports`
merge per module-and-entity-type. The only legitimate way to add
imports — inline `import` lines in template literals bypass dedup
and land in the file body. See
[how-generators-produce-output §register](../concepts/how-generators-produce-output.md#contextregister-destinationpath-imports-definitions-reexports).

### "Registered definition mismatch"

The runtime error thrown by [`affirmDefinition`](#affirmdefinition)
when two different generators land on the same
`(identifier.name, exportPath)` cache key. The error message names
both keys; the second key reveals which other generator collided.
See [files-and-dedup §Reading a mismatch error](../concepts/files-and-dedup.md#reading-a-registered-definition-mismatch-error).

### Remote-only project

A SKMTC project whose `deno.json#imports` contains only JSR-installed
generators (no local clones). Bundles and generates like any other
project — `skmtc bundle` compiles the JSR-resolved generators into
the project-local `bundle.js` that `generate` loads.

### Render phase

The third engine phase — serializes the file map to
`{ path: content }` artifacts. Pure serialization; does not run
Prettier or any other formatter.

### `RenderContext`

The Render-phase context class. A thin wrapper around file
iteration and `file.toString()`. Does not format output.

### `ResultsHandler`

A Deno log handler attached to the pipeline's logger that converts
`logger.warn` / `logger.error` calls into manifest `results` leaves
(`'warning'` / `'error'`). This is why a generator that *logs* an
error contributes to the results tree even if it doesn't throw.
See [the-manifest §results](../concepts/the-manifest.md#results--what-happened-per-generator-item-pair).

### `ResultType`

The leaf-value type in the manifest's `results` tree: one of
`'success' | 'warning' | 'error' | 'skipped' | 'notSupported'`.
`'success'` means "transform executed without throwing" — it
does **not** guarantee output was produced (check `files` for
that). See [the-manifest](../concepts/the-manifest.md#results--what-happened-per-generator-item-pair)
and [manifest-format](manifest-format.md#results).

## S

### Sandbox API

A hosted-execution alternative to the local Worker. The host posts
the schema to a remote SKMTC service; the service runs the engine
and returns artifacts + manifest. Authenticated via a stored token.

### Schema source

The OAS or GraphQL document SKMTC generates from. Specified either
positionally on `skmtc generate <project> <source>` or pinned in
`client.json#source`.

### `schemaToValueFn`

The static-method dispatch every `ModelProjection` class must
expose. Signature
`<Schema>(args: TypeSystemArgs<Schema>) => TypeSystemOutput<Schema['type']>`.
Receives a schema-plus-context bag and returns a structurally-
matching [`TypeSystemValue`](#typesystemvalue). Each model
generator implements the full dispatch over the `OasSchema`
variants itself; there is no default visitor. Called by
`context.insertNormalizedModel` for inline schemas, and by the
generator's own constructor for top-level rendering. See
[the-type-system](../concepts/the-type-system.md).

### `SkmtcDocumentInput`

A discriminated union: `{ type: 'oas', value: OpenAPIV3.Document }`
or `{ type: 'gql', value: GraphQLSchema | string }`. The Worker
receives this on the `GENERATE` message.

### `SkmtcParsedDocument`

The parsed counterpart to `SkmtcDocumentInput`. Discriminated:
`{ type: 'oas', value: OasDocument }` or `{ type: 'gql', value: GqlDocument }`.

### Snippet

An anonymous, embeddable generated fragment. Extends `SnippetBase`.
Has no `settings`, no `exportPath`, no cache participation.
Embedded into a Projection via template-literal interpolation.
Receives `destinationPath` from the parent as a constructor
argument. See
[projections-and-snippets](../concepts/projections-and-snippets.md)
and [stringable-composition](../concepts/stringable-composition.md).

### `synthesizeArgsObject`

Core helper that turns a `GqlOperation`'s typed argument list
into an `OasObject` representing the arguments as a schema. Each
argument becomes a property; arguments with `required: true` and
no default value land on the parent's `required` list. Returns
`undefined` for operations that take no arguments. Lives in core
(`core/gql/operation/synthesizeArgsObject.ts`) so any GraphQL
operation generator can route args through the same
schema-rendering path as other types. See
[the-graphql-pipeline §synthesizeArgsObject](../concepts/the-graphql-pipeline.md#synthesizeargsobject--turning-arguments-into-a-schema).

### `SnippetBase`

The root class for all DSL elements. Provides `context`,
`generatorKey`, and the `register()` method. Both Projections and
Snippets extend it (directly or via the projection bases).

### `StackTrail`

The mutable, ordered stack of string frames threaded through Parse
that tracks the walker's current position. Stringifies as a colon-
separated path (`paths:/users:post:requestBody...`). Embedded
colons in a segment are URL-encoded as `%3A`. Three responsibilities:
*locate* (every `ParseIssue.location` is a trail's `toString`),
*address* (consumer trails feed cascade pruning), *bridge*
(`toStackRef` converts component-position trails to `$ref`
strings). See [the-stack-trail](../concepts/the-stack-trail.md).

### Stringable

The structural type alias for anything with a `toString(): string`
method. The composition mechanism for the DSL: template-literal
interpolation calls `toString()` on every interpolated value,
recursively. All `SnippetBase` descendants, every `List`, `Identifier`,
`EntityType`, `Definition`, and `CustomValue` are Stringable. See
[stringable-composition](../concepts/stringable-composition.md).

### Strict mode

CLI behavior when `--no-input` is passed (or stdout is non-TTY) —
no Ink UI, no prompts, required arguments must be provided up
front. Failures produce recipe errors on stderr.

## T

### `transform`

The per-item hook in a generator's `mod.ts` entry. Called once per
matched operation/model by `GenerateContext`'s iteration. The return value is
folded into the `acc` accumulator threaded between iterations and
discarded after the final iteration. **Output must be produced via
side effects** — `context.register`, `context.insertOperation`,
`context.insertModel`, or `context.insertNormalizedModel`.
Returning a `Definition` from `transform` produces no output. See
[how-generators-produce-output](../concepts/how-generators-produce-output.md#why-transforms-return-is-folded-but-discarded).

### `tryParseAt`

The per-item parse-isolation helper
(`core/context/tryParseAt.ts`). Runs a parser callback inside
`stackTrail.trace(key, ...)`, catches throws, logs an error issue
at the child position (via a re-trace), and returns `undefined` so
the offending entry is silently omitted from the parent's output.
See [error-handling-philosophy §Tier 1](../concepts/error-handling-philosophy.md#tier-1-per-item-isolation-via-tryparseat).

### `TypeSystemValue`

The discriminated-union intermediate representation a model
generator produces from an `OasSchema`. Twelve variants
(`TypeSystemString`, `TypeSystemArray`, `TypeSystemObject`,
`TypeSystemUnion`, `TypeSystemRef`, `TypeSystemCustom`, etc.) —
structural types, not a class hierarchy. Each variant carries
[`Modifiers`](#modifiers). Stock-generator variant classes
(`TsString`, `ZodObject`, …) satisfy `TypeSystemValue` *and*
implement [`Stringable`](#stringable) so the same instance is both
typed IR and a renderable Snippet. See
[the-type-system](../concepts/the-type-system.md).

## V

### `verbatimModuleSyntax`

A TypeScript compiler option (`true` in SKMTC consumer projects
typically) requiring `import { type X }` for type-only imports.
SKMTC's `Identifier` tracks entity types specifically to render
correct imports under this setting.

## W

### Worker

The sandboxed Deno Worker thread that runs the engine. One-shot per
generate run. Permissions: `read: true`, `write: true`, `env: true`,
`net: false`, `run: false`. See
[the-worker-runtime](../concepts/the-worker-runtime.md).

### `worker.ts`

A derived file in `.skmtc/<project>/worker.ts`. Templated from
`deno.json#imports` by `skmtc bundle`. Regenerated; not hand-edited.
Imports each generator and passes them to `@skmtc/worker`'s `worker`
function.

## Cross-references

- [Concept docs](../concepts/) — fuller treatment of most terms here
- [Skills](../skills/) — operational guidance using these terms
- [llms.md](../llms.md) — consolidated operational reference
- [Manifest format](manifest-format.md)
- [Error codes](error-codes.md)
