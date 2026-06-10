# How to add a field type

> Add a new field renderer to a cloned form generator (e.g.,
> `gen-shadcn-form`, `gen-daisyui-form`).

## When to use this

A form generator's stock dispatch doesn't cover a schema shape
you need to render. Common cases: a custom `format` value
mapping to a specific React component (date picker, rich text,
file upload, etc.).

## Prerequisites

- The form generator cloned ([tutorial: cloning](../tutorials/01-cloning-a-generator.md)).
- A consumer-side React component for the field type (existing
  or about to be written).

## Steps

### Create the Snippet class in `src/fields/`

Form generators have a `src/fields/` subdirectory with one
Snippet per field type:

```ts
// src/fields/DatePickerInput.ts
import { SnippetBase } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'

type Args = {
  context: GenerateContextType
  destinationPath: string
  fieldName: string
}

export class DatePickerInput extends SnippetBase {
  #fieldName: string

  constructor(args: Args) {
    super({ context: args.context })
    this.#fieldName = args.fieldName

    this.register({
      destinationPath: args.destinationPath,
      imports: { '@/components/DatePicker': ['DatePicker'] }
    })
  }

  override toString(): string {
    return `<DatePicker {...form.register('${this.#fieldName}')} />`
  }
}
```

The Snippet's `toString()` produces just the JSX for one field.

### Register the field's import

The Snippet's constructor (or a `register` call from its parent)
needs to register the import for the consumer-side component:

```ts
constructor(...) {
  super(args)
  this.register({
    destinationPath: args.destinationPath,
    imports: { '@/components/DatePicker': ['DatePicker'] }
  })
}
```

Imports go to the file's `destinationPath`. See
[the Import reference](../../reference/api/dsl-import.md).

### Add a dispatch branch in `schemaToField`

`src/schemaToField.ts` is where the form generator decides which
field renderer to use per schema property:

```ts
// schemaToField.ts (simplified)
import { DatePickerInput } from './fields/DatePickerInput.ts'

export const schemaToField = (args) => {
  const { schema, fieldName, format } = args

  switch (true) {
    case format === 'date': return new DatePickerInput(...)
    case schema.type === 'string' && format === 'email': return new EmailInput(...)
    case schema.type === 'string': return new StringInput(...)
    case schema.type === 'boolean': return new BooleanInput(...)
    // ... your new branch
  }
}
```

Add a `case` for your new field type **before** the more-general
fallbacks. Order matters — first match wins.

### Implement the consumer-side field component

The Snippet produces a JSX reference; the actual `<DatePicker />`
component needs to exist on the consumer side. Either add it to
your component library, or import an existing one (e.g.,
`react-day-picker`).

The generator doesn't produce this component — it's user code.

### Rebundle and regenerate

```bash
skmtc bundle my-project
skmtc generate my-project
```

## Verification

Generate against a schema with a `format: 'date'` field. Inspect
the generated form file — the new field renderer should appear
in place of the stock string input:

```tsx
// src/generated/forms/CreateEvent.generated.tsx
<DatePicker {...form.register('startDate')} />
```

In your app, the form should now render the date picker
component.

## Troubleshooting

- **Stock renderer still used** — Your case statement is
  unreachable. Either a more-general case matches first, or your
  match condition is wrong. Re-check the order in
  `schemaToField`.
- **Component import missing in output** — The `register({
  imports })` call didn't run. Confirm the Snippet's constructor
  actually fires (it does if `schemaToField` reaches the `new
  DatePickerInput(...)` branch).
- **Generated form fails to compile** — Consumer-side
  `DatePicker` component doesn't exist or has a different prop
  shape. Either build it or adjust the Snippet's output.

## Related

- [Recipe: Custom form field renderer](../recipes/custom-form-field-renderer.md) —
  end-to-end example with concrete code
- [gen-shadcn-form reference](../../reference/stock-generators/gen-shadcn-form.md) —
  the source layout this how-to operates against
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
