# Enrichments shape

> The routing structure for `client.json#settings.enrichments`.
> Each projection-base factory reads enrichments from a different
> key path; there is no single uniform shape across all generators.

Enrichments are how stock generators expose user-facing options
without compromising the clone-to-customize philosophy. This
reference documents the actual routing read by each projection-base
factory; for the mental model see the
[enrichments concept](../../concepts/enrichments.md).

## Three routing shapes

The key path is hardcoded inside each projection-base factory, so
the shape depends on which factory the generator was built from.
There are three:

### OAS operation generators

Source: `core/dsl/operation/oas/toOasOperationProjectionBase.ts`:

```ts
get(context.settings, `enrichments.${config.id}.${operation.path}.${operation.method}`)
```

Three levels:

```
enrichments
  └── [generatorId]      e.g., "@skmtc/gen-shadcn-form"
       └── [path]        e.g., "/customers" or "/orders/{id}"
            └── [method] e.g., "post", "get", "put"
                 └── { ...enrichment payload }
```

`path` is the literal OpenAPI path string (including curly-brace
parameters). `method` is the lowercase HTTP verb.

Example `client.json` fragment. The leaf payload's internal shape
is defined by the generator's Valibot schema:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/customers": {
          "post": { "title": "Create Customer", "submitLabel": "Save" }
        },
        "/orders/{id}": {
          "put":  { "title": "Edit Order",      "submitLabel": "Update" }
        }
      }
    }
  }
}
```

### Model generators

Source: `core/dsl/model/toModelProjectionBase.ts`:

```ts
get(context.settings, `enrichments.${config.id}.${refName}.${variant}`)
```

Three levels:

```
enrichments
  └── [generatorId]    e.g., "@scope/gen-zod-variants"
       └── [refName]   e.g., "Customer"
            └── [variant]  e.g., "main" | "coercive"
                 └── { ...enrichment payload }
```

`refName` is the schema component name as it appears under
`components.schemas` in the source document. `variant` defaults to
`'main'` when no variants are declared; whenever any variant is
declared, `'main'` MUST be present (engine throws via
`toVariantList` otherwise — see
[`concepts/variants.md`](../../concepts/variants.md)).

Example (single-variant — the common case):

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-zod": {
        "UserModel":  { "main": { "description": "A user account" } },
        "OrderModel": { "main": { "description": "A customer order" } }
      }
    }
  }
}
```

Example (multi-variant — variants-aware model generator):

```jsonc
{
  "settings": {
    "enrichments": {
      "@scope/gen-zod-variants": {
        "Customer": {
          "main":     { "coerce": false },
          "coercive": { "coerce": true }
        }
      }
    }
  }
}
```

### GraphQL operation generators

Source: `core/dsl/operation/gql/toGqlOperationProjectionBase.ts`:

```ts
get(context.settings, `enrichments.${config.id}.${operation.rootKind}.${operation.fieldName}`)
```

Three levels:

```
enrichments
  └── [generatorId]      e.g., "@skmtc/gen-graphql-x"
       └── [rootKind]    "Query" | "Mutation" | "Subscription"
            └── [fieldName]
                 └── { ...enrichment payload }
```

Example:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-graphql-x": {
        "Mutation": {
          "createUser": { "title": "Create User" }
        },
        "Query": {
          "user": { "label": "User detail" }
        }
      }
    }
  }
}
```

## Per-generator declaration

Each generator declares its accepted enrichment shape via Valibot in
`gen-x/src/enrichments.ts`. The Valibot schema describes the
**leaf payload** — what arrives at the lookup target — not the
routing keys above it:

```ts
// gen-shadcn-form/src/enrichments.ts
import * as v from 'valibot'
import { moduleExport } from '@skmtc/core'

export const formFieldItem = v.object({
  id: v.string(),
  accessorPath: v.optional(v.array(v.string())),
  input: v.optional(moduleExport),
  label: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  references: v.optional(v.string())
})

export const formSchema = v.optional(
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    submitLabel: v.optional(v.string()),
    fields: v.optional(v.array(formFieldItem))
  })
)

export type EnrichmentSchema = v.InferOutput<typeof formSchema>
export const toEnrichmentSchema = () => formSchema
```

The schema is registered via the generator's entry function:

```ts
// gen-shadcn-form/src/mod.ts
export const ShadcnFormEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
})
```

**The Valibot schema is the canonical source of truth for what
the enrichment payload accepts.** To know what to put in
`client.json` under the routing keys, read the generator's
`enrichments.ts`. The schema's *root* is what arrives at the
lookup target — for `gen-shadcn-form` above that's the object
with `title`, `description`, `submitLabel`, `fields`.

## Validation behavior

For each Projection the engine builds:

1. The factory's static `toEnrichments({ operation | refName, context })`
   does the `get(context.settings, ...)` lookup at the path shown
   above for that projection-base kind.
2. The looked-up value (which may be `undefined`) is parsed against
   the generator's declared Valibot schema via `v.parse(schema, value)`.
3. The parsed value becomes `this.settings.enrichments` inside the
   Projection.

Outcomes:

- **Unknown keys**: silently stripped (Valibot default).
- **Missing optional keys**: arrive as `undefined`.
- **Type mismatch on required key**: surfaces as a parse error.
- **Whole payload missing**: most stock generators wrap their
  schema in `v.optional(...)`, so the value arrives as `undefined`.

## Consumption in Projection constructors

The validated, routed payload is available at `this.settings.enrichments`:

```ts
// gen-shadcn-form/src/ShadcnForm.ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments ?? {}

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

## What enrichments aren't

Enrichments are **not** a general configuration system. They expose
specifically what each generator's author decided to make
user-configurable.

If you need behavior the generator's enrichment schema doesn't
support:

- **Stop**: enrichments aren't the answer.
- **Clone the generator**: edit the source for behavioral changes.
- **Optionally**: contribute an enrichment field upstream if the
  change is generally useful.

Unknown keys are stripped silently, so attempts to encode behavior
the schema doesn't anticipate will appear to do nothing.

## Common questions

### How do I know which routing shape a generator uses?

Read the first line inside `src/base.ts` — it calls one of
`toOasOperationProjectionBase`, `toModelProjectionBase`, or
`toGqlOperationProjectionBase`. That call determines the routing
shape.

Stock generators are documented in
[reference/stock-generators/](../stock-generators/).

### Can I share enrichment payloads across operations?

Not via the schema. The routing requires repeating the payload for
each `(path, method)`, `refName`, or `(rootKind, fieldName)`. If
you have shared values, duplicate manually — there is no wildcard.

### Can enrichments arrive at a Snippet?

Indirectly. Snippets don't have a `settings` object, but their
parent Projection does. A Snippet can be passed enrichment-derived
values via constructor arguments:

```ts
new MyFieldSnippet({
  context,
  name,
  label: parent.settings.enrichments?.fields?.find(f => f.id === name)?.label,
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
