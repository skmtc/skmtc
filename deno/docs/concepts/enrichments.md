# Enrichments

> The per-operation, per-model configuration surface declared by each
> generator via a Valibot schema and supplied by users in
> `client.json`. Enrichments are the *configurability* lever of the
> customization gradient — the narrow tweaks that don't require
> cloning. Each projection-base factory routes enrichments from its
> own hardcoded key path; there is no single uniform shape.

Enrichments are how stock generators expose user-facing options
without compromising the clone-to-customize philosophy. A generator
declares what payload it accepts (in its Valibot schema). A user
supplies values at a routing key derived from the operation or
model (in `client.json`). The factory does the lookup and delivers
the validated value to the Projection constructor.

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
- A filter for which operations the generator runs against

The mental model: enrichments are the inputs the *author* of a
generator decided to make user-configurable. Everything else stays
hardcoded as the clone seam.

### Enrichments aren't a filter — don't gate `isSupported` on them

A common authoring mistake on opt-in generators (forms, tables, page
shells) is to write `isSupported` so it returns `true` only when the
operation has the generator's enrichment payload. That makes
"having an enrichment" the on/off switch.

```ts
// ❌ Wrong — enrichment doubles as the on/off switch
isSupported({ context, operation }) {
  return getEnrichment(context, operation) !== undefined
}

// ✅ Right — declare capability; let client.json gate intent
isSupported({ operation }) {
  return ['post', 'put', 'patch'].includes(operation.method) &&
    operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
}
```

Two reasons to avoid the wrong form:

1. **`isSupported` declares capability, not user intent.** A
   generator that *could* produce output for `POST` with a JSON body
   should say so. Whether the user *wants* it to is a configuration concern.
2. **Enrichment is for customizing shape, not selecting set.** Once
   enrichment doubles as the switch, you can't have an enrichment
   with all-default values — you have to invent a sentinel. Code smell.

The right control for "only run for these operations" is the
**`include` allow-list** (or `.skip` deny-list) in
`client.json#settings`, applied *outside* the generator. See
[`using/how-to/skip-or-include-operations.md`](../using/how-to/skip-or-include-operations.md).

### Extensions vs enrichments: who owns it, and how often does it change?

Two places per-field metadata can live:

- **OpenAPI `x-*` extensions** — written into the schema document
  itself, exposed on every `Oas*` variant as
  `extensionFields?: Record<string, unknown>`. Travel with the
  schema through Parse untouched.
- **Enrichments** — declared per-generator in `enrichments.ts`,
  supplied by the consumer in `.settings/client.json`.

Pick along two axes:

| | Stable data (rarely changes) | Volatile data (changes independently of schema) |
|---|---|---|
| **You author the schema** | OpenAPI extension — the data ships with the schema and every consumer gets it for free | Enrichment — keep the volatile bit in `client.json` where it's a local edit, not a schema re-publish |
| **You only consume the schema** | Enrichment — you can't edit the upstream document anyway | Enrichment |

