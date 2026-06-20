# Entry factories

> The three factories that produce a generator's pipeline entry —
> `toOasOperationEntry`, `toGqlOperationEntry`, and `toModelEntry`.
> Each takes a config object and returns a `*Config` value whose
> `type` discriminator routes it through the dispatcher's matching
> per-protocol loop.

A generator's `src/mod.ts` calls one of these factories and exports
the result as the package default. The exported config is what the
pipeline iterates over: for every operation (OAS or GQL) or every
schema component (model) it visits, the dispatcher invokes the
config's `transform` callback and folds the return into `acc`.

Output is produced by side effects inside `transform`, not by the
return value — see
[how-generators-produce-output](../../concepts/how-generators-produce-output.md).

## Source

- `skmtc/deno/core/dsl/operation/oas/toOasOperationEntry.ts`
- `skmtc/deno/core/dsl/operation/gql/toGqlOperationEntry.ts`
- `skmtc/deno/core/dsl/model/toModelEntry.ts`

Type files:

- `skmtc/deno/core/dsl/operation/oas/types.ts` — `OasOperationConfig`
- `skmtc/deno/core/dsl/operation/gql/types.ts` — `GqlOperationConfig`
- `skmtc/deno/core/dsl/model/types.ts` — `ModelConfig`

## The three factories at a glance

| | `toOasOperationEntry` | `toGqlOperationEntry` | `toModelEntry` |
|---|---|---|---|
| **Iterates** | OAS operations (`oasDocument.operations`) | GQL operations (`gqlDocument.operations`) | Schema components (refNames) |
| **`type` discriminator** | `'oasOperation'` | `'gqlOperation'` | `'model'` |
| **`transform` second arg** | `operation: OasOperation` | `operation: GqlOperation` | `refName: RefName` |
| **`acc` semantics** | Threaded but typically ignored; safe to omit `return acc` | Threaded and **must be returned** | Threaded but typically ignored |
| **`isSupported`** | Optional; default `() => true` | Optional; default `() => true` | Optional; default `() => true` (predicate gets `refName`, no `operation`) |
| **Enrichment routing path** | `enrichments.<id>.<operation.path>.<operation.method>.<variant>` | `enrichments.<id>.<operation.rootKind>.<operation.fieldName>.<variant>` | `enrichments.<id>.<refName>.<variant>` |
| **`isSupported` enrichments pre-resolved** | Yes, via Valibot parse | Yes, via Valibot parse | Yes, via Valibot parse |
| **Companion projection-base factory** | `toOasOperationProjectionBase` | `toGqlOperationProjectionBase` | `toModelProjectionBase` |

The three factories share the same backbone; the differences are
small but consequential. The rest of this page enumerates the
config surface, calls out the GQL-specific contract, and documents
the model asymmetry.

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

### `transform: ({ context, <operation|refName>, acc }) => Acc` (required)

The per-item callback. The dispatcher calls it once for every
operation (OAS, GQL) or every schema component (model) the engine
visits. Output is produced **only** through side effects on `context`
(`register`, `insertOperation`, `insertModel`,
`insertNormalizedModel`) — the return value is folded into `acc` for
the next iteration but never persisted as artifacts.

```ts
transform({ context, operation }) {
  context.insertOperation({ projection: MyProjection, operation })
}
```

- **OAS**: return value ignored in practice; omit `return acc` freely.
- **GQL**: **must** return `acc` to keep the accumulator threaded — see [`acc` contract](#the-gql-acc-return-contract) below.
- **Model**: return value ignored in practice.

### `toEnrichmentSchema?: () => v.GenericSchema<EnrichmentType>` (optional)

A factory returning the Valibot schema for this generator's
enrichment payload. Omit when the generator has no enrichments — the
factory defaults to `v.undefined()` and any payload parses as
`undefined`. See [enrichments](../../concepts/enrichments.md).

```ts
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'

toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
})
```

The schema's root **is** the enrichment payload — don't wrap it in
an extra named object.

### `toPreviewModule?: ({ context, <operation|refName> }) => PreviewModule` (optional)

Generates an entry for the manifest's `previews` section, which the
Editor UI uses to render previewable artifacts. Omit for generators
whose output isn't meant to be surfaced in the previewer (most
infrastructure generators), include for those that produce a
preview-worthy artifact (forms, tables, types).

