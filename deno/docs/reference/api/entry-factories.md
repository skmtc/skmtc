# Entry factories

> The three factories that produce a generator's pipeline entry —
> `toOasOperationEntry`, `toGqlOperationEntry`, and `toModelEntry`.
> Each takes a config object and returns a `*Entry` value whose
> `type` discriminator routes it through the dispatcher's matching
> per-protocol loop.

A generator's `src/mod.ts` calls one of these factories and exports
the result as the package default. The exported entry is what the
pipeline iterates over: for every operation (OAS or GQL) or every
schema component (model) it visits — per variant, for
variants-aware generators — the dispatcher invokes the entry's
`transform` callback.

Output is produced by side effects inside `transform`, not by the
return value (`transform` returns `void`) — see
[how-generators-produce-output](../../concepts/how-generators-produce-output.md).

## Source

- `skmtc/deno/core/dsl/operation/oas/toOasOperationEntry.ts` — `OasOperationEntry`
- `skmtc/deno/core/dsl/operation/gql/toGqlOperationEntry.ts` — `GqlOperationEntry`
- `skmtc/deno/core/dsl/model/toModelEntry.ts` — `ModelEntry`

Argument-shape type files:

- `skmtc/deno/core/dsl/operation/oas/types.ts`
- `skmtc/deno/core/dsl/operation/gql/types.ts`
- `skmtc/deno/core/dsl/model/types.ts`

(A fourth flavor exists for OpenAPI 3.1 webhooks — see
[webhook generators](webhook-generators.md).)

## The three factories at a glance

| | `toOasOperationEntry` | `toGqlOperationEntry` | `toModelEntry` |
|---|---|---|---|
| **Iterates** | OAS operations (`oasDocument.operations`) | GQL operations (`gqlDocument.operations`) | Schema components (refNames) |
| **`type` discriminator** | `'oasOperation'` | `'gqlOperation'` | `'model'` |
| **`transform` subject arg** | `operation: OasOperation` | `operation: GqlOperation` | `refName: RefName` |
| **`transform` return** | `void` | `void` | `void` |
| **`isSupported`** | Optional; default `() => true` | Optional; default `() => true` | Optional; default `() => true` (predicate gets `refName`, no `operation`) |
| **Enrichment routing path (projection-base `toEnrichments`)** | `enrichments.<id>.<operation.path>.<operation.method>.<variant>` | `enrichments.<id>.<operation.rootKind>.<operation.fieldName>.<variant>` | `enrichments.<id>.<refName>.<variant>` |
| **Companion projection-base factory (veneer)** | `toTsOasOperationProjectionBase` | `toTsGqlOperationProjectionBase` | `toTsModelProjectionBase` |

The three factories share the same backbone; the differences are
small but consequential. The rest of this page enumerates the
config surface and documents the model asymmetry.

## Common config fields

These appear on all three factories:

### `id: string` (required)

The generator's identifier — by convention the JSR package name read
from the local `deno.json`:

```ts
import denoJson from '../deno.json' with { type: 'json' }

toModelEntry({
  id: denoJson.name,
  // ...
})
```

This `id` is what consumers reference under
`client.json#settings.enrichments[id]` and what appears in the
manifest. It's the lookup key for enrichment routing.

### `transform: ({ context, <operation|refName>, variant }) => void` (required)

The per-item callback. The dispatcher calls it once for every
operation (OAS, GQL) or every schema component (model) — and, for
variants-aware generators, once per declared variant — that the
engine visits. Output is produced **only** through side effects on
`context` (`insertOperation`, `insertModel`,
`insertNormalizedModel`, the lang `register` function) — the return
type is `void` in all three factories.

```ts
transform({ context, operation, variant }) {
  context.insertOperation({ projection: MyProjection, operation, variant })
}
```

Thread `variant` into the insert call when the generator is
variants-aware; omitting it constructs everything as `'main'`.

### `toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>` (required)

A factory returning the Valibot schema for this generator's
`{ subject, generator, stack }` enrichment umbrella. Required (not
optional) — a generator with no enrichments passes
`emptyEnrichmentSchema` from `@skmtc/core`. See
[enrichments](../../concepts/enrichments.md).

```ts
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
})
```

### `supportsVariant?: () => boolean` (optional)

Whether this generator entry supports variants. Defaults to
`() => false` when omitted.

### `toEnrichmentDefaults?: ({ context, <operation|refName>, variant }) => EnrichmentType | undefined` (optional)

