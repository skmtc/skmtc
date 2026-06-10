# @skmtc/gen-reapit-multi-select

> Produce one `<XMultiSelectField>` component per qualifying
> GraphQL Query (paged result with `_embedded: [{ id, name }]`).
> Pairs with `gen-reapit-form` via the operation-reference protocol
> as the `referenceKind: 'multiselect'` producer.

A GraphQL operation generator. One self-contained React component
per qualifying Query — owns its own GraphQL fetch, RHF wiring,
selected-chip rendering, and the unselected-options checkbox list.

## Source

`skmtc-generators/gen-reapit-multi-select/src/`

Key files: `ReapitMultiSelect.ts` (the main Projection),
`base.ts`, `enrichments.ts`.

## What it generates

Per qualifying Query (e.g., `Query.GetOffices`):

```tsx
export const OfficesMultiSelectField = (props: {
  lens: Lens<string[]>
  label?: string
}) => {
  const { data } = useGetOffices({ pageSize: 100 })
  const selected = props.lens.getValue() ?? []

  return (
    <FormField>
      {selected.map(id => <Chip key={id}>{nameById(data, id)}</Chip>)}
      <Checkbox.Group>
        {data?._embedded?.map(opt =>
          <Checkbox key={opt.id} value={opt.id}>{opt.name}</Checkbox>
        )}
      </Checkbox.Group>
    </FormField>
  )
}
```

The field is dispatched by `gen-reapit-form` when a form-field's
enrichment carries `references: '<QueryName>'` and
`referenceKind: 'multiselect'`.

## Key decisions

- **Predicate matches Reapit's paged shape.** `isSupported` checks
  that the operation's return type matches
  `{ _embedded: [{ id: string, name: string, ... }] }`. Other
  pagination shapes won't match this generator — clone if your
  API uses Relay-cursor pagination or a different envelope.
- **Sibling to `gen-reapit-searchable-dropdown`.** Same predicate,
  same dispatch protocol, **different output**. Multi-select renders
  the entire option set as a checkbox list (suitable for ~10-100
  options); searchable-dropdown renders a search input
  (for thousands).
- **`referenceKind: 'multiselect'` selector.** The form generator
  picks this producer when the per-field enrichment names it.
  Free-form string — adding a new producer is enrichment-side,
  not coordinator-side.
- **Self-contained per file.** The output file owns the GraphQL
  query, the RHF lens binding, the chip rendering, and the
  checkbox list. No consumer-side wiring needed beyond passing
  the lens.

## What to learn from it

- **Schema-shape predicates instead of name-based filtering.** The
  generator includes/excludes by *return shape*, not by operation
  name. Cleaner than maintaining an allowlist per project — adds
  the generator to a project and it picks up every qualifying
  Query automatically.
- **Producer/consumer pairing via enrichment, not code.** The
  form generator and this generator have no direct code coupling
  — the linkage exists only through the per-field enrichment
  that names both the source operation (`references`) and the
  producer (`referenceKind`).
- **The "design constraints encoded in `isSupported`" pattern.**
  Reapit's paged shape is a project-specific convention. The
  predicate is the place to encode that convention; downstream
  the generator can assume `_embedded` exists, `id` and `name`
  are strings, etc. Clean separation of "decide whether to run"
  from "what to produce when running."

## Common customizations when cloned

- **Match a different pagination shape.** Replace the predicate
  with one matching Relay edges
  (`{ edges: [{ node: { id, name } }] }`) or a custom envelope.
- **Render differently.** Replace the chips + checkboxes UI with
  a tag-input, a virtualized list, or a multi-column grid.
- **Adjust the page size.** The stock fetches `pageSize: 100`;
  tune for your API's typical option-set size.
- **Add filtering.** The stock loads all options upfront; some
  use cases benefit from a typeahead-style filter even within
  the dropdown (in which case clone
  `gen-reapit-searchable-dropdown` instead — it's the better
  starting point).

## See also

- [gen-reapit-form](gen-reapit-form.md) — dispatches this generator
  via the `referenceKind: 'multiselect'` enrichment
- [gen-reapit-searchable-dropdown](gen-reapit-searchable-dropdown.md) —
  sibling producer for searchable result sets
- [gen-reapit-graphql-client](gen-reapit-graphql-client.md) —
  produces the `useGetOffices` hook this field calls
- [Enrichments concept](../../concepts/enrichments.md) — operation-
  reference protocol via the `references` / `referenceKind`
  enrichment
- [The GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md)
