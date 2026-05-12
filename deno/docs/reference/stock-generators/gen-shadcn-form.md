# @skmtc/gen-shadcn-form

> Emit React form components using shadcn/ui form primitives,
> backed by Zod validation and a Tanstack Query mutation hook.

The most architecturally interesting stock generator. Demonstrates
**cross-generator composition** at scale: the emitted form
references Zod schemas (from `gen-zod`), a mutation hook (from
`gen-tanstack-query-*-zod`), and select/table sub-components.

## Source

`skmtc-generators/gen-shadcn-form/src/`

Key files: `ShadcnForm.ts` (the main Projection), `schemaToField.ts`
(per-schema-shape field-component dispatch), `FormFields.ts`,
`FormLabel.ts`, `fields/` (per-input-type renderers).

## What it generates

Per supported operation (POST/PUT/PATCH with object request body):

```tsx
export const CreateUserForm = () => {
  const form = useForm({ resolver: zodResolver(createUserBody) })
  const { mutate } = useCreateUser()

  return (
    <Form {...form}>
      <h2>Create User</h2>
      <FormField name="name" render={...} />
      <FormField name="email" render={...} />
      <Button type="submit">Create</Button>
    </Form>
  )
}
```

## Key decisions

- **`isSupported` filters to mutating methods with object request
  bodies.** POST/PUT/PATCH where `operation.requestBody?.resolve()
  .toSchema()?.resolve().type === 'object'`. Operations with array
  or primitive bodies skip — there's no useful form shape for
  those.
- **Hardcoded peer-generator imports.** `ShadcnForm.ts` imports
  `TanstackQuery` from `@skmtc/gen-tanstack-query-supabase-zod`
  (line 1). This is **deliberate** — the customization seam, not a
  bug. Cloners swap this for `-fetch-zod` or a custom hook
  generator.
- **Per-field dispatch via `schemaToField`.** Each property of the
  request body schema routes through `schemaToField` to a specific
  React component (`StringField`, `BooleanField`,
  `OperationReferenceField`, etc.). New input types are added by
  extending the dispatch.
- **Rich enrichments.** Per-operation `title`, `submitLabel`,
  per-field `fields[].label`, `.placeholder`, `.input` (custom
  renderer), `.references` (operation-reference dispatch for
  searchable dropdowns). Routed by
  `enrichments[generatorId][operation.path][operation.method]`.

## What to learn from it

- **Cross-generator composition.** The form references three
  emitted artifacts the form generator itself doesn't emit: the
  Zod schema (from `gen-zod`), the TS type (from
  `gen-typescript`), and the mutation hook (from one of the
  `tanstack-query-*-zod` generators). All three converge in the
  same output file because they share `(identifier.name,
  exportPath)` cache keys.
- **Schema-shape-driven UI dispatch.** `schemaToField.ts` shows how
  to route OAS schema variants to UI components — a useful
  template for any "render a form from a schema" generator.
- **Enrichments at production complexity.** Most stock generators
  expose simple per-operation titles/labels. `gen-shadcn-form`'s
  enrichment schema includes per-field overrides, custom field
  renderers, and operation-reference dispatch. Worth studying as
  the upper bound of what an enrichment schema realistically
  carries.

## Common customizations when cloned

- **Swap the mutation-hook generator.** Replace the
  `@skmtc/gen-tanstack-query-supabase-zod` import with your own
  client generator.
- **Replace the UI library.** Swap shadcn/ui primitives for your
  team's component library. The `fields/` directory holds
  per-input-type renderers — each one's the seam.
- **Add a new field type.** Extend `schemaToField.ts` to dispatch
  a new schema shape to a new renderer (e.g., a rich-text editor
  for `description` fields).
- **Customize the submit flow.** The stock calls the mutation hook
  directly; you may want optimistic updates, navigation on
  success, toast notifications, etc.

## See also

- [gen-daisyui-form](gen-daisyui-form.md) — close sibling; DaisyUI
  primitives instead of shadcn/ui
- [gen-zod](gen-zod.md) — composes with this generator
- [gen-tanstack-query-supabase-zod](gen-tanstack-query-supabase-zod.md) —
  hardcoded peer in stock
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
- [Enrichments concept](../../concepts/enrichments.md)
