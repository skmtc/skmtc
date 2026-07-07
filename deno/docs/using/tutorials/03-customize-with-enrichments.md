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
      "id": "string",         // matches a property name in the request body schema
      "label": "string",
      "placeholder": "string"
    }
  ]
}
```

The full schema is documented at [gen-shadcn-form's reference](../../reference/stock-generators/gen-shadcn-form.md).

## Step 2: Add enrichments to client.json

`gen-shadcn-form` is an OAS operation generator, so its routing
keys are the literal OpenAPI `path` and lowercase `method` —
**not** `operationId`. For the petstore, `addPet` is `POST /pet`
and `updatePet` is `PUT /pet`.

Edit `.skmtc/petstore/.settings/client.json`:

```jsonc
{
  "source": "https://petstore3.swagger.io/api/v3/openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/pet": {
          "post": {
            "title": "Add a new pet",
            "submitLabel": "Add to inventory",
            "fields": [
              { "id": "name", "label": "Pet name", "placeholder": "Fluffy" },
              { "id": "category", "label": "Category" }
            ]
          },
          "put": {
            "title": "Edit pet details",
            "submitLabel": "Save changes"
          }
        }
      }
    }
  }
}
```

The routing path is `[generatorId][path][method]` for OAS
operation generators. See
[enrichments shape reference](../../reference/settings/enrichments-shape.md)
for all three routing shapes.

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

## What just happened

`client.json#settings.enrichments` is read by the engine and
routed to each generator instance. The `toOasOperationProjectionBase`
factory looks up
`enrichments[generatorId][operation.path][operation.method]` for
the current operation and validates the result against the
generator's Valibot schema. The validated value lands on the
Projection as `this.settings.enrichments`:

```ts
const { title, submitLabel } = this.settings.enrichments ?? {}
return `<Form><h2>${title ?? defaultTitle}</h2>...<Button>${submitLabel ?? 'Submit'}</Button></Form>`
```

When you provided a `title` for `POST /pet`, it landed there. When
you didn't (for other operations), the `??` defaults kicked in.

## Next steps

- [How to configure enrichments](../how-to/configure-enrichments.md) —
  targeted reference for adding more enrichment entries
- [Enrichments concept](../../concepts/enrichments.md) — the
  mental model
- [Tutorial: Cloning a generator](../../authoring/tutorials/01-cloning-a-generator.md) —
  when enrichments aren't enough and you need source-level
  customization