```ts
toPreviewModule: ({ operation, enrichments }) => ({
  name: MyProjection.toIdentifier({ operation, enrichments }).name,
  exportPath: MyProjection.toExportPath({ operation, enrichments }),
  group: 'forms'
})
```

### `toMappingModule?: ({ context, <operation|refName> }) => MappingModule` (optional)

Generates an entry for the manifest's `mappings` section.
[Mappings](../glossary.md#mapping) link generator output back to
source schemas for tooling purposes. Stock generators mostly omit
this; supply it when integrating with an external mapping consumer.

### `toEnrichmentRequest?: <R extends EnrichmentType>(operation|refName) => EnrichmentRequest<R> | undefined` (optional)

For the AI-driven enrichment request system. The generator declares
"I'd like enrichment values of *this* shape for *this* operation/
schema" and the enrichment service can respond. Most generators
don't use this. See
[enrichments concept](../../concepts/enrichments.md#ai-driven-enrichment-requests).

## All three factories: `isSupported`

```ts
isSupported?: ({
  context,
  operation,
  enrichments
}: IsSupportedOasOperationConfigArgs<EnrichmentType>) => boolean
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
2. **`enrichments` is already Valibot-parsed.** Both the OAS and GQL
   factories wrap your `isSupported` to pre-parse the routed
   enrichment payload before invoking it. So `enrichments` here is
   typed as `EnrichmentType`, not raw input.
3. **Other generators can probe it.** The user's `isSupported` is
   re-exposed as a static on the projection-base class
   (`MyProjection.isSupported`), so peers can ask "would *that*
   generator handle this operation?" — the foundation of the
   [operation-reference protocol](../../concepts/cross-generator-coordination.md#operation-reference-protocol).

**Model entries have an optional `isSupported`, symmetric with
operations.** The three rules above all apply, with one shape
difference: the model predicate receives `{ context, refName,
enrichments, variant }` (no `operation`) — resolve the schema yourself
when the gate needs it. When omitted it defaults to `() => true`, so
every refName is dispatched. The user's predicate is re-exposed as
`MyProjection.isSupported` and probed by `insertModel` (peer
capability), exactly as the operation static is by `insertOperation`.

```ts
isSupported({ context, refName }) {
  const schema = context.resolveSchemaRefOnce(refName, MyBase.id)
  return !schema.isRef() && schema.type === 'object'
}
```

## The GQL `acc`-return contract

OAS and model `transform` callbacks may omit `return acc` without
harm — the engine folds `undefined` into the next iteration and
nothing depends on it.

**GQL `transform` must return `acc`.** Forgetting this is one of the
most common GQL authoring bugs:

```ts
// ❌ WRONG — downstream operations see stale acc
transform({ context, operation, acc }) {
  if (operation.rootKind !== 'mutation') return  // ← drops acc
  context.insertOperation({ projection: MyGen, operation })
}

// ✅ RIGHT — acc threaded through every branch
transform({ context, operation, acc }) {
  if (operation.rootKind !== 'mutation') return acc
  context.insertOperation({ projection: MyGen, operation })
  return acc
}
```

The asymmetry is historical, not principled — see
[the-graphql-asymmetry](../../explanation/the-graphql-asymmetry.md).
Until that's resolved, the contract holds.

## What the factory returns

Each factory returns a `*Config` value with the same shape as the
config you handed in, plus:

- `type: 'oasOperation' | 'gqlOperation' | 'model'` — the
  discriminator the dispatcher reads to route to the right
  per-protocol loop.
- `isSupported` — all three factories wrap it to pre-parse enrichments;
  on a built config it is always present (defaulted to `() => true`).

The returned shape (from the source types):

```ts
// OAS — operation/oas/types.ts
type OasOperationConfig<E = undefined> = {
  id: string
  type: 'oasOperation'
  transform: <Acc = void>(args: TransformOasOperationArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.GenericSchema<E>
  isSupported: (args: IsSupportedOasOperationArgs) => boolean
  toPreviewModule?: (args: ToOasOperationPreviewModuleArgs) => PreviewModule
  toMappingModule?: (args: ToOasOperationMappingArgs) => MappingModule
  toEnrichmentRequest?: <R extends E>(op: OasOperation) => EnrichmentRequest<R> | undefined
}

// GQL — operation/gql/types.ts (identical structure, GqlOperation types)

// Model — dsl/model/types.ts
type ModelConfig<E = undefined> = {
  id: string
  type: 'model'
  transform: <Acc = void>(args: TransformModelArgs<Acc>) => Acc
  toEnrichmentSchema?: () => v.BaseSchema<E, E, v.BaseIssue<unknown>>
  toPreviewModule?: (args: ToModelPreviewModuleArgs) => PreviewModule
  toMappingModule?: (args: ToModelMappingArgs) => MappingModule
  toEnrichmentRequest?: <R extends E>(refName: RefName) => EnrichmentRequest<R> | undefined
  isSupported: (args: IsSupportedModelArgs) => boolean   // subject is refName, not operation
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

  toPreviewModule: ({ operation, enrichments }) => ({
    name: CurlCmd.toIdentifier({ operation, enrichments }).name,
    exportPath: CurlCmd.toExportPath({ operation, enrichments }),
    group: 'curl'
  })
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

  transform({ context, operation, acc }) {
    if (operation.rootKind !== 'mutation') return acc
    context.insertOperation({ projection: GqlMutation, operation })
    return acc  // ← required for GQL; threading acc downstream
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
  return toModelEntry({
    id: denoJson.name,
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
| `toIdentifier` | — | yes |
| `toExportPath` | — | yes |
| `toPreviewModule` | yes | — |
| `toMappingModule` | yes | — |
| `toEnrichmentRequest` | yes | — |

The two factories don't share code. Both need the `id` and
`toEnrichmentSchema`, so the convention is to declare them once at
the package level (in `deno.json` and `src/enrichments.ts`) and
re-use them. If they drift, the projection-base's enrichment parsing
won't align with the entry's `isSupported` enrichment parsing — a
silent bug.

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

### Why does `toOasOperationEntry` wrap `isSupported` to pre-parse enrichments, but `transform` doesn't get parsed enrichments?

`isSupported` is a fast filter — the engine wants the parsed
enrichments available as an argument so the predicate doesn't have
to do its own Valibot parse. `transform` may need to read multiple
fields, dispatch to sub-Projections, or branch on raw input; it
gets the unparsed enrichments via `context.settings.enrichments[id]`
and either ignores them or parses on demand. The projection
constructor receives parsed enrichments on `this.settings.enrichments`
when its Projection is constructed by the Driver.

### What happens when `transform` throws?

The dispatcher catches it
(`GenerateContext.ts:428-432`), logs to `logger.error`, and marks
the item `'error'` in the manifest. Siblings continue. Throws never
propagate out of the generator's pass.

### Can `transform` be async?

No. The dispatcher's `reduce` is synchronous. Any async work must
happen pre-Generate (typically at config time, or via the
enrichment-request system).

### Does `toEnrichmentRequest` actually fire?

Only when an enrichment service is wired up to the pipeline. Most
local generations don't use it. See
[enrichments concept](../../concepts/enrichments.md#ai-driven-enrichment-requests).

## See also

- [API: Projection bases](projection-bases.md) — the sister factory that builds the per-item class
- [API: GenerateContext](generate-context.md) — what `context` inside `transform` exposes
- [Concept: How generators produce output](../../concepts/how-generators-produce-output.md) — why `transform`'s return value is discarded
- [Concept: Generators as packages](../../concepts/generators-as-packages.md) — where `src/mod.ts` sits in the package layout
- [Concept: Enrichments](../../concepts/enrichments.md) — routing paths, parsing, AI-driven requests
- [Concept: Cross-generator coordination](../../concepts/cross-generator-coordination.md) — `isSupported` as capability claim
- [Explanation: The GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md) — why GQL `transform` is different
- [Tutorial 02: Authoring a model generator](../../extending/tutorials/02-authoring-a-model-generator.md)
- [Tutorial 03: Authoring an operation generator](../../extending/tutorials/03-authoring-an-operation-generator.md)
- [`skmtc-generator` skill scaffolds](../../skills/skmtc-generator/SKILL.md#6-code-scaffolds) — copy-ready templates
