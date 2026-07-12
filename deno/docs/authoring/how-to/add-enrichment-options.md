# How to add enrichment options

> Extend a cloned generator's enrichment schema to expose new
> user-facing options in `client.json`.

## When to use this

You want users to override some behavior of your cloned generator
without further code changes. The mechanism is
[enrichments](../../concepts/enrichments.md) — per-operation
configuration passed from `client.json` to the Projection.

## Prerequisites

- The generator cloned into your project.
- Light familiarity with [Valibot](https://valibot.dev/) (the
  validation library SKMTC uses for enrichment schemas).

## Steps

### Edit `gen-x/src/enrichments.ts`

The file declares a Valibot schema via `toEnrichmentSchema`. The
schema is the **three-scope enrichment umbrella** — an object with
`subject`, `generator`, and `stack` keys — not a flat object of your
fields. Your per-item options live under `subject`; the two
run-constant scopes (`generator`, `stack`) are declared
`v.undefined()` when you don't use them.

```ts
// Stock gen-zod (no enrichments): re-exports core's empty umbrella.
import { emptyEnrichmentSchema, type EmptyEnrichments } from '@skmtc/core'
export const toEnrichmentSchema = () => emptyEnrichmentSchema
export type EnrichmentSchema = EmptyEnrichments
```

`emptyEnrichmentSchema` is the umbrella with all three scopes
`v.undefined()`. `toEnrichmentSchema` is a **required** field on both
the entry config and the projection-base config — the derived static
`toEnrichments` calls it to parse the umbrella, so it can never be
omitted.

### Add Valibot fields under `subject`

Put the fields users can set per item under `subject`. Use
`v.optional(...)` for fields they can omit. Keep `generator` and
`stack` as `v.undefined()` unless you use those scopes:

```ts
import * as v from 'valibot'

// The per-item leaf — what a user writes for one model/operation.
export const zodSubject = v.optional(
  v.object({
    description: v.optional(v.string()),
    strict: v.optional(v.boolean())
  })
)

// The three-scope umbrella. This generator only reads `subject`.
export const enrichmentSchema = v.object({
  subject: zodSubject,
  generator: v.undefined(),
  stack: v.undefined()
})

export type EnrichmentSchema = v.InferOutput<typeof enrichmentSchema>
export const toEnrichmentSchema = () => enrichmentSchema
```

`gen-zod` is built on `toTsModelProjectionBase`, so the subject
routing path is `enrichments[generatorId][refName][variant]`. The
trailing `variant` level is `'main'` by default and **must be present**
whenever any variant is declared. Users write the subject leaf
directly under the variant key:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-zod": {
      "User": {
        "main": { "description": "A user account", "strict": true }
      }
    }
  }
}
```

For OAS operation generators (`toTsOasOperationProjectionBase`) the
subject path is `enrichments[generatorId][path][method][variant]`; for
GraphQL (`toTsGqlOperationProjectionBase`) it's
`enrichments[generatorId][rootKind][fieldName][variant]`. The two
run-constant scopes, when used, live at `enrichments[generatorId]._generator`
and the top-level `enrichments._stack`. See
[enrichments shape](../../reference/settings/enrichments-shape.md)
for the routing details.

### Consume in the Projection

`this.settings.enrichments` is the parsed umbrella. Read your per-item
options off its `subject` scope:

```ts
// In ZodProjection.ts
override toString(): string {
  const { description, strict } = this.settings.enrichments.subject ?? {}

  const objectCall = strict ? 'z.strictObject' : 'z.object'
  const jsdoc = description ? `/** ${description} */\n` : ''

  return `${jsdoc}${objectCall}({ ... })`
}
```

Default to a sensible fallback when the enrichment is absent. (The
`generator` and `stack` scopes, if you declared them, read the same
way — `this.settings.enrichments.generator` / `.stack`.)

### Document for users

Add the schema fields to your generator's README. If this is an
internal clone, write a project-local README at
`.skmtc/<project>/<gen>/README.md` so future maintainers know
what enrichments exist.

### Rebundle and regenerate

```bash
skmtc bundle my-project
skmtc generate my-project
```

After bundling, add some test enrichments to `client.json` and
verify the output reflects them.

## Verification

Set an enrichment in `.skmtc/<project>/.settings/client.json` (the
subject leaf under the `main` variant):

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-zod": {
        "User": {
          "main": { "description": "test description" }
        }
      }
    }
  }
}
```

Regenerate. Inspect the User schema's output — the JSDoc should
appear above the declaration.

