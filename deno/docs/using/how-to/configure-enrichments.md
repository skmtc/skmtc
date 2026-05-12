# How to configure enrichments

> Adjust per-operation labels, titles, field overrides, or other
> user-facing options exposed by a generator's enrichment schema.

## When to use this

You want different output for specific operations (e.g., a
custom title on a specific form, or a different label for a
field on the `CreateUser` form) without modifying the generator.
If the generator's enrichment schema doesn't expose what you need,
see [tutorial: cloning a generator](../../extending/tutorials/01-cloning-a-generator.md)
instead.

## Prerequisites

- A SKMTC project with the target generator installed (e.g.,
  `@skmtc/gen-shadcn-form`).
- Knowledge of the operation IDs (or model refNames) you want to
  customize. List them via `skmtc agent-context --json | jq
  '.projects[] | .generators'`.

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
| OAS operation | `enrichments[generatorId][operation.path][operation.method]` |
| Model | `enrichments[generatorId][refName]` |
| GraphQL operation | `enrichments[generatorId][rootKind][fieldName]` |

Example for `gen-shadcn-form` (OAS operation) on `POST /users`:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/users": {
          "post": {
            "title": "Create a user",
            "submitLabel": "Create",
            "fields": [
              { "id": "name", "label": "Full name" }
            ]
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
        "UserModel": { "description": "A user account" }
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

Inspect the emitted file for the operation you customized. The
new title/label/etc. should appear in the output. If it doesn't,
either:

- The routing keys are wrong (for OAS operations check the
  literal `path` and lowercase `method` match the OAS spec; for
  models check the refName)
- The enrichment field name doesn't match the schema (check
  the generator's `enrichments.ts`)

## Troubleshooting

- **Enrichments silently ignored** — Most likely a key-path typo.
  Run `skmtc agent-context --json | jq '.projects[] |
  .settings.enrichmentsConfigured'` to confirm `client.json`
  parsed; then double-check the routing keys against the actual
  values: for OAS operations the keys are the literal `path` and
  lowercase `method` (not `operationId`); for models the key is
  the refName; for GraphQL operations the keys are `rootKind` and
  `fieldName`.
- **"Type mismatch in enrichments"** — A required enrichment
  field has the wrong type. Re-check the generator's
  `enrichments.ts` for the Valibot schema.
- **Unknown enrichment keys** — Unknown keys are silently
  stripped (Valibot default). If the field you want isn't in the
  generator's schema, clone the generator and add it (see
  [add enrichment options](../../extending/how-to/add-enrichment-options.md)).

## Related

- [Enrichments concept](../../concepts/enrichments.md)
- [Enrichments shape reference](../../reference/settings/enrichments-shape.md)
- [client.json schema](../../reference/settings/client-json-schema.md)
- [Per-generator enrichment docs](../../reference/stock-generators/)
