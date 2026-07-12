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

Three generators ran against the same schema, two of them needed the
same shared pieces — and each shared piece exists exactly once,
referenced by imports. Nothing was deduplicated after the fact: every
generator either created a definition or reused one that was already
registered, so a duplicate never existed in the first place. The same
mechanism is why the rerun was byte-identical and why reordering the
generators changed nothing.

How that works — files as keyed maps, insert as create-or-reuse — is
one short page:
[Definitions and files](../../concepts/definitions-and-files.md).

## Next steps

- [Tutorial 03: Customize with enrichments](03-customize-with-enrichments.md) —
  add per-operation overrides via `client.json`
- [Recipe: Full-stack TypeScript app](../recipes/full-stack-typescript-app.md) —
  add forms, mocks, and tables on top of this stack
- [Definitions and files](../../concepts/definitions-and-files.md) —
  why this worked: the create-or-reuse mechanism
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) —
  the deeper mechanism
