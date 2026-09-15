# How to configure enrichments

> Adjust per-operation labels, titles, field overrides, or other
> user-facing options exposed by a generator's enrichment schema.

## When to use this

You want different output for specific operations (e.g., a
custom title on a specific form, or a different label for a
field on the `CreateUser` form) without modifying the generator.
If the generator's enrichment schema doesn't expose what you need,
see [tutorial: cloning a generator](../../authoring/tutorials/01-cloning-a-generator.md)
instead.

## Prerequisites

- A SKMTC project with the target generator installed (e.g.,
  `@skmtc/gen-shadcn-form`).
- The paths and methods (or model refNames) you want to customize,
  as they appear in the source document. Routing uses the literal
  path and the lowercase method, never `operationId`.

## Steps

### Locate the generator's enrichment schema

Each generator declares its accepted enrichment shape in
`src/enrichments.ts` as a Valibot schema. The shape is the
contract — keys outside it are silently stripped.

For stock generators, the shape is documented in the per-generator
reference (e.g., [gen-shadcn-form](../../reference/stock-generators/gen-shadcn-form.md)).

### Add enrichments to client.json

The routing keys depend on the generator's projection-base kind:

| Factory | Key path |
|---|---|
| OAS operation | `enrichments[generatorId][operation.path][operation.method][variant]` |
| Model | `enrichments[generatorId][refName][variant]` |
| GraphQL operation | `enrichments[generatorId][rootKind][fieldName][variant]` |

The trailing `variant` key is `"main"` by default. Write your override
under it; whenever you declare any variant for an item, `"main"` must
be one of them.

Example for `gen-shadcn-form` (OAS operation) on `POST /users`:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/users": {
          "post": {
            "main": {
              "title": "Create a user",
              "submitLabel": "Create",
              "fields": [
                { "moduleSelect": { "schemaPath": ["name"] }, "label": "Full name" }
              ]
            }
          }
        }
      }
    }
  }
}
```

Example for `gen-zod` (model) on `UserModel`:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-zod": {
        "UserModel": {
          "main": { "description": "A user account" }
        }
      }
    }
  }
}
```

See [enrichments shape reference](../../reference/settings/enrichments-shape.md)
for all three routing shapes.

### Regenerate

```bash
skmtc generate <project>
```

No rebundle needed — `client.json` is runtime config.

## Verification

Inspect the generated file for the operation you customized. The
new title/label/etc. should appear in the output. If it doesn't,
either:

- The routing keys are wrong (for OAS operations check the
  literal `path` and lowercase `method` match the OAS spec; for
  models check the refName)
- The enrichment field name doesn't match the schema (check
  the generator's `enrichments.ts`)

## Troubleshooting

- **A customization silently doesn't land** — read
  `manifest.enrichmentWarnings` in `.skmtc/<project>/.settings/`
  (the CLI also prints them as an "Enrichment warnings" block, and
  `skmtc doctor` shows them as `project-enrichments/<project>`).
  A typo'd generator id, path, method or model name is reported
  with the nearest match; a key the schema does not declare is
  reported as `UNKNOWN_ENRICHMENT_KEY` with a suggestion.
- **No warning, still ignored** — the value must sit under the
  variant key (`main`), not directly under the item key; and the
  keys are the literal `path` and lowercase `method` for OAS
  operations, the refName for models, `rootKind` and `fieldName`
  for GraphQL operations.
- **The item is reported as `error` in the manifest** — a value has
  the wrong type for the generator's schema; the message names the
  enrichment path. The rest of the run completes. Re-check the
  generator's `enrichments.ts`.
- **The field you want does not exist** — the generator's schema does
  not declare it. Clone the generator and add it (see
  [add enrichment options](../../authoring/how-to/add-enrichment-options.md)).

## Related

- [Enrichments concept](../../concepts/enrichments.md)
- [Enrichments shape reference](../../reference/settings/enrichments-shape.md)
- [client.json schema](../../reference/settings/client-json-schema.md)
- [Per-generator enrichment docs](../../reference/stock-generators/)
