# @skmtc/gen-reapit-form

> Produce React form components for GraphQL Mutations using
> `@reapit/elements` primitives, `react-hook-form` +
> `@hookform/lenses` for state, and a Zod resolver derived from the
> args object via `gen-zod`.

A GraphQL operation generator. One React form per GraphQL Mutation
root field. Architecturally the closest analog on the GraphQL side
to `gen-shadcn-form` — cross-generator composition (Zod resolver,
peer reference dispatch) plus rich per-field enrichments.

## Source

`skmtc-generators/gen-reapit-form/src/`

Key files: `ReapitForm.ts` (the main Projection),
`schemaToField.ts` (per-field-shape dispatch),
`toCoerceBlock.ts` (form-data coercion helper), `fields/`
(per-input-type Snippets).

## What it generates

Per GraphQL Mutation with a non-empty args object:

```tsx
export const CreateContactForm = () => {
  const argsSchema = createContactArgs   // from gen-zod
  type Args = z.infer<typeof argsSchema>

  const form = useForm<Args>({ resolver: zodResolver(argsSchema) })
  const lens = useLens(form)

  return (
    <Form onSubmit={form.handleSubmit(...)}>
      <h2>Create Contact</h2>
      <StringField lens={lens.focus('name')} label="Name" />
      <ReferenceField lens={lens.focus('officeIds')} ... />
      <Button variant="primary" type="submit">Create</Button>
    </Form>
  )
}
```

## Key decisions

- **`isSupported` gates on Mutation + non-empty args.**
  `operation.rootKind === 'mutation'` and
  `synthesizeArgsObject(operation) !== undefined`. Queries are
  handled by the GraphQL client generator; mutations without args
  have nothing to render.
- **TypeScript type derived from Zod, not from `gen-typescript`.**
  The args type is `z.infer<typeof argsSchema>` rather than a
  separate `TsProjection` insertion. Reason: ensuring resolver
  typing matches `useForm`'s generic exactly — `gen-zod` and
  `gen-typescript` could otherwise produce subtly-different
  representations.
- **`@hookform/lenses` for typed nested-field access.** Instead of
  `form.register('a.b.c')` strings, generated fields take a
  `Lens<T>` prop that compiles to the same `register` call but
  carries the path type. Errors caught at compile time.
- **Operation-reference protocol with `referenceKind` selector.**
  Per-field enrichment `references` names the producer operation;
  `referenceKind` picks the producer generator (`'searchable'`
  → `gen-reapit-searchable-dropdown`, `'multiselect'` →
  `gen-reapit-multi-select`). Free-form so new producers can be
  added without coordinating a schema change here.
- **Consumer-supplied field components.** The generated form imports
  `<StringField>`, `<NumberField>`, etc. from `@/forms/fields` —
  components the consumer copies once from this package's
  `template/` directory and owns thereafter. The generator never
  rewrites them.

## What to learn from it

- **Cross-protocol Zod usage.** The form generator inserts a Zod
  projection for the GraphQL args object — demonstrating that
  `gen-zod` works across protocols since args are `OasObject`-shaped
  after `synthesizeArgsObject`.
- **Polymorphic peer dispatch via enrichment.** The
  `referenceKind` selector lets one form-side enrichment route to
  different producer generators per field, without
  `gen-reapit-form` knowing the full producer list at code time.
  Extending the set is enrichment-side, not generator-side.
- **Why TypeScript types route through Zod here.** The contrast
  with `gen-shadcn-form` (which uses `TsProjection` directly) is
  intentional. When the validator and the type must agree exactly
  for a third-party library generic (`useForm<T>`), deriving one
  from the other beats producing them independently.
- **Consumer-owned field components.** Stock-and-clone-friendly
  alternative to the form generator owning every rendered widget.
  Stock-and-clone-friendly because forks of the generator inherit
  the same consumer-side template directory contract.

## Common customizations when cloned

- **Add a new `referenceKind`.** Author a producer generator with
  the operation-reference protocol; cloners add its case in
  `schemaToField.ts`'s dispatch.
- **Replace `@reapit/elements`.** Swap the primitive imports
  (`Form`, `Button`, `Input`) for a different design system.
  Single search-replace across `ReapitForm.ts` and `fields/`.
- **Adjust the coerce block.** `toCoerceBlock.ts` produces
  pre-submit data transformations (string-to-number, etc.) — extend
  to support new GraphQL scalar coercions.
- **Customize the submit flow.** The stock dispatches the mutation
  client hook directly; teams often want optimistic updates,
  toast notifications, or post-success navigation.

## See also

- [gen-reapit-graphql-client](gen-reapit-graphql-client.md) — the
  hook generator that produces the mutation client this form calls
- [gen-reapit-searchable-dropdown](gen-reapit-searchable-dropdown.md)
  / [gen-reapit-multi-select](gen-reapit-multi-select.md) — the
  producer generators dispatched via the `references` /
  `referenceKind` enrichment
- [gen-zod](gen-zod.md) — produces the args validator
- [gen-shadcn-form](gen-shadcn-form.md) — close architectural
  sibling for OAS (this generator's GraphQL counterpart)
- [The GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md)
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