## Troubleshooting

- **Enrichment silently ignored** — Unknown keys are stripped by
  Valibot. Most common causes: schema-key typo; the fields declared on
  the umbrella root instead of under `subject`; or the `main` variant
  key omitted in `client.json` (the value must sit under
  `[…][variant]`, not directly under the item key).
- **Valibot validation throws** — A required field is missing or a
  type doesn't match. Use `v.optional(...)` for everything that
  can reasonably default.
- **Changes not visible after edit** — Rebundle. Source-level
  edits don't reach the worker until you run `skmtc bundle`.

## Forwards compatibility

Adding new optional enrichment fields is **always safe**. Old
`client.json` files (without your new fields) keep working —
they just don't get the new behavior. Removing or changing
existing fields is a breaking change.

## The umbrella in depth

### How enrichments are declared

Each generator declares ONE **composite** schema covering all three scopes —
`v.object({ subject, generator, stack })` — in `gen-x/src/enrichments.ts`. Each
member describes the leaf at that scope; unused scopes are declared
`v.undefined()`:

```ts
// gen-shadcn-form/src/enrichments.ts
import * as v from "valibot";
import { lensInputModuleType, moduleSelect } from "@skmtc/core";

export const formFieldItem = v.object({
  // `moduleSelect` is the field binding: `schemaPath` (the join key) plus an
  // optional consumer component bound to the field's lens.
  moduleSelect: v.pipe(moduleSelect(lensInputModuleType), v.title("Input")),
  label: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  references: v.optional(v.string()),
});

// The subject-scoped leaf — the per-operation form override.
export const formSchema = v.optional(
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    submitLabel: v.optional(v.string()),
    fields: v.optional(v.array(formFieldItem)),
  }),
);

// The three-scope enrichment umbrella. This generator only consumes the
// subject scope; `generator` / `stack` are unused (declared `v.undefined()`).
export const enrichmentSchema = v.object({
  subject: formSchema,
  generator: v.undefined(),
  stack: v.undefined(),
});

export type EnrichmentSchema = v.InferOutput<typeof enrichmentSchema>;
export const toEnrichmentSchema = () => enrichmentSchema;
```