Why the asymmetry: editing an extension means changing the schema
document (and, if it's published, re-shipping it). Editing an
enrichment is a config change in the consumer's `client.json`. So
extensions earn their keep when the data is *stable enough* that the
re-publish cadence is fine, and *universal enough* that every
consumer wants the same value.

```yaml
# Schema-author + stable: canonical display label
components:
  schemas:
    Customer:
      type: object
      properties:
        firstName:
          type: string
          x-label: "Given name"
```

```ts
// In a generator: read the extension off the parsed schema
const label = resolved.properties?.['firstName']?.extensionFields?.['x-label']
```

```ts
// Schema-consumer + volatile: which list endpoint backs this field today
// → consumer's enrichment in client.json, NOT an extension
{
  "@scope/gen-shadcn-form": {
    "/customers": {
      "post": { "fields": [{ "id": "officeId", "references": "GetOffices" }] }
    }
  }
}
```

Cross-generator wiring (the operation-reference protocol — see
[cross-generator coordination](cross-generator-coordination.md#pattern-operation-reference-consumer-chosen-peer))
is always volatile by nature, so it always lives in the consumer's
enrichment.

A common smell when you *do* own the schema: declaring an enrichment
field that just mirrors a stable schema property — display labels,
canonical descriptions, formats. Move it to an extension and the
data stays with the schema, surviving any consumer's `client.json`
edits.

## Core owns the hierarchy; the generator owns the leaf

The design fact that explains everything else on this page: core's
type for enrichments
(`core/types/Enrichments.ts:121-124`) is

```ts
type GeneratorEnrichments = Record<
  string,
  ModelEnrichments | OasPathEnrichments | GqlRootKindEnrichments
>
```

Where each of the three "shape" types is a routing-key hierarchy
ending in `EnrichmentLeaf = unknown`. Core's Valibot schema types
the leaf as `v.unknown()`. **There is no canonical enrichment leaf
shape in core.**

The leaf shape lives entirely in the generator's
`toEnrichmentSchema()`. The engine hands a generator the unparsed
leaf at its routing key; the generator's own Valibot schema decides
what shape is acceptable.

Two consequences worth knowing:

- **Different generators at the same routing key never collide.**
  `enrichments['@skmtc/gen-shadcn-form']['/users']['post']` and
  `enrichments['@skmtc/gen-msw']['/users']['post']` can have
  completely different shapes. Each generator reads only its own
  slice and parses only against its own schema.
- **Adding a new enrichment field is a purely local change.**
  Generators can extend their own schemas independently — no
  coordinated core update, no canonical schema to maintain. This
  is what makes the clone-and-add-an-enrichment path viable for
  forks.

The split is also what lets enrichments stay an *opaque* lever for
core while being a *fully-typed* one for the generator's own
constructor.

## Where enrichments live

User-supplied enrichments go in `client.json`. The routing keys
under each generator depend on the generator's projection-base
kind; the payload shape *under* those routing keys is defined by
the generator's Valibot schema (see
[routing structure](#the-routing-structure) below):

```json
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/contacts": {
          "post": {
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
```

Here `/contacts` and `post` are the **routing** keys (the engine
navigates these); everything beneath is the **payload** shape
declared by the generator's Valibot schema.

## The routing structure

Each projection-base factory hardcodes its own `get(context.settings, ...)`
lookup. There are three shapes:

| Factory | Path read |
|---|---|
| `toOasOperationProjectionBase` | `enrichments.${generatorId}.${operation.path}.${operation.method}.${variant}` |
| `toModelProjectionBase` | `enrichments.${generatorId}.${refName}.${variant}` |
| `toGqlOperationProjectionBase` | `enrichments.${generatorId}.${operation.rootKind}.${operation.fieldName}.${variant}` |

Specifically:

- **OAS operation generators** route by `(operation.path, operation.method, variant)`
  — the literal OpenAPI path, lowercase HTTP verb, and variant name.
- **Model generators** route by `(refName, variant)` — the component
  name as it appears under `components.schemas`, plus variant name.
- **GraphQL operation generators** route by `(rootKind, fieldName, variant)`
  — `"Query" | "Mutation" | "Subscription"`, the operation field,
  and variant name.

The trailing `variant` level defaults to `'main'` when the consumer
declares no variants. Whenever any variant is declared, `'main'` MUST
be present (the engine throws via `toVariantList` otherwise). See
[`variants.md`](./variants.md).

There is no `operationId`-based routing for OAS, and no separate
"projection kind" or "projection key" routing level. Beneath the
engine-routed keys, the leaf value's shape is whatever the
generator's Valibot schema declares — see
[enrichments-shape reference](../reference/settings/enrichments-shape.md)
for the actual routing details and complete examples.

## How enrichments are declared

Each generator declares its accepted enrichment payload via a
Valibot schema in `gen-x/src/enrichments.ts`. The schema describes
what arrives at the lookup target — it does **not** describe the
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

The schema is registered with the generator's entry function:

```ts
// gen-shadcn-form/src/mod.ts
export const ShadcnFormEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
})
```

This declaration is the canonical source of truth for what
enrichment fields the generator accepts. **To know what payload a
generator's enrichments take, read its `enrichments.ts`.**

## How enrichments are consumed

Inside a Projection constructor, the validated enrichment value is
available as `this.settings.enrichments`:

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

The enrichments are pre-validated by the engine using the
generator's declared Valibot schema, so the Projection can assume
the shape is correct. Unknown keys are stripped silently; missing
optional keys arrive as `undefined`.

## How routing works at generate time

For each Projection the engine builds:

1. The factory's static `toEnrichments({ operation | refName, context })`
   runs.
2. It calls `get(context.settings, ...)` at the path shown in the
   table above for that projection-base kind.
3. The looked-up value is parsed via `v.parse(schema, value)`
   using the generator's declared Valibot schema.
4. The parsed value is delivered as `settings.enrichments` to the
   Projection constructor.

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
  add the enrichment field yourself.
- **Or**: clone and just hardcode the desired behavior — no
  enrichment needed if it's project-specific anyway.

Adding enrichments to a stock generator (to expose what users have
been hardcoding) is a reasonable upstream contribution. Adding
enrichments to a clone-then-published fork is fine for project-
local needs.

## AI-driven enrichments — `EnrichmentRequest`

A second enrichment path exists for cases where the *generator*
wants to *request* an enrichment value rather than wait for the
user to author one. The shape (`core/types/EnrichmentRequest.ts`):

```ts
type EnrichmentRequest<EnrichmentType> = {
  prompt: string
  enrichmentSchema: v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  content: string
}
```

A generator can implement `toEnrichmentRequest(refName)` on its
entry config. The function returns either a request descriptor
(prompt + schema + content to feed an LLM) or `undefined` to skip.
Tooling that integrates with an LLM fulfils the request, validates
the response against the schema, and persists the result into
`client.json` as if the user had authored it.

The flow:

```
generator.toEnrichmentRequest(refName)         → { prompt, schema, content }
                ↓
host AI tooling calls LLM with prompt + content
                ↓
LLM response parsed against schema
                ↓
result written into client.json#enrichments[generatorId][refName]
                ↓
next run consumes the result like a user-authored enrichment
```

Two ways this fits with the wider model:

- The leaf shape is still owned by the generator (same Valibot
  schema). The AI path doesn't bypass validation — it just defers
  the *author* of the leaf from "the user" to "an LLM
  constrained by the schema."
- The wire format is the same `client.json` slice. Tooling that
  doesn't fulfil requests simply ignores them; the project still
  works with whatever user-authored enrichments are present.

This is a deferred-fill pattern. It suits enrichments where the
value is *derivable* from the schema (a sensible default label,
a sample value, a description) but you'd rather not hand-author
hundreds of them across a large API.

## Common patterns

### Per-operation titles and labels

The most common enrichment pattern. The form generator's `title`
and `submitLabel` enable per-form text without cloning:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/users": {
        "post": { "title": "Create User", "submitLabel": "Create" }
      },
      "/users/{id}": {
        "put":    { "title": "Edit User",   "submitLabel": "Save" },
        "delete": { "title": "Delete User", "submitLabel": "Delete" }
      }
    }
  }
}
```

### Field-level overrides

When a schema field needs special handling that the generator's
default routing doesn't cover:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/contacts": {
        "post": {
          "fields": [
            { "id": "officeIds", "references": "GetOffices", "referenceKind": "searchable" }
          ]
        }
      }
    }
  }
}
```

