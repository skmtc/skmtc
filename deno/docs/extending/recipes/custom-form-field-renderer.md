# Custom form field renderer

> End-to-end example: clone `gen-shadcn-form`, add a date-picker
> field for schemas with `format: 'date'`, see it in the
> generated forms.

## What you'll build

A cloned form generator that produces `<DatePicker />` instead of
`<Input type="date">` whenever a request-body property has
`format: 'date'` or `format: 'date-time'`. The full flow:
clone → Snippet → dispatch → consumer component → regenerate.

## Stack

- React + shadcn/ui (or compatible Tailwind component library)
- `react-day-picker` (or any date-picker component you prefer)
- A SKMTC project with `@skmtc/gen-shadcn-form` cloned

## Setup

```bash
skmtc clone my-project -g @skmtc/gen-shadcn-form
```

Verify with `skmtc list my-project --json` — the form generator
should now be listed with `source: "clone"`.

## Step-by-step

### Clone gen-shadcn-form

Done in setup. The source layout:

```
.skmtc/my-project/gen-shadcn-form/src/
├── ShadcnForm.ts              # main Projection
├── FormFields.ts              # iterates schema properties
├── schemaToField.ts           # dispatch: schema → field renderer
├── fields/
│   ├── BooleanInput.ts
│   ├── StringInput.ts
│   ├── ReferenceField.ts
│   └── ...
└── ...
```

Read `schemaToField.ts` and `fields/` first. You'll add to both.

### Create `DatePickerInput.ts`

Add a new Snippet under `fields/`:

```ts
// .skmtc/my-project/gen-shadcn-form/src/fields/DatePickerInput.ts
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

The Snippet's `register` call adds the `DatePicker` import into
the form file. The `toString()` produces the JSX inline.

### Dispatch in `schemaToField`

Add a branch in `schemaToField.ts` **before** the generic
`string` fallback:

```ts
// schemaToField.ts (excerpt)
import { DatePickerInput } from './fields/DatePickerInput.ts'

export const schemaToField = (args) => {
  const { schema, fieldName, destinationPath, context } = args

  // ... existing cases ...

  // Date and date-time formats → DatePicker
  if (!schema.isRef() && schema.type === 'string'
      && (schema.format === 'date' || schema.format === 'date-time')) {
    return new DatePickerInput({ context, destinationPath, fieldName })
  }

  // String fallback (already exists)
  if (!schema.isRef() && schema.type === 'string') {
    return new StringInput({...})
  }

  // ...
}
```

Order matters — first match wins. Put format-specific cases
above the generic ones.

### Implement the consumer-side `DatePicker` component

The Snippet produces `<DatePicker />`. That component has to exist
in the consumer app:

```tsx
// app/src/components/DatePicker.tsx (consumer side, hand-written)
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

type Props = {
  value?: string
  onChange?: (date: string) => void
}

export const DatePicker = ({ value, onChange }: Props) => {
  const date = value ? new Date(value) : undefined
  return (
    <DayPicker
      mode="single"
      selected={date}
      onSelect={(d) => onChange?.(d?.toISOString() ?? '')}
    />
  )
}
```

The generator doesn't produce this — it's user code that the
generated forms import.

### Test with a representative schema

Find an operation in your spec with a `format: 'date'` request-body
property. If none exist, add one to a test spec:

```yaml
# test-spec.yaml
components:
  schemas:
    Event:
      type: object
      properties:
        title: { type: string }
        startDate: { type: string, format: date }
```

Regenerate:

```bash
skmtc bundle my-project
skmtc generate my-project
```

Open the generated form:

```bash
cat src/generated/forms/CreateEvent.generated.tsx
```

You should see `<DatePicker {...form.register('startDate')} />`
in place of the stock string input, plus the `import { DatePicker
} from '@/components/DatePicker'` line near the top.

## Result

Forms for any operation with a `date` or `date-time` field now
render a date picker. The dispatch is part of the generator
(it'll apply to every applicable field across every operation),
not a per-operation enrichment.

## Variations

- **Per-operation override.** Some operations might want a
  different picker (e.g., a date-range picker for analytics
  queries). Add an enrichment field that names a specific Snippet
  class, and check it in `schemaToField` before falling back to
  format-based dispatch.
- **Format-conditional library.** Use one date-picker for `date`
  and a different one for `date-time`. Two branches in
  `schemaToField`, two Snippets.
- **Field-aware default values.** Inspect the schema's `default`
  field and pass it to the consumer-side component.

## Source

The dispatch pattern is the heart of any field-aware generator.
Same approach works for rich-text editors (custom format), file
upload (format: 'binary'), color pickers (format: 'color'), etc.

## See also

- [How to add a field type](../how-to/add-a-field-type.md) — the
  targeted reference for this kind of task
- [gen-shadcn-form reference](../../reference/stock-generators/gen-shadcn-form.md)
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