Compute the DEFAULT enrichment values for an item from its schema —
the seed the CMS persists and the user then edits. Typically a thin
forward to the projection base's static of the same name
(`toEnrichmentDefaults: MyProjection.toEnrichmentDefaults`) so the
logic has a single home in `base.ts`.

### `toPreviewModule?: ({ context, <operation|refName> }) => PreviewModule` (optional)

Generates an entry for the manifest's `previews` section, which the
Editor UI uses to render previewable artifacts. Omit for generators
whose output isn't meant to be surfaced in the previewer (most
infrastructure generators), include for those that produce a
preview-worthy artifact (forms, tables, types).

```ts
toPreviewModule: ({ context, operation, variant }) => {
  const enrichments = MyProjection.toEnrichments({ operation, context, variant })

  return {
    name: MyProjection.toIdentifierName({ operation, enrichments, variant }),
    exportPath: MyProjection.toExportPath({ operation, enrichments, variant })
  }
}
```

`toIdentifierName` returns the name string directly; `PreviewModule`
is `{ name: string; exportPath: string }`.

### `toEnrichmentRequest?: <R extends EnrichmentType>(operation|refName) => EnrichmentRequest<R> | undefined` (optional)

For the AI-driven enrichment request system. The generator declares
"I'd like enrichment values of *this* shape for *this* operation/
schema" and the enrichment service can respond. Most generators
don't use this. See
[enrichments concept](../../authoring/how-to/add-enrichment-options.md#ai-driven-enrichments--enrichmentrequest).

## All three factories: `isSupported`

```ts
isSupported?: ({
  context,
  operation,
  variant
}: IsSupportedOasOperationArgs) => boolean
```

The capability gate. Returns `true` for operations this generator can
handle, `false` otherwise. Omitting it advertises support for every
operation. The model factory's shape differs only in the subject — see
the model note at the end of this section.

```ts
isSupported({ operation }) {
  return ['post', 'put', 'patch'].includes(operation.method) &&
    operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
}
```

Three rules:

1. **It's a capability claim, not user intent.** Don't gate on
   enrichment *presence* — the right opt-in/opt-out lever is
   `client.json#settings.skip` / `.include`, applied outside the
   generator.
2. **The predicate receives no enrichments.** The args are
   `{ context, operation, variant }` (models:
   `{ context, refName, variant }`) — a gate that needs
   already-authored enrichment values reads them via the projection
   base's `toEnrichments({ operation, context, variant })`.
3. **Other generators can probe it.** The generator's `isSupported`
   is also declared on the projection-base config and re-exposed as
   a static on the projection-base class
   (`MyProjection.isSupported`), so peers can ask "would *that*
   generator handle this operation?" — the foundation of the
   [operation-reference protocol](../../concepts/cross-generator-coordination.md#pattern-operation-reference-consumer-chosen-peer).

**Model entries have an optional `isSupported`, symmetric with
operations.** The three rules above all apply, with one shape
difference: the model predicate receives `{ context, refName,
variant }` (no `operation`) — resolve the schema yourself when the
gate needs it. When omitted it defaults to `() => true`, so every
refName is dispatched. The projection-base static
`MyProjection.isSupported` is probed by `insertModel` (peer
capability), exactly as the operation static is by `insertOperation`.

```ts
isSupported({ context, refName }) {
  const schema = context.resolveSchemaRefOnce(refName, MyBase.id)
  return !schema.isRef() && schema.type === 'object'
}
```

## The GQL `acc`-return contract (removed)

Older cores threaded an accumulator (`acc`) through GQL `transform`
calls and required every branch to `return acc`. That asymmetry is
gone: all three factories now type `transform` as
`({ context, <operation|refName>, variant }) => void` — there is no
accumulator to thread and nothing to return. Historical background:
[the-graphql-asymmetry](../../explanation/the-graphql-asymmetry.md).

## What the factory returns

Each factory returns a `*Entry` value with the same shape as the
config you handed in, plus:

- `type: 'oasOperation' | 'gqlOperation' | 'model'` — the
  discriminator the dispatcher reads to route to the right
  per-protocol loop.
- `isSupported` — always present on a built entry (defaulted to
  `() => true` when omitted).
- `supportsVariant` — always present (defaulted to `() => false`).

The returned shape (from the source types):

```ts
// OAS — operation/oas/toOasOperationEntry.ts
type OasOperationEntry<E = undefined> = {
  id: string
  type: 'oasOperation'
  transform: (args: TransformOasOperationArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<E>
  isSupported: (args: IsSupportedOasOperationArgs) => boolean
  supportsVariant: () => boolean
  toPreviewModule?: (args: ToOasOperationPreviewModuleArgs) => PreviewModule
  toEnrichmentRequest?: <R extends E>(op: OasOperation) => EnrichmentRequest<R> | undefined
  toEnrichmentDefaults?: (args: ToOasOperationEnrichmentsArgs) => E | undefined
}

// GQL — operation/gql/toGqlOperationEntry.ts
// GqlOperationEntry: identical structure, GqlOperation types

// Model — dsl/model/toModelEntry.ts
type ModelEntry<E = undefined> = {
  id: string
  type: 'model'
  transform: (args: TransformModelArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<E>
  isSupported: (args: IsSupportedModelArgs) => boolean   // subject is refName, not operation
  supportsVariant: () => boolean
  toPreviewModule?: (args: ToModelPreviewModuleArgs) => PreviewModule
  toEnrichmentRequest?: <R extends E>(refName: RefName) => EnrichmentRequest<R> | undefined
  toEnrichmentDefaults?: (args: ToModelEnrichmentsArgs) => E | undefined
}
```

## Three complete examples

### OAS operation entry

```ts
// gen-curl/src/mod.ts
import { toOasOperationEntry } from '@skmtc/core'
import { CurlCmd } from './CurlCmd.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

const curlEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  isSupported({ operation }) {
    return true   // every HTTP operation produces a curl command
  },

  transform({ context, operation }) {
    context.insertOperation({ projection: CurlCmd, operation })
  },

  toPreviewModule: ({ context, operation, variant }) => {
    const enrichments = CurlCmd.toEnrichments({ operation, context, variant })

    return {
      name: CurlCmd.toIdentifierName({ operation, enrichments, variant }),
      exportPath: CurlCmd.toExportPath({ operation, enrichments, variant })
    }
  }
})

export default curlEntry
```

### GraphQL operation entry

```ts
// gen-gql-mutation/src/mod.ts
import { toGqlOperationEntry, synthesizeArgsObject } from '@skmtc/core'
import { GqlMutation } from './GqlMutation.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

const gqlMutationEntry = toGqlOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  isSupported({ operation }) {
    return operation.rootKind === 'mutation' &&
      synthesizeArgsObject(operation) !== undefined
  },

  transform({ context, operation }) {
    if (operation.rootKind !== 'mutation') return
    context.insertOperation({ projection: GqlMutation, operation })
  }
})

export default gqlMutationEntry
```

### Model entry

```ts
// gen-meta/src/mod.ts
import { toModelEntry } from '@skmtc/core'
import { MetaProjection } from './MetaProjection.ts'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

const metaEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // Optional capability gate (symmetric with operations). The predicate
  // gets `refName`, not a schema — resolve it yourself. Omit to support
  // every refName.
  isSupported({ context, refName }) {
    const schema = context.resolveSchemaRefOnce(refName, MetaProjection.id)
    return !schema.isRef() && schema.type === 'object'
  },

  transform({ context, refName }) {
    const schema = context.resolveSchemaRefOnce(refName, MetaProjection.id)
    if (schema.isRef() || schema.type !== 'object') return

    context.insertModel(MetaProjection, refName)
  }
})

export default metaEntry
```

### Wrapping the factory to take user options

Some generators accept entry-time configuration (e.g.,
`gen-typescript` accepts a `scalars` map). The pattern is a thin
wrapper that takes options, applies them, and calls the underlying
factory:

```ts
// gen-typescript/src/mod.ts
export const toTypescriptEntry = (options: TypescriptEntryOptions = {}) => {
  if (options.scalars !== undefined) {
    setCustomScalars(options.scalars, { replace: options.replaceScalars })
  }
  return toModelEntry<EnrichmentSchema>({
    id: denoJson.name,
    toEnrichmentSchema,
    transform({ context, refName }) {
      context.insertModel(TsProjection, refName)
    }
  })
}

// Default-config export for backward compatibility
export const typescriptEntry = toTypescriptEntry()
```

This is fine but global: `setCustomScalars` mutates module-scoped
state, so two pipelines in the same process with different scalar
maps would step on each other. Run such pipelines sequentially.

## Relationship to the projection-base factory

`src/mod.ts` (the Entry) and `src/base.ts` (the projection base)
are two different factory calls with overlapping config:

| Config field | Entry (`src/mod.ts`) | Projection base (`src/base.ts`) |
|---|---|---|
| `id` | yes | yes (must match) |
| `transform` | yes | — |
| `isSupported` | yes (all three) | yes (all three) |
| `toEnrichmentSchema` | yes | yes (must match) |
| `toIdentifierName` | — | yes |
| `toIdentifierType` | — | yes |
| `toExportPath` | — | yes |
| `toPreviewModule` | yes | — |
| `toEnrichmentRequest` | yes | — |
| `toEnrichmentDefaults` | yes (typically forwards the base's static) | yes (model and OAS) |
| `supportsVariant` | yes | — |

The two factories don't share code. Both need the `id` and
`toEnrichmentSchema`, so the convention is to declare them once at
the package level (in `deno.json` and `src/enrichments.ts`) and
re-use them. If they drift, the projection base's `toEnrichments`
parsing won't align with the enrichment block the entry's `id`
routes to — a silent bug.

See [projection-bases](projection-bases.md).

## Common questions

### Can the same generator produce both model and operation output?

No, not from a single Entry. Each Entry has one `type` discriminator
and only sees one per-protocol loop. If you need both, export two
Entries — one for each — and list both in the project's
`worker.ts` generator map.

### Can I have multiple Projections for one Entry?

Yes. The Entry's `transform` can call `context.insertOperation` /
`context.insertModel` with as many different Projections as you
like — for the same operation/refName or across multiple. The
typical case is one primary Projection plus auxiliary Snippets
embedded inside it (Snippets don't need their own Entry).

For more complex setups where one Projection should drive several
sibling Projections, the primary's constructor calls
`this.insertOperation(OtherProjection, ...)` itself — the Entry's
`transform` only needs to kick off the primary.

### What's the difference between `id` on the Entry and `id` on the projection base?

Identical in practice. The Entry's `id` is what the dispatcher uses
to route enrichments and label manifest entries. The projection
base's `id` is what `toEnrichments` uses to look up enrichments
under `client.json#settings.enrichments[id]`. Both must match for
enrichment routing to work end-to-end. Most generators import
`denoJson.name` in both places.

### How do `isSupported` and `transform` read enrichments?

Neither receives an enrichment argument — both get
`{ context, <operation|refName>, variant }`. Code that needs the
parsed `{ subject, generator, stack }` umbrella calls the projection
base's static
`MyProjection.toEnrichments({ operation, context, variant })`
(Valibot-parsed against `toEnrichmentSchema`). The Projection
constructor receives the parsed umbrella on
`this.settings.enrichments` when the Driver constructs it.

### What happens when `transform` throws?

The dispatcher catches it, logs to `logger.error`, and marks the
item `'error'` in the manifest. Siblings continue. Throws never
propagate out of the generator's pass.

### Can `transform` be async?

No. `transform` is typed `(...) => void` and the dispatcher invokes
it synchronously (nothing is awaited). Any async work must happen
pre-Generate (typically at config time, or via the
enrichment-request system).

### Does `toEnrichmentRequest` actually fire?

Only when an enrichment service is wired up to the pipeline. Most
local generations don't use it. See
[enrichments concept](../../authoring/how-to/add-enrichment-options.md#ai-driven-enrichments--enrichmentrequest).

## See also

- [API: Projection bases](projection-bases.md) — the sister factory that builds the per-item class
- [API: GenerateContext](generate-context.md) — what `context` inside `transform` exposes
- [Concept: How generators produce output](../../concepts/how-generators-produce-output.md) — why `transform`'s return value is discarded
- [Concept: Generators as packages](../../concepts/generators-as-packages.md) — where `src/mod.ts` sits in the package layout
- [Concept: Enrichments](../../concepts/enrichments.md) — routing paths, parsing, AI-driven requests
- [Concept: Cross-generator coordination](../../concepts/cross-generator-coordination.md) — `isSupported` as capability claim
- [Explanation: The GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md) — why GQL `transform` is different
- [Tutorial 02: Authoring a model generator](../../authoring/tutorials/02-authoring-a-model-generator.md)
- [Tutorial 03: Authoring an operation generator](../../authoring/tutorials/03-authoring-an-operation-generator.md)
- [Tutorial: authoring a model generator](../../authoring/tutorials/02-authoring-a-model-generator.md) — building an entry end to end
