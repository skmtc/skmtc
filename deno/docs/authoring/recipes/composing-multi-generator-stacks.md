# Composing multi-generator stacks

> How a Projection coordinates with multiple peer generators to
> build a full-stack artifact (a form wired to types, validators,
> and a mutation hook). Worked through `@skmtc/gen-shadcn-form`
> and `@skmtc/gen-shadcn-table` as reference examples.

## What you'll learn

The pattern that the SKMTC stock catalogue calls "UI" generators
— the ones that compose tier-1 (types, validators) and tier-2
(query hooks, MSW handlers) output into a rendered React
component. By the end you'll be able to read `ShadcnForm.ts` and
know exactly what each `insert*` call buys you. When you're ready
to write your own, the distilled steps are in
[author a multi-generator stack](../how-to/author-a-multi-generator-stack.md).

Two concrete generators serve as the reference:

- **`@skmtc/gen-shadcn-form`** (the most-coordinated example) —
  pulls in TypeScript types, Zod validators, a TanStack Query
  mutation hook, and a property-by-property field-renderer
  dispatch.
- **`@skmtc/gen-shadcn-table`** (the simpler example) — pulls in
  a column definition Projection and a TanStack Query list hook.

## Prerequisites

- The [projections and snippets](../../concepts/projections-and-snippets.md)
  model.
- The single-peer pattern from
  [compose with another generator](../how-to/compose-with-another-generator.md).

## Stack

- An OAS-side stock generator family. The same patterns apply to
  GraphQL-side generators via `toGqlOperationEntry`.
- Peer dependencies declared in `deno.json` under the generator's
  own package, pinned to compatible versions:

```jsonc
// gen-shadcn-form/deno.json
{
  "imports": {
    "@skmtc/core": "jsr:@skmtc/core@^0.0.51",
    "@skmtc/gen-typescript": "jsr:@skmtc/gen-typescript@^0.0.55",
    "@skmtc/gen-zod": "jsr:@skmtc/gen-zod@^0.0.55",
    "@skmtc/gen-tanstack-query-supabase-zod": "jsr:@skmtc/gen-tanstack-query-supabase-zod@^0.0.55",
    "@skmtc/gen-shadcn-select": "jsr:@skmtc/gen-shadcn-select@^0.0.55"
  }
}
```

The dependency declaration is at the package level. SKMTC itself
has no plugin registry; you import what you need directly.

## The coordination pattern

Every multi-generator Projection's constructor does the same
three things, in this order:

1. **Pull in peer artifacts** via `this.insertNormalizedModel(...)`
   and `this.insertOperation(...)`. Each call returns an
   `Inserted` whose `.toName()` is the peer's identifier name.
2. **Register consumer-side library imports** via
   `this.register({ imports })` — the things the rendered template
   will reference that aren't produced by a peer
   (`react-hook-form`, `@hookform/resolvers/zod`, etc.).
3. **Stash names on `this`** so `toString()` can interpolate them
   into the rendered template.

