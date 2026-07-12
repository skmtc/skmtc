# @skmtc/gen-tanstack-query-supabase-zod

> Produce Tanstack Query hooks using Supabase's Postgrest-style client
> as the transport, with Zod validation.

An operation generator. The Supabase-transport variant of
`gen-tanstack-query-fetch-zod`. The entry shape is **identical**;
the variation is in the Projection's `toString()` (Supabase
client calls instead of `fetch`).

## What it generates

Per operation, hooks that call the API through Supabase **Edge
Functions** (`supabase.functions.invoke`), parsing the response with
the shared Zod schema (real output, abridged):

```ts
import {pet} from '@/types/pet.generated.ts'
import {supabase} from '@/lib/supabase'
import {useQuery, keepPreviousData} from '@tanstack/react-query'

export type UseGetApiPetPetIdArgs = {petId: number};

export const useGetApiPetPetId = ({petId}: UseGetApiPetPetIdArgs) => {
  const result = useQuery({
    queryKey: ['pet', petId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`/pet/${petId}`, {
        method: 'GET',
      })

      if (error) {
        throw error
      }

      return pet.parse(data)
    },
    placeholderData: keepPreviousData
  })

  return result
};
```

The `supabase` client comes from the consumer-owned `@/lib/supabase`
module; the transport is `functions.invoke` against the operation's
path, not PostgREST table queries.

## Source

`skmtc-generators/gen-tanstack-query-supabase-zod/src/`

## Key decisions

- **Same entry shape as the fetch variant.** Same `isSupported`
  (GET/DELETE always, POST/PUT/PATCH only with body) and same
  transform. The only difference is which Projection is invoked —
  this generator's `TanstackQuery` produces Supabase calls, the
  fetch generator's produces `fetch(...)`.
- **Exports utility helpers** (`isListResponse`, etc.) that other
  generators import directly. `gen-shadcn-select` and
  `gen-shadcn-table` both `import { isListResponse } from
  '@skmtc/gen-tanstack-query-supabase-zod'` to share the
  list-vs-single response-shape detection logic.
- **Hardcoded `supabase` client name.** The generator assumes a
  `supabase` symbol exists in scope. Customization happens by
  importing your own client.

## What to learn from it

- **One entry, multiple transports.** This generator's existence
  shows that the entry is transport-agnostic — pick a different
  client library and you have a new generator with the same shape.
- **Generator packages as utility libraries.** Other generators
  import from this one (`isListResponse`). A generator package
  isn't just an `Entry` — it can expose reusable helpers other
  generators consume.

## Common customizations when cloned

- Swap Supabase for another Postgrest-based client.
- Customize the table-name derivation (the stock uses
  `operationId` or path; you may want a tag-based mapping).
- Add Row-Level-Security parameter passing if your tables expect
  user IDs in the query.
- Change the response-validation step (skip Zod, use a different
  parser, etc.).

## See also

- [gen-tanstack-query-fetch-zod](gen-tanstack-query-fetch-zod.md) —
  the fetch-transport sibling; read alongside
- [gen-shadcn-select](gen-shadcn-select.md) and
  [gen-shadcn-table](gen-shadcn-table.md) — import `isListResponse`
  from this generator
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
