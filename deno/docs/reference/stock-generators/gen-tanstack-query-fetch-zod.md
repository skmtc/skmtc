# @skmtc/gen-tanstack-query-fetch-zod

> Produce Tanstack Query hooks (`useQuery`, `useMutation`) with `fetch`
> as the transport and Zod for runtime validation.

An operation generator. Composes with `@skmtc/gen-zod` for typed
request/response validation. The most-cloned client generator —
because the fetch wrapper, error handling, and base URL conventions
are almost always team-specific.

## What it generates

Per query operation (real output, abridged):

```ts
import {pet} from '@/types/pet.generated.ts'
import {useQuery} from '@tanstack/react-query'

export type UseGetApiPetPetIdArgs = {petId: number};

export const useGetApiPetPetId = ({petId}: UseGetApiPetPetIdArgs) => {
  const result = useQuery({
    queryKey: ['pet', petId],
    queryFn: async () => {
      const res = await fetch(`/pet/${petId}`, {
        method: 'GET'
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error)
      }

      const data = await res.json()
      return pet.parse(data)
    }
  })

  return result
};
```

Mutation operations get a `useMutation` hook with query-client
invalidation wired to `onSuccess`, typed mutation variables, and the
same response-side `parse`.

The `user`/`userBody` Zod schemas come from `gen-zod` via
`insertNormalizedModel` — both generators share a single registered
schema.

## Source

`skmtc-generators/gen-tanstack-query-fetch-zod/src/`

## Key decisions

- **`isSupported` filter.** GETs and DELETEs are always supported.
  POST/PUT/PATCH are supported **only if the operation has a
  request body** — operations without a body produce
  unhelpfully-typed mutations.
- **GET → `useQuery`, mutation methods → `useMutation`.** The
  mapping is hardcoded in the Projection. DELETE goes to
  `useMutation` despite typically having no body.
- **Hardcoded `fetch` transport.** No transport abstraction — the
  generated code calls `fetch` directly. This is the canonical
  customization seam: clone and replace with your own wrapper
  (`axios`, custom `apiFetch`, etc.).
- **Response-side validation.** Responses are parsed with the shared
  Zod schema (`<schema>.parse(data)`) so bad payloads throw at the
  query boundary; request bodies are serialized as-is.

## What to learn from it

- **`isSupported` for operation filtering.** The body-required
  check (`Boolean(operation.toRequestBody(...))`) shows how to gate
  generation on operation shape, not just method.
- **Composing with model generators.** The hooks reference Zod
  schemas the form generator also references — the engine produces
  each schema once, with both generators contributing imports.
  This is the cross-generator coordination story in practice.
- **Per-method dispatch in the Projection.** GET → query,
  POST/PUT/PATCH → mutation. The dispatch logic lives in the
  Projection's `toString()`.

## Common customizations when cloned

- **Swap `fetch` for a custom wrapper.** The most common edit. Your
  team's `apiFetch` likely handles auth, retries, and base URL —
  replace the literal `fetch(...)` calls.
- **Customize base URL handling.** The stock produces relative paths;
  most teams want a base-URL prefix (env-driven, or threaded
  through deps).
- **Add error handling.** The stock throws raw fetch errors. Add
  retry policies, error boundaries, or transformation to a custom
  error class.
- **Add `staleTime` / `gcTime` defaults.** Per-query overrides via
  enrichments, or global defaults baked into the generator.

## See also

- [gen-zod](gen-zod.md) — the schema generator this composes with
- [gen-tanstack-query-supabase-zod](gen-tanstack-query-supabase-zod.md) —
  same shape, Supabase transport
- [API: GenerateContext — insertNormalizedModel](../api/generate-context.md) —
  how composition works
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