The pattern relies on the [pull-based Projection
model](../../concepts/how-generators-produce-output.md#projections-are-pull-based):
every `insert*` call instantiates the peer Projection on demand
(or hits the cache if a previous call already did). The
[Driver](../../concepts/files-and-dedup.md#what-drivers-do--in-one-sentence-each)
handles the cache, the cross-file import stitch, and the
integrity check.

## Walkthrough — `ShadcnForm`

The constructor of `gen-shadcn-form`'s `ShadcnForm` class
(`skmtc-generators/gen-shadcn-form/src/ShadcnForm.ts`),
walked step by step. The full source is the canonical reference;
this walkthrough names what each step buys you.

**(a) Find the request body schema.**

```ts
const requestBody = operation.toRequestBody(({ schema }) => schema)
invariant(requestBody, 'Request body is required')
```

If no request body, the form has nothing to render — the
`invariant` makes that fatal at construction time.

**(b) Pull in the TypeScript type for the request body.**

```ts
const tsRequestBody = this.insertNormalizedModel(TsProjection, {
  schema: requestBody,
  fallbackName: `${capitalize(settings.identifier.name)}Body`
})
this.tsRequestBodyName = tsRequestBody.identifier.name
```

If `requestBody` is a `$ref`, this delegates to `insertModel` and
hits the existing `TsProjection` for that ref. If it's inline,
this constructs a one-off `TsProjection` under `<FormName>Body`.
Either way, `tsRequestBody.identifier.name` is the peer's
identifier — stashed on `this` for later interpolation.

**(c) Same dance for the Zod validator.**

```ts
const zodRequestBody = this.insertNormalizedModel(ZodProjection, {
  schema: requestBody,
  fallbackName: `${decapitalize(settings.identifier.name)}Body`
})
this.zodRequestBodyName = zodRequestBody.identifier.name
```

Two facts buried here: (1) `ZodProjection` and `TsProjection`
have different `id`s, so their `Definition`s live at different
`(name, exportPath)` cache keys; (2) typical conventions are
title-cased for the TS type, camel-cased for the Zod validator
— hence the `capitalize` / `decapitalize` divergence.

**(d) Build a synthetic schema for the form's `props`.**

```ts
const formArgsSchema = operation
  .toParametersObject()
  .addProperty({
    name: 'defaultValues',
    schema: new CustomValue({
      context,
      value: `Required<${this.tsRequestBodyName}>`
    }),
    required: false
  })
  .addProperty({
    name: 'onSuccess',
    schema: new CustomValue({
      context,
      value: `() => void`
    }),
    required: false
  })
```

`toParametersObject()` returns an `OasObject` derived from the
operation's path/query parameters. `addProperty` extends it with
two extra fields (`defaultValues`, `onSuccess`) that don't come
from the schema — they're consumer-side conveniences. The
`CustomValue` escape hatch lets us inject TypeScript expressions
(`Required<...>`, a function type) that aren't expressible as OAS
schemas.

**(e) Build the per-field renderer dispatch.**

```ts
this.fields = new FormFields({ context, operation, settings })
```

`FormFields` is a Snippet whose `toString()` interpolates one
field-renderer Snippet per request-body property. The dispatch
mechanism is described in
"[The field-renderer dispatch](#the-field-renderer-dispatch-inside-formfields)"
below.

**(f) Pull in a TS type for the form's props.**

```ts
const typeDefinition = this.insertNormalizedModel(TsProjection, {
  schema: formArgsSchema,
  fallbackName: `${settings.identifier.name}Props`
})
// The form's `props` arg is wrapped in a FunctionParameter Snippet
// using `typeDefinition`. Stored on `this.parameter` for the
// rendered function signature — see source for the constructor call.
```

The form's `props` parameter needs a typed signature
(`(props: <FormName>Props) => ...`). That type is produced by a
second `TsProjection` against the synthetic schema from step (d).

**(g) Pull in the TanStack Query mutation hook.**

```ts
this.clientName = this.insertOperation(TanstackQuery, operation).toName()
```

This is the biggest cross-generator pull. `TanstackQuery` is its
own Projection whose constructor recursively pulls in its own
peers (a fetcher, a Zod parser, etc.) — the coordination cascades.
The form only needs the name; the Driver handles the rest.

**(h) Side-effect: produce a path-params type for sibling consumers.**

```ts
this.insertNormalizedModel(TsProjection, {
  schema: operation.toParametersObject(['path']),
  fallbackName: capitalize(`${settings.identifier.name}PathParams`)
})
```

We don't use the path-params type in the form's own template,
but a sibling generator (`gen-shadcn-table` row click handlers,
for instance) may. Registering it here makes it available without
forcing the sibling to re-derive it. This is "pre-positioning"
peer artifacts.

**(i) Demo-stitch: register an import in `@/demo.tsx`.**

```ts
context.register({
  imports: { [this.settings.exportPath]: [this.settings.identifier.name] },
  destinationPath: join('@', 'demo.tsx')
})
```

A scaffolded demo page imports every generated form. The form
generator registers the import side-effect-style — a useful
side-effect-via-register pattern for "things that need to know
about every generated artifact of this kind."

**(j) Register consumer-side library imports.**

```ts
this.register({
  imports: {
    '@hookform/resolvers/zod': ['zodResolver'],
    'react-hook-form':         ['useForm'],
    '@/components/ui/form':    ['Form'],
    '@/components/ui/button':  ['Button'],
    '@hookform/lenses':        ['useLens'],
    react:                     ['useEffect']
  }
})
```

The six things the rendered template will reference. Imports
travel via `register` because the file map's dedup and
verbatim-syntax-aware rendering live there — inline `import`
lines in template literals bypass both. See
[stringable-composition.md](../../concepts/stringable-composition.md#composition-vs-the-import-channel).

By the time the constructor returns, the file map has:

- A `<FormName>Body` TypeScript type (from `TsProjection`).
- A `<formName>Body` Zod validator (from `ZodProjection`).
- A `<FormName>Props` TypeScript type (from `TsProjection`).
- A `<FormName>PathParams` TypeScript type (from `TsProjection`).
- A `use<Operation>` mutation hook (from `TanstackQuery`).
- Cross-file imports stitched between all of these and the form's
  own file.
- Six consumer-side library imports registered to the form's file.

The form's own `Definition` (the `export const <FormName> = …`)
hasn't been registered yet — that's the Driver's job, *after* the
constructor returns.

### The render layer

`toString()` then interpolates the peer names into a JSX
template:

```ts
override toString(): string {
  const { title, description, submitLabel } = this.settings.enrichments.subject ?? {}
  return `(${this.parameter}) => {
    const form = useForm<Required<${this.tsRequestBodyName}>>({
      resolver: zodResolver(${this.zodRequestBodyName}.required()),
      defaultValues: props.defaultValues
    })
    const mutator = ${this.clientName}()
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit((body, event) => {
          event?.preventDefault()
          mutator.mutate({ ...props, body })
        })}>
          ${this.fields}
          <Button type="submit">${submitLabel || 'Submit'}</Button>
        </form>
      </Form>
    )
  }`
}
```

Three peer-name interpolations (`${this.tsRequestBodyName}`,
`${this.zodRequestBodyName}`, `${this.clientName}`), one Snippet
interpolation (`${this.fields}`), one enrichment-driven label
fallback. The constructor did all the registration work; the
render is pure string composition.

## Walkthrough — `ShadcnTable` (simpler)

`gen-shadcn-table` has a shorter constructor
(`skmtc-generators/gen-shadcn-table/src/ShadcnTable.ts`):

```ts
constructor({ context, operation, settings }: ConstructorArgs) {
  super({ context, operation, settings })

  const { schema, key } = toListKeyAndItem(operation)
  this.listKey = key.join('.')

  // Column definitions — produced by a sibling Projection in the
  // same package, registered with `noExport: true` because it's
  // a local helper, not a public artifact.
  this.columnsName = this.insertOperation(TanstackColumns, operation, { noExport: true }).toName()

  // The list-fetching hook.
  this.clientName = this.insertOperation(TanstackQuery, operation).toName()

  // Path-params destructuring helper Snippet (local to this Projection).
  this.pathParams = new PathParams({
    context, operation,
    settings: { ...settings, identifier: createVariable('pathParams') }
  })

  // Consumer-side library import.
  this.register({
    imports: { '@/components/data-table/data-table.tsx': ['DataTable'] }
  })
}
```

Two pulls (one for columns, one for the hook), one local Snippet,
one library import. Same shape as the form, less coordination
because a table is a simpler artifact.

Notable: the columns Projection uses `{ noExport: true }`. That
suppresses the `export ` prefix on the rendered `Definition` —
the columns array is a file-local helper that the table component
references directly, not part of the file's public API.

## The field-renderer dispatch (inside `FormFields`)

The most interesting structural choice in `gen-shadcn-form` is
the property-by-property field dispatch in
`schemaToField.ts`. This is itself a small visitor:

```ts
export const schemaToField = ({ isRequired, schema, ... }) => {
  if ('members' in schema && schema.members.length === 1) {
    return schemaToField({ schema: schema.members[0], ... })  // unwrap intersection
  }
  if (schema.isRef()) {
    return schemaToField({ schema: schema.resolve(), ... })   // recurse on resolved
  }
  if (schema.type === 'object')  return new ObjectInput({ ... })
  if (schema.type === 'array')   return new Table({ ... })
  if (schema.type === 'number')  return new NumberInput({ ... })
  if (schema.type === 'integer') return new IntegerInput({ ... })
  if (schema.type === 'boolean') return new CheckboxInput({ ... })
  if (schema.type === 'string') {
    if (schema.enums?.length) return new SelectInput({ ..., enums })
  }
  return new StringInput({ ... })
}
```

Each branch returns a registering Snippet (extends `TsSnippet`
from `@skmtc/lang-typescript`) whose
constructor registers its own consumer-side component import
(e.g., `StringInput` registers `import { StringField } from
'@/components/fields/string-field'`) and whose `toString()`
produces the JSX fragment for that field.

`FormFields` is itself a Snippet that, in its constructor, runs
`schemaToField` over every property of the request body and
stores the resulting Snippets in a `List`. `FormFields.toString()`
interpolates the list.

The dispatch is **the customization seam most users hit first**.
Cloning `gen-shadcn-form` to add a date picker, a rich-text
editor, or a file upload is a two-file change: a new Snippet
under `src/fields/`, plus a new branch in `schemaToField.ts`. See
the sibling recipe
[custom-form-field-renderer.md](custom-form-field-renderer.md)
for the full clone-and-customize walkthrough.

## Inter-generator coupling via enrichments

The most subtle coordination pattern in `gen-shadcn-form` happens
via enrichments, not via `insert*`. A user can supply a
`references` enrichment on a form field:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/contacts": {
        "post": {
          "main": {
            "fields": [
              {
                "moduleSelect": { "schemaPath": ["officeIds"] },
                "references": "GetOffices"
              }
            ]
          }
        }
      }
    }
  }
}
```

When the form's field dispatch sees this enrichment, it doesn't
render an array-of-strings input. Instead, it looks up the
operation tagged `GetOffices` on the document and pulls in
`@skmtc/gen-shadcn-select` to render a searchable typeahead
backed by that operation
(`schemaToField.ts`).

This is **inter-generator coupling by enrichment**, not by
import. The form generator doesn't know about specific operations
or specific peer generators by name — it knows about a
"reference" mechanism that lets the user declare "use the select
generator against this operation tag." The select generator is a
separate peer dependency, installed alongside.

The pattern generalizes: an enrichment that names an operation
becomes the routing key for a second, peer-generator-driven
artifact. Useful when the field schema doesn't itself encode the
typeahead source (the OAS doesn't say "the offices ID list comes
from `GetOffices`" — the user supplies that linkage via
enrichment).

## Related

- [Concept: cross-generator coordination](../../concepts/cross-generator-coordination.md)
- [Concept: how generators produce output](../../concepts/how-generators-produce-output.md)
- [Concept: composing output with Stringable](../../concepts/stringable-composition.md)
- [Concept: files, deduplication, and integrity](../../concepts/files-and-dedup.md)
- [Recipe: custom form field renderer](custom-form-field-renderer.md) — clone-and-customize variant
- [How-to: author a multi-generator stack](../how-to/author-a-multi-generator-stack.md) — the distilled steps for writing your own
- [How-to: compose with another generator](../how-to/compose-with-another-generator.md) — the narrower task-level guide
- [How-to: swap a peer dependency](../how-to/swap-a-peer-dependency.md)
