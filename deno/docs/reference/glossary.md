# Glossary

> Alphabetized terminology with concise definitions and links to fuller
> treatment.

## A

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
by `deno bundle worker.ts -o bundle.js`. Only present when the
project has at least one cloned (local) generator; remote-only
projects use the JSR-published bundle. See [the-worker-runtime](../concepts/the-worker-runtime.md).

### Bundle freshness

The invariant that `bundle.js` matches the current
`deno.json#imports`. Drift triggers a refuse-with-recipe error in
strict-mode `generate`. The `skmtc doctor` check
`project-bundle/<project>` surfaces stale bundles.

## C

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
not expressible through the OAS-derived schema model. Used when
emitting type expressions like `Required<UserBody>` that don't
correspond to a schema definition.

## D

### Definition

The `export const NAME = VALUE;` wrapper around a Projection's
output value. Created automatically by Drivers; rarely instantiated
directly. Technically extends `SnippetBase`; conceptually the bridge
between Projection (unit of output) and File (rendered file).

### `destinationPath`

The file path a Snippet's imports register against. Snippets don't
have their own `exportPath`, so the parent passes `destinationPath`
as a constructor argument. For Projections, equals
`this.settings.exportPath`.

### Driver

The orchestrator class for inserting a Projection. Two flavors:
`OasOperationDriver` and `ModelDriver` (plus `GqlOperationDriver`).
Computes settings, performs cache lookup, instantiates the
Projection on miss, wraps in `Definition`, registers, and stitches
imports. See [cross-generator-coordination](../concepts/cross-generator-coordination.md#the-driver-flow).

## E

### Enrichment

User-supplied per-operation or per-model configuration declared in
`client.json` and validated against a generator's Valibot schema.
Routed by `enrichments[generatorId][projectionKind][operationOrRefId][projectionKey]`.
See [enrichments](../concepts/enrichments.md).

### EntityType

A property of `Identifier` that distinguishes types (`'type'`) from
values (`'const'`). Affects whether imports emit as
`import { X }` or `import { type X }` under `verbatimModuleSyntax`.

### `exportPath`

The file path where a Projection's `Definition` will be written.
Returned by the Projection class's static `toExportPath` method.
Pure function of `(operation, enrichments)`.

## F

### `fallbackName`

The name a Projection uses when the schema being normalized isn't a
named `$ref`. Passed to `insertNormalizedModel` for inline schemas
the engine can't address by refName. See
[cross-generator-coordination cache integrity asymmetries](../concepts/cross-generator-coordination.md#cache-integrity-asymmetries).

### File (DSL class)

The in-memory representation of a generated file in `GenerateContext.#files`.
Holds `imports: Map<module, Set<name>>`, `reExports`,
`definitions: Map<name, Definition>`. Serialized by Render.

## G

### Generator

A JSR package (or local TypeScript directory) implementing the
generator protocol: exports an entry function via
`toOasOperationEntry`, `toGqlOperationEntry`, or `toModelEntry`.
Lives at `@skmtc/gen-*` on JSR or `<project>/<gen-name>/` locally.
See [generators-as-packages](../concepts/generators-as-packages.md).

### Generator key

A composite identifier (typically `generatorId + operation`) used
by `affirmDefinition` to verify cache-hit integrity in the Driver
flow. Mismatch on a cache hit throws
"Registered definition mismatch".

### Global state

`~/.skmtc/` — auth token, shadow project state, schema caches. Lives
outside any project. Check this when local state alone doesn't
explain a failure.

## I

### `Identifier`

A name + entity-type marker. Created via `Identifier.createVariable`
(value, emits `import { X }`) or `Identifier.createType` (type,
emits `import { type X }`). The entity-type tracking is load-bearing
under `verbatimModuleSyntax: true`.

### `include` / `skip` filters

`client.json#settings.include` and `.skip` — operation/model
allow-lists and deny-lists. Each accepts three entry shapes:
whole-generator (string), per-operation (object with paths +
methods), or per-model (object with refNames). Order:
`isSupported` → `include` → `skip`. See
[skmtc-cli skill §7](../skills/skmtc-cli/SKILL.md).

### `insertNormalizedModel`

The projection-base wrapper method that delegates to
`context.insertNormalisedModel`, auto-filling `destinationPath`
from `this.settings.exportPath`. American spelling on the wrapper;
British (`insertNormalisedModel`) on the underlying context
method. Both deliberate.

### `insertOperation`

The projection-base wrapper method that triggers cross-generator
coordination for an operation Projection. Returns an `Inserted<V, E>`
carrying the peer Projection's identifier and Definition.

### `Inserted`

The return type of `insertOperation` and `insertModel`. Carries the
peer's `ContentSettings`, the resulting `Definition`, and helpers
like `.toName()` (returns the peer's identifier name).

### Insertable

Older name for what is now called a Projection. May still appear in
older docs or source comments. Treat as a synonym for Projection.

### `isSupported`

A generator's capability-gate predicate. See "Capability gate".

## L

### Lenient input, strict diagnostics

The error-handling philosophy: parse fails open (one bad item
doesn't kill the run), but every dropped item and every type
inference is logged as a `ParseIssue`. See
[error-handling-philosophy](../concepts/error-handling-philosophy.md).

## M

### Manifest

`manifest.json` — the canonical record of every SKMTC generation
run. Written to `.skmtc/<project>/.settings/manifest.json` after
each `generate` and overwritten per run. See
[manifest-format reference](manifest-format.md).

### `MAX_LOOKUPS`

The constant `10` in `OasRef`. Limits the depth of `$ref` chain
resolution. Throws "Max lookups reached" on exceedance — catches
cycles and pathologically deep chains.

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
`#refErrors` maps for cascade pruning.

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
`OasOperationProjectionBase`, `GqlOperationProjectionBase`. See
[projections-and-snippets](../concepts/projections-and-snippets.md).

### Projection key

The innermost level of the enrichment routing structure —
`enrichments[gen][kind][operationId][projectionKey]`. Discriminates
multiple Projection outputs from the same `(generator, operation)`
combination.

### Projection kind

The second level of the enrichment routing structure. Typically
`"mutation"`, `"query"`, or `"model"` — matches the OAS verb
category or refKind.

## R

### Recipe error

A structured error response from strict-mode CLI commands when a
required argument is missing. Includes Usage, Example, and a
Discover line pointing at the follow-up command for finding valid
values. Exit code 2.

### refConsumers

`ParseContext.#refConsumers: Map<refKey, StackTrail[]>` — every
`$ref` encounter is recorded here. Used during cascade pruning to
identify which items reference a failed schema.

### refErrors

`ParseContext.#refErrors: Map<refKey, unknown[]>` — errors keyed by
the `$ref` they invalidated. Used during cascade pruning.

### refType

A type-parameter property on `OasRef<T>` declaring what kind of
component the ref expects to resolve to (`'schema'`, `'parameter'`,
`'response'`, etc.). Checked at resolve time against the target's
`oasType`.

### Remote-only project

A SKMTC project whose `deno.json#imports` contains only JSR-installed
generators (no local clones). Skips local bundling — uses the
JSR-published `bundle.js` at generate time. `skmtc bundle` reports
`{ kind: 'noop', reason: 'remote-only' }`.

### Render phase

The third engine phase — serializes the file map to
`{ path: content }` artifacts. Pure serialization; does not run
Prettier or any other formatter.

### `RenderContext`

The Render-phase context class. A thin wrapper around file
iteration and `file.toString()`. Does not format output.

### `ResultType`

The leaf-value type in the manifest's `results` tree: one of
`'success' | 'warning' | 'error' | 'skipped' | 'notSupported'`.
See [manifest-format](manifest-format.md#results).

## S

### Sandbox API

A hosted-execution alternative to the local Worker. The host posts
the schema to a remote SKMTC service; the service runs the engine
and returns artifacts + manifest. Authenticated via a stored token.

### Schema source

The OAS or GraphQL document SKMTC generates from. Specified either
positionally on `skmtc generate <project> <source>` or pinned in
`client.json#source`.

### `SkmtcDocumentInput`

A discriminated union: `{ type: 'oas', value: OpenAPIV3.Document }`
or `{ type: 'gql', value: GraphQLSchema | string }`. The Worker
receives this on the `GENERATE` message.

### `SkmtcParsedDocument`

The parsed counterpart to `SkmtcDocumentInput`. Discriminated:
`{ type: 'oas', value: OasDocument }` or `{ type: 'gql', value: GqlDocument }`.

### Snippet

An anonymous, embeddable generated fragment. Extends `SnippetBase`.
Has no `settings`, no exportPath, no cache participation. Embedded
into a Projection via template-literal interpolation. See
[projections-and-snippets](../concepts/projections-and-snippets.md).

### `SnippetBase`

The root class for all DSL elements. Provides `context`,
`generatorKey`, and the `register()` method. Both Projections and
Snippets extend it (directly or via the projection bases).

### `StackTrail`

The location-tracking accumulator threaded through parse and
generate. Stringifies as a colon-separated path
(`paths./users.post.requestBody.content...`). Used for issue
locations.

### Stringable

The interface (loose convention) for anything that has a
`toString()` method and can be interpolated into a template
literal. All `SnippetBase` descendants are Stringable. The composition
mechanism for the DSL.

### Strict mode

CLI behavior when `--no-input` is passed (or stdout is non-TTY) —
no Ink UI, no prompts, required arguments must be provided up
front. Failures produce recipe errors on stderr.

## T

### `transform`

The per-item hook in a generator's `mod.ts` entry. Called once per
matched operation/model. The return value is **discarded**; output
must be produced via `context.insertOperation` or `context.register`.

## V

### `verbatimModuleSyntax`

A TypeScript compiler option (`true` in SKMTC consumer projects
typically) requiring `import { type X }` for type-only imports.
SKMTC's `Identifier` tracks entity types specifically to emit
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
