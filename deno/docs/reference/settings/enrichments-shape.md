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
There are four:

### OAS operation generators

Source: `core/dsl/operation/oas/toOasOperationProjectionBase.ts`:

```ts
context.readEnrichment([config.id, operation.path, operation.method, variant])
```

Four levels — the subject leaf sits under a trailing `variant` key:

```
enrichments
  └── [generatorId]       e.g., "@skmtc/gen-shadcn-form"
       └── [path]         e.g., "/customers" or "/orders/{id}"
            └── [method]  e.g., "post", "get", "put"
                 └── [variant]  "main" by default
                      └── { ...subject leaf }
```

`path` is the literal OpenAPI path string (including curly-brace
parameters). `method` is the lowercase HTTP verb. `variant` is
`"main"` unless the generator declares extra variants (and `"main"`
must be present whenever any variant is).

Example `client.json` fragment. The subject leaf's internal shape
is defined by the generator's Valibot schema:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/customers": {
          "post": {
            "main": { "title": "Create Customer", "submitLabel": "Save" }
          }
        },
        "/orders/{id}": {
          "put": {
            "main": { "title": "Edit Order", "submitLabel": "Update" }
          }
        }
      }
    }
  }
}
```

### Model generators

Source: `core/dsl/model/toModelProjectionBase.ts`:

```ts
context.readEnrichment([config.id, refName, variant])
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
context.readEnrichment([config.id, operation.rootKind, operation.fieldName, variant])
```

Four levels — the subject leaf sits under a trailing `variant` key:

```
enrichments
  └── [generatorId]       e.g., "@skmtc/gen-graphql-x"
       └── [rootKind]     "query" | "mutation" | "subscription" (lowercase)
            └── [fieldName]
                 └── [variant]  "main" by default
                      └── { ...subject leaf }
```

Example:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-graphql-x": {
        "mutation": {
          "createUser": { "main": { "title": "Create User" } }
        },
        "query": {
          "user": { "main": { "label": "User detail" } }
        }
      }
    }
  }
}
```

### Webhook generators

Source: `core/dsl/webhook/toWebhookProjectionBase.ts`:

```ts
context.readEnrichment([config.id, webhook.name, webhook.method, variant])
```

Four levels, keyed by the webhook's name (its key under the
document's `webhooks` object), not by a request path:

```
enrichments
  └── [generatorId]
       └── [webhookName]  e.g., "orderShipped"
            └── [method]  e.g., "post"
                 └── [variant]  "main" by default
                      └── { ...subject leaf }
```

### Reserved keys: `_generator` and `_stack`

Two `_`-prefixed keys carry the run-constant scopes. `_generator`
sits inside a generator's slot beside its subject keys; `_stack`
sits at the top level beside the generator ids. A generator reads
them off `this.settings.enrichments.generator` / `.stack`, or from
anywhere with a context through `toGeneratorEnrichment` /
`toStackEnrichment`. No other key may start with `_`.

```jsonc
{
  "settings": {
    "enrichments": {
      "_stack": { "apiTitle": "Acme API" },
      "@acme/gen-docs": {
        "_generator": { "outputFormat": "mdx" },
        "/customers": { "post": { "main": { "title": "Create Customer" } } }
      }
    }
  }
}
```

The underscore names exist only in `client.json`. On the umbrella
and in `enrichments.ts` the members are `stack`, `generator` and
`subject`: `_stack` is read into `stack` and `[id]._generator` into
`generator`. There is no `_subject` key; the subject leaf is the value
at the routing path shown in the sections above.

A generator accepts a value at these keys only when its umbrella
declares that scope. A scope declared `v.undefined()` rejects any
value, so `_stack` needs every generator in the run to declare
`stack`. Stock generators declare neither run-constant scope; clone
a generator to opt it in.

## Where the shape comes from

The payload beneath the routing keys is whatever the generator's
author declared under `subject` in `gen-x/src/enrichments.ts`: a
Valibot umbrella `v.object({ subject, generator, stack })`, with
`subject` the per-item leaf and the run-constant scopes declared
`v.undefined()` when unused. **That schema is the canonical source
of truth for what a consumer may write.** Read its `subject` member
to learn the keys; for `gen-shadcn-form` they are `title`,
`description`, `submitLabel` and `fields`. A generator with no
settings declares core's `emptyEnrichmentSchema`. How an author
declares the umbrella and reads it inside a Projection is in
[add enrichment options](../../authoring/how-to/add-enrichment-options.md).

## Validation behavior

For each Projection the engine builds:

1. The factory's static `toEnrichments({ operation | refName, context, variant })`
   reads the three scopes through `context.readEnrichment`: the
   subject leaf at the path shown above, `[generatorId]._generator`,
   and `._stack`. Every read is recorded for the post-run audit.
2. Keys under `subject` and `generator` that the schema does not
   declare are reported as `UNKNOWN_ENRICHMENT_KEY` warnings. The
   `stack` bag is exempt: other generators own its other keys.
3. The `{ subject, generator, stack }` object is parsed once through
   the generator's umbrella schema via `v.parse`.
4. The parsed umbrella becomes `this.settings.enrichments` inside the
   Projection.

Outcomes:

- **Unknown keys**: dropped, and reported on
  `manifest.enrichmentWarnings` with a nearest-key suggestion.
- **Missing optional keys**: arrive as `undefined`.
- **Wrong-typed value**: the parse throws; that item is recorded as
  `error` in the manifest and the run continues.
- **Whole payload missing**: most stock generators wrap their
  subject schema in `v.optional(...)`, so the value arrives as
  `undefined`.
- **A value at a scope declared `v.undefined()`**: the parse throws.
- **A routing key nothing read**: reported after the run as
  `UNCONSUMED_ENRICHMENT` or `UNKNOWN_GENERATOR_ID`; see
  [error codes](../error-codes.md#enrichment-warnings).

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

Read `src/base.ts` — it calls one of the language veneers,
`toTsOasOperationProjectionBase`, `toTsModelProjectionBase`,
`toTsGqlOperationProjectionBase` or `toTsWebhookProjectionBase`.
That call determines the routing shape.

Stock generators are documented in
[reference/stock-generators/](../stock-generators/).

### Can I share enrichment payloads across operations?

Not at the subject scope: there is no wildcard, so a per-item value
is repeated for each `(path, method)`, `refName`, or
`(rootKind, fieldName)`. A value that is the same for every item of
one generator belongs at `[generatorId]._generator`; one shared by
every generator belongs at `._stack`. The generator must declare the
scope on its umbrella to accept it.

### Can enrichments arrive at a Snippet?

Indirectly. Snippets don't have a `settings` object, but their
parent Projection does. A Snippet can be passed enrichment-derived
values via constructor arguments:

```ts
new MyFieldSnippet({
  context,
  name,
  label: parent.settings.enrichments.subject?.fields
    ?.find(f => f.moduleSelect.schemaPath.at(-1) === name)?.label,
  destinationPath
})
```

The parent does the enrichment lookup; the Snippet receives the
result.

## Cross-references

- [enrichments concept](../../concepts/enrichments.md) — full mental model
- [client.json schema reference](client-json-schema.md) — the broader settings shape
- [How to configure enrichments](../../using/how-to/configure-enrichments.md) — the task-level guide
- [Add enrichment options](../../authoring/how-to/add-enrichment-options.md) — the authoring perspective

