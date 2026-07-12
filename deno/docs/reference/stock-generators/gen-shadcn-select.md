# @skmtc/gen-shadcn-select

> Produce a React searchable-select component sourced from a GET
> list-response operation.

An operation generator. Useful when a form field references
another resource (e.g., "office" on a contact form, sourced from
`GET /offices`). Pairs with `gen-shadcn-form`'s
`fields[].references` enrichment.

## What it generates

Per supported operation, a React select component:

```tsx
export const OfficeSelect = ({ value, onChange }) => {
  const { data } = useGetOffices()
  return (
    <Combobox value={value} onChange={onChange}>
      {data.map(office => <ComboboxItem value={office.id}>{office.name}</ComboboxItem>)}
    </Combobox>
  )
}
```

## Source

`skmtc-generators/gen-shadcn-select/src/`

## Key decisions

- **Strict `isSupported` filter.** Only GET operations that return
  a list response. The check imports `isListResponse` from
  `@skmtc/gen-tanstack-query-supabase-zod`:

  ```ts
  import { isListResponse } from '@skmtc/gen-tanstack-query-supabase-zod'
  isSupported: ({ operation }) => operation.method === 'get' && isListResponse(operation)
  ```

  Cross-package utility import — a deliberate clone seam, not a
  refactoring target.
- **`toPreviewModule` and `toMappingModule` hooks.** The entry
  declares two extra hooks beyond `transform` — `toPreviewModule`
  for IDE preview integration, `toMappingModule` for the form
  generator's `references` dispatch to know which select to
  reach for.
- **Combobox-based.** The stock produces a searchable combobox, not a
  plain `<select>`. The shadcn/ui Combobox component is the target.

## What to learn from it

- **Cross-generator helper sharing.** The `isListResponse` utility
  is exported by `gen-tanstack-query-supabase-zod` and imported
  by this generator. Generator packages can ship reusable helpers,
  not just `Entry`s.
- **`toMappingModule` for cross-generator addressing.** A second
  generator (`gen-shadcn-form`) reads the mapping module to
  discover "for this operationId, which select component should I
  embed?" The hook makes the lookup deterministic.
- **GET-list-response as a generator-specific shape.** When your
  generator produces something meaningful only for a narrow operation
  shape, encode that in `isSupported` and let everything else fall
  through.

## Common customizations when cloned

- Swap Combobox for plain `<select>` or a different UI lib's
  equivalent.
- Customize how items are labeled (the stock uses a `name` field
  if present; you may want to construct labels from multiple
  fields).
- Add server-side filtering for very large lists (the stock loads
  everything client-side).
- Change which transport hook is called (the stock pairs with
  Supabase; the fetch variant requires a swap).

## See also

- [gen-shadcn-form](gen-shadcn-form.md) — references this generator
  via `fields[].references` enrichment
- [gen-shadcn-table](gen-shadcn-table.md) — same `isSupported`
  shape, different output
- [gen-tanstack-query-supabase-zod](gen-tanstack-query-supabase-zod.md) —
  exports the `isListResponse` utility this generator uses
- [Enrichments concept](../../concepts/enrichments.md)
