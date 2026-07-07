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

The file declares a Valibot schema. The shape becomes the
contract for what keys `client.json` can carry under this
generator's ID.

```ts
// Stock gen-zod (minimal):
import * as v from 'valibot'
export const schema = v.optional(v.object({}))
export type EnrichmentSchema = v.InferOutput<typeof schema>
export const toEnrichmentSchema = () => schema
```

### Add Valibot fields

Add the fields you want. Use `v.optional(...)` for fields that
users can omit. The schema's *root* is what arrives at the lookup
target, so put the fields directly on the root object — don't wrap
them in an extra named object:

```ts
import * as v from 'valibot'

export const schema = v.optional(
  v.object({
    description: v.optional(v.string()),
    strict: v.optional(v.boolean())
  })
)

export type EnrichmentSchema = v.InferOutput<typeof schema>
export const toEnrichmentSchema = () => schema
```

`gen-zod` is built on `toTsModelProjectionBase` (the
lang-typescript veneer), so the routing
path is `enrichments[generatorId][refName]`. Users supply
enrichments like:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-zod": {
      "User": { "description": "A user account", "strict": true }
    }
  }
}
```

For OAS operation generators built on `toTsOasOperationProjectionBase`,
the path would instead be `enrichments[generatorId][path][method]`;
for GraphQL it's `enrichments[generatorId][rootKind][fieldName]`.
See [enrichments shape](../../reference/settings/enrichments-shape.md)
for the routing details.

### Consume in the Projection constructor

The validated enrichment is at `this.settings.enrichments`:

```ts
// In ZodProjection.ts
override toString(): string {
  const { description, strict } = this.settings.enrichments ?? {}

  const objectCall = strict ? 'z.strictObject' : 'z.object'
  const jsdoc = description ? `/** ${description} */\n` : ''

  return `${jsdoc}${objectCall}({ ... })`
}
```

Default to a sensible fallback when the enrichment is absent.

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

Set an enrichment in `.skmtc/<project>/.settings/client.json`:

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-zod": {
        "User": { "description": "test description" }
      }
    }
  }
}
```

Regenerate. Inspect the User schema's output — the JSDoc should
appear above the declaration.

## Troubleshooting

- **Enrichment silently ignored** — Unknown keys are stripped by
  Valibot. Most common cause: schema-key typo, or `toEnrichmentSchema`
  not properly wired in the Entry.
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