`toEnrichmentSchema` is **required** on both the entry factory and the
projection-base config — it's what lets the engine assemble and parse the
umbrella cast-free (see
[how routing works](#how-routing-works-at-generate-time)). It's wired in both
places:

```ts
// gen-shadcn-form/src/mod.ts
export const ShadcnFormEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
});
```

```ts
// gen-shadcn-form/src/base.ts
export const ShadcnFormBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  // ...
});
```

A generator with **no enrichments at any scope** declares core's
`emptyEnrichmentSchema` (every member `v.undefined()`) instead of hand-rolling
the umbrella:

```ts
// gen-typescript/src/enrichments.ts
import { type EmptyEnrichments, emptyEnrichmentSchema } from "@skmtc/core";

export const toEnrichmentSchema = () => emptyEnrichmentSchema;

export type EnrichmentSchema = EmptyEnrichments;
```

This declaration is the canonical source of truth for what enrichment fields the
generator accepts. **To know what payload a generator's enrichments take, read
its `enrichments.ts`.**


### How enrichments are consumed

Inside a Projection, the validated three-scope umbrella is available as
`this.settings.enrichments`. Read the scope you want — `.subject`, `.generator`,
or `.stack` — each typed (and `undefined` when the generator declares nothing
for that scope):

```ts
// gen-shadcn-form/src/ShadcnForm.ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments.subject ?? {}

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

The enrichments are pre-validated by the engine using the generator's declared
composite Valibot schema, so the Projection can assume the shape is correct.
Unknown keys are stripped silently; missing optional keys arrive as `undefined`.

#### Reading scopes outside a Projection

`this.settings.enrichments` only exists where there's a `ContentSettings` — i.e.
inside a Projection. The `generator` and `stack` scopes are run-constants, so
they're often needed elsewhere: in `transform`, in `isSupported`, in an
accumulator snippet. From those contexts (anywhere holding a `context`), read
them with the helper readers from `@skmtc/core`:

```ts fragment
import { toGeneratorEnrichment, toStackEnrichment } from "@skmtc/core";

// generator-scoped leaf — context.settings.enrichments[id]._generator
const genConfig = toGeneratorEnrichment(context, id, generatorSchema);

// stack-scoped leaf — context.settings.enrichments._stack
const stackConfig = toStackEnrichment(context, stackSchema);
```

The return type is inferred from the schema you pass — no cast. Each reader
looks up by a known reserved key and never enumerates, so a generator can't trip
over the reserved keys. (There is no `subject` reader here: the subject scope is
per-item and is resolved by the engine into `ContentSettings`.)


## Design guidance

### Enrichments aren't a filter — don't gate `isSupported` on them

A common authoring mistake on opt-in generators (forms, tables, page shells) is
to write `isSupported` so it returns `true` only when the operation has the
generator's enrichment payload. That makes "having an enrichment" the on/off
switch.

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

1. **`isSupported` declares capability, not user intent.** A generator that
   _could_ produce output for `POST` with a JSON body should say so. Whether the
   user _wants_ it to is a configuration concern.
2. **Enrichment is for customizing shape, not selecting set.** Once enrichment
   doubles as the switch, you can't have an enrichment with all-default values —
   you have to invent a sentinel. Code smell.

The right control for "only run for these operations" is the **`include`
allow-list** (or `.skip` deny-list) in `client.json#settings`, applied _outside_
the generator. See
[`using/how-to/skip-or-include-operations.md`](../../using/how-to/skip-or-include-operations.md).


### Extensions vs enrichments: who owns it, and how often does it change?

Two places per-field metadata can live:

- **OpenAPI `x-*` extensions** — written into the schema document itself,
  exposed on every `Oas*` variant as
  `extensionFields?: Record<string, unknown>`. Travel with the schema through
  Parse untouched.
- **Enrichments** — declared per-generator in `enrichments.ts`, supplied by the
  consumer in `.settings/client.json`.

Pick along two axes:

|                                 | Stable data (rarely changes)                                                           | Volatile data (changes independently of schema)                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **You author the schema**       | OpenAPI extension — the data ships with the schema and every consumer gets it for free | Enrichment — keep the volatile bit in `client.json` where it's a local edit, not a schema re-publish |
| **You only consume the schema** | Enrichment — you can't edit the upstream document anyway                               | Enrichment                                                                                           |

Why the asymmetry: editing an extension means changing the schema document (and,
if it's published, re-shipping it). Editing an enrichment is a config change in
the consumer's `client.json`. So extensions earn their keep when the data is
_stable enough_ that the re-publish cadence is fine, and _universal enough_ that
every consumer wants the same value.

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
const label = resolved.properties?.["firstName"]?.extensionFields?.["x-label"];
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
[cross-generator coordination](../../concepts/cross-generator-coordination.md#pattern-operation-reference-consumer-chosen-peer))
is always volatile by nature, so it always lives in the consumer's enrichment.

A common smell when you _do_ own the schema: declaring an enrichment field that
just mirrors a stable schema property — display labels, canonical descriptions,
formats. Move it to an extension and the data stays with the schema, surviving
any consumer's `client.json` edits.


### AI-driven enrichments — `EnrichmentRequest`

A second enrichment path exists for cases where the _generator_ wants to
_request_ an enrichment value rather than wait for the user to author one. The
shape (`core/types/EnrichmentRequest.ts`):

```ts
type EnrichmentRequest<EnrichmentType> = {
  prompt: string;
  enrichmentSchema: v.BaseSchema<
    EnrichmentType,
    EnrichmentType,
    v.BaseIssue<unknown>
  >;
  content: string;
};
```

A generator can implement `toEnrichmentRequest(refName)` on its entry config.
The function returns either a request descriptor (prompt + schema + content to
feed an LLM) or `undefined` to skip. Tooling that integrates with an LLM fulfils
the request, validates the response against the schema, and persists the result
into `client.json` as if the user had authored it.

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

- The leaf shape is still owned by the generator (same Valibot schema). The AI
  path doesn't bypass validation — it just defers the _author_ of the leaf from
  "the user" to "an LLM constrained by the schema."
- The wire format is the same `client.json` slice. Tooling that doesn't fulfil
  requests ignores them; the project still works with whatever user-authored
  enrichments are present.

This is a deferred-fill pattern. It suits enrichments where the value is
_derivable_ from the schema (a sensible default label, a sample value, a
description) but you'd rather not hand-author hundreds of them across a large
API.


## Related

- [Enrichments concept](../../concepts/enrichments.md)
- [Enrichments shape reference](../../reference/settings/enrichments-shape.md)
- [How to configure enrichments (user-side)](../../using/how-to/configure-enrichments.md) —
  the consumer's view of what you're exposing