This tells the form generator: when rendering the `officeIds` field
of `POST /contacts`, route it to the `GetOffices` operation
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

### Are enrichments hot-reloadable?

Yes — they're runtime config, not bundle code. Edit `client.json`,
re-run `skmtc generate`, the new values apply. No rebundle needed.
This is part of why enrichments are the right lever for narrow
per-operation tweaks.

### What about per-model enrichments (vs per-operation)?

Model generators (like `gen-zod` or `gen-typescript`) route by
`refName`:

```json
{
  "enrichments": {
    "@skmtc/gen-zod": {
      "UserModel":  { "description": "A user account" }
    }
  }
}
```

There is no second routing level — the value directly beneath the
refName **is** the validated payload.

### Can I share enrichment values across generators?

Not via the schema — each generator declares its own shape
independently. If you want shared values, replicate the relevant
portion to each generator's section. The engine doesn't share
enrichments across generators automatically.

### Do enrichments survive when I clone the generator?

User data in `client.json` is unaffected by cloning. But if the
clone keeps the same routing shape (same projection-base factory)
**and** the same generator `id`, the existing enrichments still
land. If you change the `id` (which you typically do when you
republish), update the `client.json` keys to match the new id.

## Further reading

- [Clone vs install](clone-vs-install.md) — where enrichments fit on the customization gradient
- [Projects and workspaces](projects-and-workspaces.md) — where `client.json` lives
- [Settings reference: client.json schema](../reference/settings/client-json-schema.md)
- [Settings reference: enrichments shape](../reference/settings/enrichments-shape.md)
- [`skmtc-cli` skill §6](../skills/skmtc-cli/SKILL.md) — operational guidance for configuring enrichments
- [`skmtc-generator` skill](../skills/skmtc-generator/SKILL.md) — how to declare a new enrichment in your generator
