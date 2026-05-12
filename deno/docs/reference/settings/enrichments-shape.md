# Enrichments shape

> The routing structure for `client.json#settings.enrichments` —
> a four-level key path that delivers user-supplied overrides to the
> right Projection at generate time.

Enrichments are how stock generators expose user-facing options
without compromising the clone-to-customize philosophy. This
reference documents the structural shape; for the mental model see
the [enrichments concept](../../concepts/enrichments.md).

## The four-level key path

Enrichments are keyed by:

```
enrichments
  └── [generatorId]              e.g., "@skmtc/gen-shadcn-form"
       └── [projectionKind]      e.g., "mutation" / "query" / "model"
            └── [operationOrRefId]  e.g., "CreateContact" / "UserModel"
                 └── [projectionKey] e.g., "form"
                      └── { ...enrichment payload }
```

Each level discriminates one dimension of "which Projection on which
operation":

### Level 1: `generatorId`

The JSR package name of the generator being configured:
`"@skmtc/gen-shadcn-form"`, `"@skmtc/gen-zod"`, etc.

Matches the package's `name` in its `deno.json`.

### Level 2: `projectionKind`

A generator may emit multiple kinds of Projection. Common values:

- **`"mutation"`** — for POST, PUT, PATCH, DELETE operations
- **`"query"`** — for GET operations
- **`"model"`** — for schema components (in model generators)
- Generator-specific kinds when needed

The kind discriminator is the generator's own convention. Read the
generator's `src/base.ts` or `src/mod.ts` to confirm what kinds it
emits.

### Level 3: `operationOrRefId`

The specific operation or model:

- **For operation generators**: the OpenAPI `operationId` from the
  schema (e.g., `"CreateContact"`, `"GetOffices"`).
- **For model generators**: the refName of the schema component
  (e.g., `"UserModel"`, `"OrderModel"`).

This level is what makes enrichments per-operation. Different
operations under the same generator get different enrichment
payloads.

### Level 4: `projectionKey`

A final discriminator for which Projection within the same
`(generator, kind, operationId)` triple. Most generators only emit
one Projection per item and use a constant key like `"form"`,
`"hook"`, `"table"`, etc.

The key matches what the generator's Valibot schema declares.

## Per-generator declaration

Each generator declares its accepted enrichment shape via Valibot in
`gen-x/src/enrichments.ts`:

```ts
// gen-shadcn-form/src/enrichments.ts
import * as v from 'valibot'

export const formFieldItem = v.object({
  id: v.string(),
  accessorPath: v.optional(v.array(v.string())),
  input: v.optional(moduleExport),
  label: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  references: v.optional(v.string())
})

export const formPropertiesSchema = v.optional(
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    submitLabel: v.optional(v.string()),
    fields: v.optional(v.array(formFieldItem))
  })
)

export const formSchema = v.optional(
  v.object({
    form: formPropertiesSchema  // ← the projectionKey "form"
  })
)

export type EnrichmentSchema = v.InferOutput<typeof formSchema>
export const toEnrichmentSchema = () => formSchema
```

The schema is registered with the generator's entry function:

```ts
// gen-shadcn-form/src/mod.ts
export const ShadcnFormEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,  // ← the schema is exposed here
  // ...
})
```

**The schema is the canonical source of truth for what enrichment
keys the generator accepts.** To know what to put in `client.json`,
read the generator's `enrichments.ts`.

## Validation behavior

When the CLI reads `client.json`:

1. The CLI loads `client.json` and finds `settings.enrichments`
2. For each generator in `deno.json#imports`, the engine looks up
   `enrichments[<generatorId>]`
3. If present, the value is validated against the generator's
   declared Valibot schema (via `toEnrichmentSchema()`)
4. The validated value is routed into `ContentSettings.enrichments`
   for each `(projectionKind, operationOrRefId, projectionKey)` the
   generator processes

Validation outcomes:

- **Unknown keys**: silently stripped (Valibot's default behavior)
- **Missing optional keys**: arrive as `undefined`
- **Type mismatch on required key**: surfaces as a parse error
- **Type mismatch on optional key**: depends on the schema —
  typically validation passes with the key omitted

## Consumption in Projection constructors

The validated, routed enrichment value is available at
`this.settings.enrichments`:

```ts
// gen-shadcn-form/src/ShadcnForm.ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments?.form ?? {}

  return `(${this.parameter}) => {
    return (
      <Form>
        ${title ? `<h2>${title}</h2>` : ''}
        ${description ? `<p>${description}</p>` : ''}
        ${this.fields}
        <Button>${submitLabel || 'Submit'}</Button>
      </Form>
    )
  }`
}
```

The Projection assumes the shape matches the declared Valibot schema
— the engine has already validated. Optional fields may be
`undefined`; the code handles that with `??` defaults.

## Common patterns

### Per-operation titles and labels

The most common enrichment shape — strings for human-readable
labels:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateUser":  { "form": { "title": "Create User",  "submitLabel": "Create" } },
        "UpdateUser":  { "form": { "title": "Edit User",    "submitLabel": "Save"   } }
      }
    }
  }
}
```

### Field-level overrides

When a specific field needs special handling beyond the generator's
default dispatch:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateContact": {
          "form": {
            "fields": [
              {
                "id": "officeIds",
                "references": "GetOffices",
                "referenceKind": "searchable",
                "label": "Offices"
              }
            ]
          }
        }
      }
    }
  }
}
```

