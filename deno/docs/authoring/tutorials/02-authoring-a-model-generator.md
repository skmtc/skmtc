# Authoring a model generator

> Build a new generator from scratch that produces one file per
> schema component. By the end you'll have the model-generator
> pattern in your fingers and can apply it to any output target.

## What you'll build

A small generator (`schema-meta`) that produces per-schema metadata:

```ts
// src/generated/Pet.meta.ts
export const PetMeta = {
  name: 'Pet',
  properties: ['id', 'name', 'category', 'photoUrls', 'status']
} as const
```

Useful for runtime introspection or test fixtures. The output is
deliberately simple so you can focus on the **authoring flow**,
not the output's complexity.

## Prerequisites

- A SKMTC project initialized.
- Familiarity with [the projections-and-snippets concept](../../concepts/projections-and-snippets.md).
- Light TypeScript fluency.

## Step 1: Scaffold with `skmtc create`

```bash
skmtc create my-project schema-meta model
```

This scaffolds a model generator at
`.skmtc/my-project/schema-meta/`. The `model` argument tells the
CLI which factory to wire up (`toModelEntry`, not
`toOasOperationEntry`). See [`skmtc create` reference](../../reference/cli/create.md).

Open the scaffolded files. The skeleton is intentionally minimal:

```
.skmtc/my-project/schema-meta/
├── deno.json
├── mod.ts
└── src/
    ├── mod.ts                     # the Entry (toModelEntry)
    ├── base.ts                    # toTsModelProjectionBase({...}) — the base factory call
    └── SchemaMetaProjection.ts    # the Projection class extending the base
```

The class file is `<MainModule>Projection.ts` where
`MainModule = camelCase(packageName, { upperFirst: true })` — so
`schema-meta` → `SchemaMeta` → file `SchemaMetaProjection.ts`.

Note the scaffold does **not** create `enrichments.ts`. Add it
manually if your generator needs enrichments — see
[how to add enrichment options](../how-to/add-enrichment-options.md).

## Step 2: Implement `toIdentifierName`, `toIdentifierType`, and `toExportPath` in `base.ts`

`base.ts` calls `toTsModelProjectionBase({...})` (the
TypeScript projection-base veneer from `@skmtc/lang-typescript`)
and exports the resulting class. The pure `toIdentifierName` /
`toIdentifierType` / `toExportPath` functions are *config fields*
on that call — not free-standing exports:

```ts
// src/base.ts
import { camelCase, decapitalize } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import type { TsIdentifierType } from '@skmtc/lang-typescript'
import { join } from '@std/path/join'

export const SchemaMetaBase = toTsModelProjectionBase({
  id: '@local/schema-meta',

  toIdentifierName({ refName }): string {
    return `${decapitalize(camelCase(refName))}Meta`
  },

  toIdentifierType: (): TsIdentifierType => ({ type: 'variable' }),

  toExportPath({ refName }): string {
    return join('@', 'meta', `${refName}.meta.ts`)
  }
})
```

`toIdentifierName` returns the name string. `toIdentifierType`
declares what kind of declaration that name gets: `{ type:
'variable' }` produces a `const` declaration (a runtime value),
`{ type: 'type' }` a type declaration. Under
`verbatimModuleSyntax: true`, this distinction is load-bearing —
see [the Identifier reference](../../reference/api/dsl-identifier.md).

**These functions must be pure** — same input → same output, no
side effects. This is the load-bearing property that makes
[cross-generator coordination](../../concepts/cross-generator-coordination.md)
work.

## Step 3: Implement the Projection class

Open `src/SchemaMetaProjection.ts`. The class extends the base
returned by `toTsModelProjectionBase` (not the abstract
`ModelProjectionBase` directly):

```ts
import type { GenerateContext, RefName, ContentSettings } from '@skmtc/core'
import { SchemaMetaBase } from './base.ts'

type ConstructorArgs = {
  context: GenerateContext
  refName: RefName
  settings: ContentSettings
  destinationPath: string
  rootRef?: RefName
}

export class SchemaMetaProjection extends SchemaMetaBase {
  propNames: string[]

  constructor({ context, refName, settings }: ConstructorArgs) {
    super({ context, refName, settings })

    // The schema is resolved here, from refName.
    const schema = context.resolveSchemaRefOnce(refName, SchemaMetaBase.id)

    if (schema.isRef() || schema.type !== 'object') {
      this.propNames = []
    } else {
      this.propNames = Object.keys(schema.properties ?? {})
    }
  }

  override toString(): string {
    return `{
  name: '${this.settings.identifier.name.replace('Meta', '')}',
  properties: [${this.propNames.map(n => `'${n}'`).join(', ')}]
} as const`
  }
}
```

Two things to note:

