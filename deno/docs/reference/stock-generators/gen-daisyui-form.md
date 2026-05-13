# @skmtc/gen-daisyui-form

> Produce React form components using DaisyUI (Tailwind-based)
> primitives, backed by Zod validation.

An operation generator. The DaisyUI counterpart to
`gen-shadcn-form`. The clearest evidence in the stock library that
swapping a UI framework is a clone-target — entry, filter, and
overall structure are almost identical; only the rendered JSX shape
differs.

## Source

`skmtc-generators/gen-daisyui-form/src/`

## What it generates

Per supported operation, a form using DaisyUI classes:

```tsx
export const CreateUserForm = () => {
  const form = useForm({ resolver: zodResolver(createUserBody) })

  return (
    <form className="form-control" onSubmit={form.handleSubmit(onSubmit)}>
      <label className="label"><span className="label-text">Name</span></label>
      <input className="input input-bordered" {...form.register('name')} />
      ...
      <button className="btn btn-primary" type="submit">Create</button>
    </form>
  )
}
```

## Key decisions

- **Identical entry shape to `gen-shadcn-form`.** Same
  `isSupported` (POST/PUT/PATCH + object body), same `transform`,
  same `toPreviewModule`, same enrichment schema. The variation
  is entirely in `DaisyForm.toString()` — different JSX classes
  and component imports.
- **Tailwind-driven, not headless components.** DaisyUI relies on
  CSS classes (`btn-primary`, `input-bordered`) rather than
  headless component imports. The generated JSX is plain HTML with
  classes, not component instances.

## What to learn from it

- **UI-library swap as a clone target.** Compare side-by-side with
  `gen-shadcn-form` to see exactly what changes when you fork a
  generator for a different design system: the dispatch logic,
  imports, and per-field renderers — almost nothing else.
- **CSS-class output vs component-tree output.** DaisyUI produces
  classnames; shadcn/ui produces component imports. Both are valid
  generation targets; pick based on your team's UI conventions.

## Common customizations when cloned

- Change the Tailwind class set (e.g., for projects using a
  customized DaisyUI theme).
- Replace DaisyUI with another Tailwind-component framework
  (Flowbite, Preline, etc.) — class names change, structure stays.
- Customize per-field-type renderers (the `fields/` subdirectory,
  matching the shadcn-form structure).

## See also

- [gen-shadcn-form](gen-shadcn-form.md) — the closest sibling;
  read side-by-side to see what a UI-library swap touches
- [gen-zod](gen-zod.md) — typical composition partner
- [Enrichments concept](../../concepts/enrichments.md)
