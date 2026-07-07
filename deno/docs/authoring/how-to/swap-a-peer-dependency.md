# How to swap a peer dependency

> Switch a cloned generator from one peer generator to another
> (e.g., from `gen-tanstack-query-supabase-zod` to
> `gen-tanstack-query-fetch-zod`).

## When to use this

A stock generator's hardcoded peer dependency doesn't match your
stack. Canonical case: `gen-shadcn-form` hardcodes an import of
`TanstackQuery` from `@skmtc/gen-tanstack-query-supabase-zod`;
you want the fetch variant instead.

## Prerequisites

- The generator cloned into your project.
- The target peer generator installed or cloned.

## Steps

### Install or clone the target peer generator

```bash
skmtc install @skmtc/gen-tanstack-query-fetch-zod my-project
```

If you'll customize the peer too, clone it. If it'll be used
unmodified, install is enough.

### Edit the import in the main Projection file

Open the cloned generator's main Projection file (e.g.,
`gen-shadcn-form/src/ShadcnForm.ts`). The hardcoded peer import
sits at the top:

```ts
// Before
import { TanstackQuery } from '@skmtc/gen-tanstack-query-supabase-zod'

// After
import { TanstackQuery } from '@skmtc/gen-tanstack-query-fetch-zod'
```

The import name (`TanstackQuery`) is conventional — both stock
generators export a class by that name. If the names differ in
your case, you'll also need to update references in the
Projection's constructor body.

### Verify the peer exports a compatible Projection

The two generators export Projections with the **same shape**:

- A `static toIdentifier` method returning an `Identifier`
- A `static toExportPath` method returning a path
- A constructor accepting `{ context, operation, settings }`
- A `toString()` returning the generated value

For stock peers in the same family (the two tanstack-query
variants are designed as siblings), compatibility is guaranteed.
For unrelated peers, audit the shape before swapping.

If the peer's `toIdentifier` produces different names (e.g.,
`useCreateUser` vs `useUserCreateMutation`), the import in your
output will follow — usually fine, occasionally surprising.

### Rebundle and regenerate

```bash
skmtc bundle my-project
skmtc generate my-project
```

The bundle picks up the new import. Output now references the
fetch-variant hook.

## Verification

Open the form file. The hook reference should now match the new
peer's naming:

```tsx
// Before swap: uses Supabase-variant hook
import { useAddPet } from './useAddPet.supabase.generated.ts'

// After swap: uses fetch-variant hook
import { useAddPet } from './useAddPet.generated.ts'
```

Run the consumer app — the hooks should now call `fetch` instead
of the Supabase client.

## Troubleshooting

- **Compile error: "Cannot find module ..."** — Either the peer
  isn't installed, or you're importing from a clone path that
  doesn't exist. Run `skmtc list <project>` to confirm the peer.
- **Different identifier shape** — If the peer's `toIdentifier`
  produces a different name shape, your output references the
  new name. Consumer code may break. Audit and update.
- **Both peers produce competing output** — If you have both
  installed (Supabase variant from before + fetch variant for
  the swap), both will try to produce hook files. Remove the unused
  peer via `skmtc remove`.
- **`isSupported` differs** — One peer may filter more strictly
  than the other. If a form is rendered but the corresponding
  hook isn't (or vice versa), the peers' `isSupported` checks
  diverge. Audit.

## Related

- [How to compose with another generator](compose-with-another-generator.md) —
  the underlying mechanism
- [gen-shadcn-form reference](../../reference/stock-generators/gen-shadcn-form.md) —
  the canonical example of a hardcoded peer
- [Tutorial: Cloning a generator](../tutorials/01-cloning-a-generator.md)