- The constructor receives `refName`, not a schema. The schema is
  resolved inside via `context.resolveSchemaRefOnce(refName, baseId)`.
- `super(args)` only passes the three canonical fields
  (`context`, `refName`, `settings`). `destinationPath` and
  `rootRef` are scaffold-added fields available on the args but
  not passed up.

The `toString()` returns the **value side** of the
`export const X = ...` statement. The wrapping happens in the
`Definition` class automatically.

## Step 4: Wire up `src/mod.ts`

`src/mod.ts` is the **Entry**: a `toModelEntry({...})` call whose
result becomes the package's default export. The pipeline iterates
over every refName in the document and invokes the Entry's
`transform` callback for each one.

The scaffold writes a minimal Entry — opening the file should show
something close to:

```ts
// src/mod.ts
import { toModelEntry } from '@skmtc/core'
import { SchemaMetaProjection } from './SchemaMetaProjection.ts'
import denoJson from '../deno.json' with { type: 'json' }

const schemaMetaEntry = toModelEntry({
  id: denoJson.name,
  transform({ context, refName }) {
    context.insertModel(SchemaMetaProjection, refName)
  }
})

export default schemaMetaEntry
```

Two things to internalize:

1. **`transform` is fire-and-forget.** Its return value is folded
   into `acc` but never persisted as output. The way artifacts get
   produced is the side-effect `context.insertModel(...)` call —
   that's what triggers the Driver to construct your Projection (if
   not already cached), wrap the result in a `Definition`, and
   register it in the file map.
2. **Model entries have an optional `isSupported`** — declare it to
   gate which refNames the engine dispatches (a `false` result records
   `notSupported` and skips `transform`); omit it and every refName is
   dispatched. The predicate receives `{ context, refName, enrichments,
   variant }` — no schema, so resolve it yourself. Use `isSupported`
   for a *capability* claim (the schema shapes this generator can
   handle); for user opt-in/out, prefer client.json `include`/`skip`:

```ts
isSupported({ context, refName }) {
  const schema = context.resolveSchemaRefOnce(refName, SchemaMetaBase.id)
  return !schema.isRef() && schema.type === 'object'
}
```

This is now symmetric with operation entries (tutorial 03's Step 2
implements `isSupported` on the Entry config too). You can equally
filter inside `transform` — but `isSupported` makes the capability
explicit, surfaces the refName as `notSupported` rather than a silent
no-op, and lets peers probe it via `insertModel`.

If you later need user-facing options, add `toEnrichmentSchema` to
the Entry config and pass the typed enrichment through. The full
config surface — including `toPreviewModule`, `toMappingModule`,
and the rarely-used `toEnrichmentRequest` — is documented in the
[entry-factories reference](../../reference/api/entry-factories.md).

## Step 5: Compose with peer Projections

For this generator, you don't need to. If you wanted to reference
another generator's registered name (e.g., the TypeScript type from
`gen-typescript`), you'd call `insertModel` from the constructor:

```ts
constructor(args: ConstructorArgs) {
  super({ context: args.context, refName: args.refName, settings: args.settings })
  const ts = args.context.insertModel(TsProjection, args.refName)
  this.tsName = ts.toName()
}
```

See [how to compose with another generator](../how-to/compose-with-another-generator.md).

## Step 6: Iterate with `skmtc dev`

```bash
skmtc dev my-project
```

Watch mode. Re-runs generation on each source change. Faster
than `skmtc bundle && skmtc generate` for iteration.

Make a change to `SchemaMeta.toString()`, save, and watch the
output update. Verify via:

```bash
cat src/generated/Pet.meta.ts
```

## What just happened

You created a model generator from scratch. The structure:

- **`src/mod.ts`** exports the `Entry` — `toModelEntry({ id,
  transform({ context, refName }) { context.insertModel(SchemaMetaProjection, refName) } })`
- **`src/base.ts`** holds the `toTsModelProjectionBase({...})`
  factory call. The pure `toIdentifierName` / `toIdentifierType` /
  `toExportPath` are config fields on that call.
- **`src/SchemaMetaProjection.ts`** holds the Projection class
  that extends the base returned by the factory, resolves its
  schema inside the constructor, and renders via `toString()`.

This pattern is shared across **every** model generator —
`gen-typescript`, `gen-zod`, `gen-valibot`, `gen-arktype`. Look
at any of their sources to confirm.

## Next steps

- [Tutorial 03: Authoring an operation generator](03-authoring-an-operation-generator.md) —
  operations differ in a few important ways
- [How to add enrichment options](../how-to/add-enrichment-options.md) —
  expose user-configurable behavior
- [How to compose with another generator](../how-to/compose-with-another-generator.md) —
  reference other generators' output by name
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
- [API: Projection bases](../../reference/api/projection-bases.md)
