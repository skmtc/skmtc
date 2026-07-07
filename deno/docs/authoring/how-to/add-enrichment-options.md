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

## Related

- [Enrichments concept](../../concepts/enrichments.md)
- [Enrichments shape reference](../../reference/settings/enrichments-shape.md)
- [How to configure enrichments (user-side)](../../using/how-to/configure-enrichments.md) —
  the consumer's view of what you're exposing
