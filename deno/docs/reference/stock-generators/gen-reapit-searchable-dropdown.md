# @skmtc/gen-reapit-searchable-dropdown

> Produce one search-driven multi-select component per qualifying
> GraphQL Query (paged result with `_embedded: [{ id, name }]`
> plus a `name: String` filter argument). Pairs with
> `gen-reapit-form` via the operation-reference protocol as the
> `referenceKind: 'searchable'` producer.

A GraphQL operation generator. Sibling to
`gen-reapit-multi-select` — same predicate plus an extra gate,
designed for option sets large enough that loading all of them
upfront isn't acceptable.

## Source

`skmtc-generators/gen-reapit-searchable-dropdown/src/`

Key files: `ReapitSearchableDropdown.ts` (the main Projection),
`base.ts`, `enrichments.ts`.

## What it generates

Per qualifying Query, a typeahead component that calls the Query
with the user's search input as the `name` argument:

```tsx
export const OfficesLookupField = (props: {
  lens: Lens<string[]>
  label?: string
}) => {
  const [query, setQuery] = useState('')
  const { data } = useGetOffices({ name: query }, { enabled: query.length > 0 })

  return (
    <Combobox.Multi value={props.lens.getValue()} onChange={props.lens.setValue}>
      <Combobox.Input onChange={e => setQuery(e.target.value)} />
      <Combobox.Options>
        {data?._embedded?.map(opt =>
          <Combobox.Option key={opt.id} value={opt.id}>{opt.name}</Combobox.Option>
        )}
      </Combobox.Options>
    </Combobox.Multi>
  )
}
```

Output path: `@/forms/fields/<name>Lookup.generated.tsx`.

## Key decisions

- **Three predicates gate inclusion** (`isSupported`):
  1. `operation.rootKind === 'query'`
  2. Return type is the Reapit paged shape
     (`{ _embedded: [T] }` with `T.id` and `T.name` both scalar
     strings)
  3. The operation accepts a `name: String` argument used for
     filtering

  The third gate is what differentiates this from
  `gen-reapit-multi-select`: a query without a name filter
  cannot be searched against, so it falls outside this
  generator's scope.
- **Designed for dispatch, not standalone.** The form generator
  (`gen-reapit-form`) selects this producer via per-field
  enrichment `referenceKind: 'searchable'`. The generator
  produces a component nobody imports until the form dispatches
  it.
- **Debounced search on input.** The component triggers the
  underlying query only when the user has typed something; this
  is what makes it suitable for thousands-of-options scenarios
  where eager loading would be unworkable.

## What to learn from it

- **Predicate-driven specialization.** The three-clause
  `isSupported` is the cleanest articulation of "what makes this
  generator applicable." Each clause documents an API convention
  the generator depends on. A consumer reading the predicate
  learns the contract immediately.
- **Sibling generators differentiated by predicate scope, not
  by enrichment.** `gen-reapit-multi-select` and this generator
  share the first two predicate clauses. The narrower one
  (this) catches a subset; the broader one (multi-select)
  catches the rest. Both can be installed in the same project —
  each Query lands at most one generator.
- **The "consumer-driven dispatch" pattern.** Some generators
  produce artifacts that are *never imported by anyone except
  via the operation-reference protocol*. They exist on disk;
  they're never used directly. This is the right design when
  the artifact only makes sense in a specific consuming context
  (here, as a form field).

## Common customizations when cloned

- **Change the filter argument name.** Stock looks for
  `name: String`; some APIs use `q`, `search`, or `query`.
  Update the `hasNameStringArgument` predicate plus the
  generated query call.
- **Adjust debounce timing.** Stock has no debounce; production
  use typically wants 150-300ms between keystrokes and the
  fetch.
- **Match a different paged shape.** Same as the multi-select —
  swap the Reapit `_embedded` envelope for Relay edges or your
  API's envelope.
- **Change the Combobox library.** Reapit uses HeadlessUI's
  Combobox primitives; cloners often swap to Radix, downshift,
  or their team's standard.

## See also

- [gen-reapit-form](gen-reapit-form.md) — dispatches this generator
  via the `referenceKind: 'searchable'` enrichment
- [gen-reapit-multi-select](gen-reapit-multi-select.md) — sibling
  producer for option sets small enough to load eagerly
- [gen-reapit-graphql-client](gen-reapit-graphql-client.md) —
  produces the `useGetOffices` hook this field calls
- [gen-shadcn-select](gen-shadcn-select.md) — the OAS-side
  analog: search-driven select dispatched by `gen-shadcn-form`
- [Enrichments concept](../../concepts/enrichments.md) — operation-
  reference protocol
- [The GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md)
