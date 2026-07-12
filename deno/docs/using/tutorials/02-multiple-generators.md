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
skmtc install @skmtc/gen-typescript petstore
skmtc install @skmtc/gen-zod petstore
skmtc generate petstore
```

The output is **identical**. Generator order doesn't matter — see
[how idempotency works](../../explanation/how-idempotency-works.md).

## Step 5: Change the schema and watch the fan-out

So far the schema has been a remote URL. Make it local so you can
edit it. From the workspace root:

```bash
curl -o openapi.json https://petstore3.swagger.io/api/v3/openapi.json
```

Point `source` at the file in `.skmtc/petstore/.settings/client.json`
(relative paths resolve against the workspace root):

```jsonc
{ "source": "./openapi.json" }
```

Now add a field. In `openapi.json`, find
`components.schemas.Pet.properties` and add:

```jsonc
"nickname": { "type": "string" }
```

Regenerate and look for it:

```bash
skmtc generate petstore
grep -rn "nickname" src/generated/
```

Every file that spells out `Pet`'s shape updated in one regenerate —
the type gained a field and the validator gained a rule — while the
hook files that import them stayed consistent without changing. This
is the property you'll lean on daily: edit the schema, regenerate,
and everything derived from it agrees.

## Step 6 (optional): break the schema on purpose

While the schema is local, see what a bad item costs. In
`openapi.json`, change any `"$ref"` to point at a schema that doesn't
exist — for example `"#/components/schemas/DoesNotExist"` — and
regenerate:

```bash
skmtc generate petstore --json > out.json
jq '.manifest.parseIssues' out.json
```

The run completes. Unaffected files regenerate as normal; the broken
item and everything that depended on it are pruned rather than
mis-generated, and `parseIssues` names the casualty
(`INVALID_DEPENDENCY_REF`) with its location. One bad schema never
kills the run — the manifest always tells you exactly what it cost.

Undo the edit and regenerate before moving on.

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

Steps 5 and 6 showed the two properties this buys you day to day: a
schema edit fans out to every derived artifact in one regenerate, and
a schema mistake narrows the output instead of killing the run, with
the manifest naming exactly what was skipped.

## Next steps

- [Tutorial 03: Customize with enrichments](03-customize-with-enrichments.md) —
  add per-operation overrides via `client.json`
- [Recipe: Full-stack TypeScript app](../recipes/full-stack-typescript-app.md) —
  add forms, mocks, and tables on top of this stack
- [Definitions and files](../../concepts/definitions-and-files.md) —
  why this worked: the create-or-reuse mechanism
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) —
  the deeper mechanism
