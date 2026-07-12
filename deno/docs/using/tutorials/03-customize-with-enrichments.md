# Customize with enrichments

> Configure per-operation labels, titles, and field overrides via
> `client.json` — without touching generator source code.

## What you'll build

The petstore project from [tutorial 02](02-multiple-generators.md),
now with a form generator added and customized through enrichments:
operation-specific form titles, submit-button labels, and field
labels.

## Prerequisites

- The `petstore` project from [tutorial 02](02-multiple-generators.md).
- Familiarity with the [enrichments concept](../../concepts/enrichments.md)
  (skim it; this tutorial gives concrete steps).

## Step 1: Find the generator's enrichment shape

Install the form generator:

```bash
skmtc install @skmtc/gen-shadcn-form petstore
```

Each generator declares its enrichment shape in `src/enrichments.ts`.
For `gen-shadcn-form`, the shape is roughly:

```jsonc
{
  "title": "string",
  "description": "string",
  "submitLabel": "string",
  "fields": [
    {
      // binds this entry to a request-body property — the path IS the join key
      "moduleSelect": { "schemaPath": ["name"] },
      "label": "string",
      "placeholder": "string"
    }
  ]
}
```

All keys are optional — provide only what you override.

The full schema is documented at [gen-shadcn-form's reference](../../reference/stock-generators/gen-shadcn-form.md).

## Step 2: Add enrichments to client.json

`gen-shadcn-form` is an OAS operation generator, so its routing
keys are the literal OpenAPI `path` and lowercase `method` —
**not** `operationId`. For the petstore, `addPet` is `POST /pet`
and `updatePet` is `PUT /pet`.

Edit `.skmtc/petstore/.settings/client.json`:

```jsonc
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/pet": {
          "post": {
            "main": {
              "title": "Add a new pet",
              "submitLabel": "Add to inventory",
              "fields": [
                { "moduleSelect": { "schemaPath": ["name"] }, "label": "Pet name", "placeholder": "Fluffy" },
                { "moduleSelect": { "schemaPath": ["category"] }, "label": "Category" }
              ]
            }
          },
          "put": {
            "main": {
              "title": "Edit pet details",
              "submitLabel": "Save changes"
            }
          }
        }
      }
    }
  }
}
```

The routing path is `[generatorId][path][method][variant]` for OAS
operation generators — the override sits under the `variant` key
(`main` by default). See
[enrichments shape reference](../../reference/settings/enrichments-shape.md)
for all three routing shapes.

Two validation behaviors worth knowing before you edit: a
wrongly-typed value (a number where `title` expects a string) fails
that operation's generation — the run completes, and the manifest
records the error with the path. A misspelled key can't fail
anything (the schema ignores unknown keys), so the engine warns
about it instead — step 5 shows that warning in action.

## Step 3: Regenerate

```bash
skmtc generate petstore
```

No need to rebundle — `client.json` is runtime config, not bundle
code.

## Step 4: Verify the customization landed

Look at the generated form:

```bash
cat src/generated/pet/addPet.generated.tsx
```

The form's `<h2>` text is now "Add a new pet", the submit button
reads "Add to inventory", and the `name` field's label is "Pet
name". Other operations use the form generator's defaults
(derived from the OAS path and verb).

## Step 5: Typo a key on purpose

Misspell one override and watch the engine catch it. In
`client.json`, change `"submitLabel"` to `"submitLabl"` and
regenerate:

```bash
skmtc generate petstore --json > out.json
jq '.manifest.enrichmentWarnings' out.json
```

The run completes (warnings never affect output), and the manifest
names the problem — an `UNKNOWN_ENRICHMENT_KEY` warning carrying the
full routing path and a suggestion (`submitLabl` → did you mean
`submitLabel`?). The same block prints as "Enrichment warnings" in
the normal command output. Typos in the routing keys (a wrong path or
method) surface the same way, as `UNCONSUMED_ENRICHMENT`.

Fix the key back and regenerate before moving on.

## What just happened

Your `client.json` entry was routed to the form generator by the
path `[generatorId][path][method][variant]` and validated against
the shape the generator declares. Where you provided a value (the
`title` for `POST /pet`), it overrode the generator's default; where
you didn't, the defaults applied — which is why the other operations'
forms are unchanged. Configuration reached generated output without
you touching any code.

How enrichments are declared and routed — including what generator
authors do on the other side of this contract — is the
[enrichments concept](../../concepts/enrichments.md).

## Next steps

- [How to configure enrichments](../how-to/configure-enrichments.md) —
  targeted reference for adding more enrichment entries
- [Enrichments concept](../../concepts/enrichments.md) — the
  mental model
- [Tutorial: Cloning a generator](../../authoring/tutorials/01-cloning-a-generator.md) —
  when enrichments aren't enough and you need source-level
  customization
