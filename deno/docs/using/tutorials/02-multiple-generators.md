# Multiple generators

> Add TypeScript types and Tanstack Query hooks alongside the Zod
> validators from [tutorial 01](01-your-first-generation.md), and
> watch the cross-generator coordination converge.

## What you'll build

A project running three stock generators against the same OpenAPI
spec, producing:

- Zod validation schemas (from tutorial 01)
- TypeScript type aliases
- Tanstack Query `useQuery`/`useMutation` hooks

The interesting part: the hooks reference the Zod schemas the
validator generator produces — and the engine produces each schema
exactly once even though both generators want it.

## Prerequisites

- The `petstore` project from [tutorial 01](01-your-first-generation.md).
- Deno + `skmtc` CLI installed.

## Step 1: Install additional generators

```bash
skmtc install @skmtc/gen-typescript petstore
skmtc install @skmtc/gen-tanstack-query-fetch-zod petstore
```

Verify with `skmtc list petstore --json` — three generators should
be installed now.

## Step 2: Inspect the dependency relationships

`@skmtc/gen-tanstack-query-fetch-zod` doesn't declare a hard
dependency on `gen-zod` or `gen-typescript`, but its generated
hooks reference Zod schemas (for validation) and TS types (for
parameters). When all three run together, they converge on shared
output via [cross-generator coordination](../../concepts/cross-generator-coordination.md).

You don't need to configure anything for this — coordination is
automatic.

## Step 3: Regenerate

```bash
skmtc generate petstore
```

The engine runs all three generators against the same parsed
document. New files appear in `src/generated/`:

- `Pet.generated.ts` — now contains both `export const pet =
  z.object({...})` (from gen-zod) **and** `export type Pet = {...}`
  (from gen-typescript). One file per schema component, both
  generators contributing.
- `pet/useGetPetById.generated.ts` (or similar) — the hook file,
  importing `pet` and `Pet` from the schema file above.

## Step 4: Verify the cross-generator coordination

Look inside a hook file:

```ts
import { pet, type Pet } from '../Pet.generated.ts'

export const useGetPetById = (args: { petId: number }) =>
  useQuery({
    queryKey: ['getPetById', args],
    queryFn: () => fetch(`/pet/${args.petId}`).then(r => r.json()).then(pet.parse)
  })
```

The `pet` import is the same `pet` that `gen-zod` registered — not a
duplicate. If you run `skmtc generate` again, the output is
byte-identical: the engine is deterministic.

Try swapping the install order:

```bash
skmtc remove petstore @skmtc/gen-zod
skmtc remove petstore @skmtc/gen-typescript
skmtc install @skmtc/gen-tanstack-query-fetch-zod petstore  # already installed
skmtc install @skmtc/gen-typescript petstore
skmtc install @skmtc/gen-zod petstore
skmtc generate petstore
```

The output is **identical**. Generator order doesn't matter — see
[how idempotency works](../../explanation/how-idempotency-works.md).

## What just happened

Each generator's `transform` function ran against the same parsed
`OasDocument`. Internally:

- `gen-zod` called `insertModel(ZodProjection, refName)` for each
  schema → produced `Pet.generated.ts` with `export const pet =
  ...`
- `gen-typescript` called `insertModel(TsProjection, refName)` for
  each schema → produced `export type Pet = ...` in the same file
- `gen-tanstack-query-fetch-zod` ran per operation, and its
  Projection's `toString()` called `insertNormalizedModel` for the
  request/response schemas. Both calls landed on the same cache
  key `(name, exportPath)` as the standalone generators — the
  engine returned the existing definitions without creating
  duplicates.

Output is what each generator registered; nothing was deduplicated
*after the fact*. The cache key made duplicates structurally
impossible.

## Next steps

- [Tutorial 03: Customize with enrichments](03-customize-with-enrichments.md) —
  add per-operation overrides via `client.json`
- [Recipe: Full-stack TypeScript app](../recipes/full-stack-typescript-app.md) —
  add forms, mocks, and tables on top of this stack
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) —
  the deeper mechanism
