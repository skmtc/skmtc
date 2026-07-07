# How to change export paths

> Modify where a cloned generator writes its output files.

## When to use this

Stock generator paths don't match your project's conventions.
Common cases: you want `schemas/` not `models/`, you want
per-tag subdirectories, or you want to flatten everything into
one directory.

## Prerequisites

- The generator cloned into your project ([tutorial: cloning a
  generator](../tutorials/01-cloning-a-generator.md)).

## Steps

### Open `gen-x/src/base.ts`

`toExportPath` lives there for stock generators. For
model generators it takes `{ refName, enrichments, variant }`;
for operation generators it takes `{ operation, enrichments,
variant }` (and similar for GraphQL).

### Edit `toExportPath`

Return whatever path you want. The path is relative to the
project's configured `basePath`.

```ts
// Stock gen-zod / gen-typescript default (decapitalized name under @/types)
toExportPath: ({ refName }) => {
  const name = decapitalize(camelCase(refName))
  return join('@', 'types', `${decapitalize(name)}.generated.ts`)
}

// Per-tag subdirectory
toExportPath: ({ operation }) => {
  const tag = operation.tags?.[0] ?? 'misc'
  return `/api/${tag}/${toEndpointName(operation)}.ts`
}

// Flat
toExportPath: ({ refName }) => `/${refName}.ts`
```

**The function must be pure** — same input → same path. If it
isn't, [cross-generator coordination](../../concepts/cross-generator-coordination.md)
breaks because the cache key includes `exportPath`.

### Branch on enrichments for per-operation overrides (optional)

For per-operation path control, add an enrichment field:

```ts
// In enrichments.ts — the per-operation override lives under `subject`.
export const pathsSubject = v.optional(
  v.object({
    paths: v.optional(v.object({ override: v.optional(v.string()) }))
  })
)
export const enrichmentSchema = v.object({
  subject: pathsSubject,
  generator: v.undefined(),
  stack: v.undefined()
})
export const toEnrichmentSchema = () => enrichmentSchema

// In base.ts — toExportPath receives the parsed umbrella; read `subject`.
toExportPath: ({ operation, enrichments }) => {
  const override = enrichments?.subject?.paths?.override
  if (override) return override
  return `/api/${toEndpointName(operation)}.ts`
}
```

Users now set per-operation path overrides in `client.json`.

### Rebundle and regenerate

```bash
skmtc bundle my-project
skmtc generate my-project
```

Output appears at the new paths. Old files at the old paths
persist — `skmtc generate` doesn't delete (see [how to update a
schema](../../using/how-to/update-a-schema.md#clean-up-files-no-longer-produced)).

## Verification

```bash
ls <basePath>/<your-new-path-prefix>/
```

Files appear at the new location. Other generators that
reference these files (e.g., a hook generator referencing a Zod
schema) follow automatically — they discover the path via
`insertModel`'s return value, not by hardcoding.

## Troubleshooting

- **Other generators register imports to the OLD path.** They're
  reading from a stale bundle. Run `skmtc bundle my-project`
  again. `skmtc doctor` flags stale bundles.
- **Same path produced for multiple schemas.** Your
  `toExportPath` lost uniqueness. Driver-path inserts (the usual
  case via `insertModel` / `insertOperation`) detect the mismatch
  and throw `Registered definition mismatch`; bare `register()`
  collisions discard silently. Re-check that the path is unique
  per input.
- **TypeScript errors about missing imports.** A consumer file
  imports from the old location. The consumer-side code needs
  updating; the engine doesn't know about it.

## Related

- [Tutorial: Cloning a generator](../tutorials/01-cloning-a-generator.md)
- [API: ContentSettings](../../reference/api/content-settings.md) —
  what `exportPath` flows into
- [How to change identifier conventions](change-identifier-conventions.md) —
  the sibling task (changing the *name*)
