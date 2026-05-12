# Enrichments

> The per-operation, per-model configuration surface declared by each
> generator via a Valibot schema and supplied by users in
> `client.json`. Enrichments are the *configurability* lever of the
> customization gradient — the narrow tweaks that don't require
> cloning. They're routed by a four-level key structure
> (`generatorId → projectionKind → operationOrRefId → projectionKey`)
> and validated against the generator's declared schema.

Enrichments are how stock generators expose user-facing options
without compromising the clone-to-customize philosophy. A generator
declares what it accepts (in its Valibot schema). A user supplies
values (in `client.json`). The engine routes them to the generator
constructor that consumes them.

## What enrichments are (and aren't)

Enrichments **are**:

- Per-operation or per-model user overrides
- Declared per-generator via Valibot schema
- Validated at parse time
- Supplied by the user in `.settings/client.json`
- Available at generation time as `this.settings.enrichments`
  inside a Projection

Enrichments **are not**:

- A general configuration system for *all* customization
- A replacement for cloning when you need behavioral changes
- A way to change identifier naming, export paths, or output template
  structure (those are clone-time changes)

The mental model: enrichments are the inputs the *author* of a
generator decided to make user-configurable. Everything else stays
hardcoded as the clone seam.

## Where enrichments live

User-supplied enrichments go in `client.json`:

```json
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "mutation": {
          "CreateContact": {
            "form": {
              "title": "Create Contact",
              "submitLabel": "Save",
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
}
```

## The routing structure

The enrichment key is four levels deep:

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

- **`generatorId`**: which generator package is being configured
  (`@skmtc/gen-shadcn-form`, `@skmtc/gen-zod`, etc.)
- **`projectionKind`**: a generator may emit multiple kinds of
  Projection — e.g., a form generator might emit `"mutation"` forms
  for POST/PUT and `"query"` filters for GET. The kind discriminates.
- **`operationOrRefId`**: the specific operation (by `operationId`
  in OAS) or model (by refName) being configured
- **`projectionKey`**: a final discriminator for the specific
  Projection within the operation/kind combination (e.g., `"form"`
  for the form output, distinct from any sibling Projection from
  the same generator-and-operation)

The deeply nested key lets one generator's enrichments cleanly
separate per-kind, per-operation, per-projection options without
collisions.

## How enrichments are declared

Each generator declares its accepted enrichment shape via a Valibot
schema in `gen-x/src/enrichments.ts`:

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
    form: formPropertiesSchema
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

This declaration is the canonical source of truth for what
enrichment keys the generator accepts. **To know what enrichments a
generator supports, read its `enrichments.ts`.**

## How enrichments are consumed

Inside a Projection constructor, the validated enrichment value is
available as `this.settings.enrichments`:

```ts
// gen-shadcn-form/src/ShadcnForm.ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments?.form ?? {}

  return `(${this.parameter}) => {
    // ...
    return (
      <Form>
        <form>
          ${title ? `<h2>${title}</h2>` : ''}
          ${description ? `<p>${description}</p>` : ''}
          ${this.fields}
          <Button>${submitLabel || 'Submit'}</Button>
        </form>
      </Form>
    )
  }`
}
```

The enrichments are pre-validated by the engine using the generator's
declared Valibot schema, so the Projection can assume the shape is
correct. Unknown keys are stripped silently; missing optional keys
arrive as `undefined`.

## How routing works at parse time

When the engine reads `client.json`:

1. The CLI loads `client.json` and finds `settings.enrichments`
2. For each generator in `deno.json#imports`, the engine looks up
   `enrichments[<generatorId>]`
3. If present, the value is validated against the generator's
   declared Valibot schema (via `toEnrichmentSchema()`)
4. The validated value is routed into `ContentSettings.enrichments`
   for each `(projectionKind, operationOrRefId, projectionKey)` the
   generator processes

The Projection's `static toEnrichments({ operation, context })`
method (provided by the projection-base factory) does the
`projectionKind → operationOrRefId → projectionKey` lookup — it
slices the per-generator enrichment value down to just the per-item
slice this Projection needs.

For most generators, `toEnrichments` is generated by the factory; you
don't write it manually unless you have unusual routing needs.

## The relationship to clone-vs-install

Enrichments fit in the middle of the customization gradient:

```
1. Use stock         → install + accept defaults
2. Configure         → enrichments in client.json      ← here
3. Customize behavior → clone + edit source
4. Author new        → write a generator from scratch
```

