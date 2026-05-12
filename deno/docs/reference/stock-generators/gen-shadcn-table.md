# @skmtc/gen-shadcn-table

> Emit a React data-table component sourced from a GET list-response
> operation.

An operation generator. Companion to `gen-shadcn-select` — same
filter (GET + list response), different output (table rather than
select dropdown). Use for inventory-style screens that display
many items.

## Source

`skmtc-generators/gen-shadcn-table/src/`

## What it generates

Per supported operation, a table component:

```tsx
export const UsersTable = () => {
  const { data } = useGetUsers()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(user => (
          <TableRow key={user.id}>
            <TableCell>{user.id}</TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

## Key decisions

- **Same `isSupported` as `gen-shadcn-select`.** Both generators
  share the GET + list-response filter, importing `isListResponse`
  from `@skmtc/gen-tanstack-query-supabase-zod`. This is the
  deliberate shape sharing — two UI outputs sourced from the same
  operation shape.
- **Columns derived from the item schema.** Each property of the
  list-item schema becomes a column. No filtering of which
  properties show up — the stock dumps everything, which is rarely
  what users want for production tables.
- **`toPreviewModule` hook.** Enables IDE preview integration the
  same way `gen-shadcn-form` does.

## What to learn from it

- **Sibling generators sharing `isSupported` logic.** Two
  generators (select, table) gate on identical operation shapes
  but emit different outputs. The pattern works because filtering
  and emission are decoupled — the entry filters, the Projection
  shapes the output.
- **Schema-shape to columns.** Iterating an `OasObject`'s
  properties to produce table columns is the table-version of
  `gen-shadcn-form`'s `schemaToField` dispatch. Same idea, simpler
  product.

## Common customizations when cloned

- **Filter visible columns.** Add enrichments for
  `columns: { include?: string[], exclude?: string[] }` to let
  users hide noisy fields.
- **Custom cell renderers per column.** Date columns format with
  `Intl.DateTimeFormat`, image-URL columns render `<img>`, etc.
- **Add pagination, sorting, filtering.** The stock is a static
  table. Tanstack Table is the canonical library to layer on top
  if you need those features.
- **Swap UI library.** shadcn/ui Table → DaisyUI Table → custom.

## See also

- [gen-shadcn-select](gen-shadcn-select.md) — same filter, sibling
  output
- [gen-tanstack-query-supabase-zod](gen-tanstack-query-supabase-zod.md) —
  exports `isListResponse`
- [gen-shadcn-form](gen-shadcn-form.md) — complementary UI generator
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