This tells the form generator: when emitting the `officeIds` field
of `CreateContact`, route it to the `GetOffices` operation
(searchable dropdown), not the default array-input renderer.

### Operation-reference patterns

Generators that compose by reference (e.g., a form's
`field.references` pointing at another operation) use enrichments
to specify the target. This avoids hardcoding cross-operation
relationships in generator source.

The `references` value is an operation ID. The generator resolves
it at generate time and constructs the appropriate cross-operation
binding.

## What enrichments aren't

To repeat from the [enrichments concept](../../concepts/enrichments.md):
enrichments are **not** a general configuration system. They expose
specifically what each generator's author decided to make
user-configurable.

If you need behavior the generator's enrichment schema doesn't
support:

- **Stop**: enrichments aren't the answer
- **Clone the generator**: edit the source for behavioral changes
- **Optionally**: contribute an enrichment field upstream if the
  change is generally useful

Don't try to abuse enrichments to encode behavior changes the
schema doesn't anticipate. The validation strips unknown keys
silently, so your enrichments would be silently dropped.

## Routing examples

### Single-Projection generator

For a generator that emits one Projection per operation (e.g., a
hook generator), the enrichment path is straightforward:

```
enrichments
  └── @skmtc/gen-tanstack-query-fetch-zod
       └── mutation
            └── CreateUser
                 └── hook
                      └── { useMutationOptions: {...} }
```

### Multi-Projection generator

For a generator that emits multiple Projections per operation (e.g.,
a form generator that emits a form AND a separate prop-types file),
the `projectionKey` discriminates:

```
enrichments
  └── @skmtc/gen-multi-output
       └── mutation
            └── CreateUser
                 ├── form
                 │    └── { title: "Create User" }
                 └── propTypes
                      └── { exportName: "CreateUserFormProps" }
```

### Model generator

For a model generator, `projectionKind` is typically `"model"` and
`operationOrRefId` is the refName:

```
enrichments
  └── @skmtc/gen-zod
       └── model
            └── UserModel
                 └── schema
                      └── { description: "A user account" }
```

The model generator's enrichment schema would declare the
`description` field.

## Common questions

### How do I know what `projectionKind` and `projectionKey` a generator uses?

Read the generator's `src/base.ts` and `src/mod.ts`. The factory
call (`toOasOperationEntry`, `toModelEntry`) is configured with the
kind. The `toEnrichmentSchema` factory function returns the Valibot
schema whose top-level keys are the projection keys.

Stock generators are documented in
[reference/stock-generators/](../stock-generators/).

### Can I share enrichment payloads across operations?

Not via the schema. The four-level key path requires repeating the
payload for each `operationOrRefId`. If you have shared values,
define them at the JSON level (e.g., extract a JSON anchor in
YAML-source `client.json`, though SKMTC reads JSON strict) or
duplicate manually.

### Why is `projectionKey` separate from `projectionKind`?

`projectionKind` is *what kind of work* (mutation, query, model).
`projectionKey` is *which output* within that kind. They're
orthogonal: a mutation operation might produce a form Projection
*and* a confirmation-dialog Projection from the same generator —
both `kind: "mutation"`, different keys.

For most stock generators today, the key is constant (e.g.,
`"form"`). The dimension exists for future flexibility.

### Can enrichments arrive at a Snippet?

Indirectly. Snippets don't have a `settings` object, but their
parent Projection does. A Snippet can be passed enrichment-derived
values via constructor arguments:

```ts
new MyFieldSnippet({
  context,
  name,
  label: parent.settings.enrichments?.form?.fields?.find(f => f.id === name)?.label,
  destinationPath
})
```

The parent does the enrichment lookup; the Snippet receives the
result.

## Cross-references

- [enrichments concept](../../concepts/enrichments.md) — full mental model
- [client.json schema reference](client-json-schema.md) — the broader settings shape
- [skmtc-cli skill §6](../../skills/skmtc-cli/SKILL.md) — operational configuration
- [skmtc-generator skill §10 card "Adding enrichment options"](../../skills/skmtc-generator/SKILL.md) — authoring perspective