Enrichments are level 2. They let you tweak per-operation behavior
without bringing source into your project. The price: you can only
tweak what the generator's author chose to expose.

If the generator doesn't expose what you need:

- **Stop and consider**: maybe the answer is to clone (level 3) and
  add the enrichment field yourself
- **Or**: clone and just hardcode the desired behavior — no
  enrichment needed if it's project-specific anyway

Adding enrichments to a stock generator (to expose what users have
been hardcoding) is a reasonable upstream contribution. Adding
enrichments to a clone-then-published fork is fine for project-
local needs.

## Common patterns

### Per-operation titles and labels

The most common enrichment pattern. The form generator's `form.title`
and `form.submitLabel` enable per-form text without cloning:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateUser":  { "form": { "title": "Create User",  "submitLabel": "Create" } },
        "UpdateUser":  { "form": { "title": "Edit User",    "submitLabel": "Save"   } },
        "DeleteUser":  { "form": { "title": "Delete User",  "submitLabel": "Delete" } }
      }
    }
  }
}
```

### Field-level overrides

When a schema field needs special handling that the generator's
default dispatch doesn't cover:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateContact": {
          "form": {
            "fields": [
              { "id": "officeIds", "references": "GetOffices", "referenceKind": "searchable" }
            ]
          }
        }
      }
    }
  }
}
```

This tells the form generator: when emitting the `officeIds` field
in `CreateContact`, route it to the `GetOffices` operation
(searchable dropdown), not the default string-array renderer.

### Operation-reference patterns

A common enrichment shape across generators: pointing one operation
at another. The `references` field in form fields above is an
example — the form's `officeIds` field references the `GetOffices`
operation as the source of selectable values.

This is how generators compose across the operation graph without
hardcoded knowledge of specific operations.

## Common questions

### Are enrichments validated?

Yes. Each generator's `toEnrichmentSchema()` returns a Valibot
schema that the engine uses to validate the user's input. Unknown
fields are stripped silently; missing optional fields are
`undefined`; type mismatches surface as parse errors.

### Can I extend a stock generator's enrichments without cloning?

No. The enrichment schema is part of the generator's source. To add
new keys, you clone the generator and edit `enrichments.ts`.

### What if I have a deeply nested enrichment but only need to set one leaf?

Specify the full path — there's no shortcut syntax. The four-level
key structure is required:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateUser": {
          "form": { "submitLabel": "Create" }
        }
      }
    }
  }
}
```

If you need to set the same value for many operations, repeat the
entry for each operationId. There's no wildcard.

### Are enrichments hot-reloadable?

Yes — they're runtime config, not bundle code. Edit `client.json`,
re-run `skmtc generate`, the new values apply. No rebundle needed.
This is part of why enrichments are the right lever for narrow
per-operation tweaks.

### What about per-model enrichments (vs per-operation)?

Model generators (like `gen-zod` or `gen-typescript`) accept
enrichments keyed by refName instead of operationId. The shape is
parallel:

```json
{
  "enrichments": {
    "@skmtc/gen-zod": {
      "model": {
        "UserModel": { /* per-model enrichment payload */ }
      }
    }
  }
}
```

The `projectionKind` for model generators is typically `"model"`.

### Can I share enrichment values across generators?

Not via the schema — each generator declares its own shape
independently. If you want shared values, define them at the
`client.json` JSON level (e.g., using `&anchor` / `*alias` if your
config is YAML) and replicate the relevant portion to each
generator's section. The engine doesn't share enrichments across
generators automatically.

### Do enrichments survive when I clone the generator?

Yes. Enrichments are user data in `client.json`; cloning the
generator doesn't touch user data. After cloning, your enriched
operations still emit with the configured titles/labels/etc. If you
*extend* the enrichment schema in the clone, you can add new keys
that the user supplies in the same client.json.

## Further reading

- [Clone vs install](clone-vs-install.md) — where enrichments fit on the customization gradient
- [Projects and workspaces](projects-and-workspaces.md) — where `client.json` lives
- [Settings reference: client.json schema](../reference/settings/client-json-schema.md)
- [Settings reference: enrichments shape](../reference/settings/enrichments-shape.md)
- [`skmtc-cli` skill §6](../skills/skmtc-cli/SKILL.md) — operational guidance for configuring enrichments
- [`skmtc-generator` skill](../skills/skmtc-generator/SKILL.md) — how to declare a new enrichment in your generator
