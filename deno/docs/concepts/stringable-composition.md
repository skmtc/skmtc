# Composing output with Stringable

> SKMTC builds generated code by composing typed `Stringable` values
> through template-literal interpolation. It is not a templating
> system (no Mustache, Handlebars, EJS) and not raw string
> concatenation. Every DSL primitive — `TsDefinition`, `Identifier`,
> `Snippet`, `CustomValue`, `List`, `Inserted` — implements
> `toString(): string`, and writing `${value}` inside a template
> literal triggers the chain recursively.

If you have built code generators before, the default expectation
is one of two shapes: external template files
(`render('foo.hbs', { name })`) or string concatenation
(`'export const ' + name + ' = '`). SKMTC works differently.
Generators write template literals that interpolate other DSL
values, and the values know how to render themselves. The
composition is type-checked, IDE-refactorable, and recursive.

This page explains how that composition works, what the
participating primitives are, and the patterns that fall out of
the design.

For *who runs and when* (`GenerateContext.toArtifacts` + Projection
instantiation), see
[how-generators-produce-output.md](how-generators-produce-output.md).
This page covers *how the output gets built once a generator is
running*.

## The one-line definition

A `Stringable` is anything with a `toString(): string` method. The
DSL's composition model is: build output by interpolating
`Stringable` values into template literals. Each interpolation
calls `toString()` on the value; the result is spliced into the
surrounding string. Values can themselves be template literals
holding more `Stringable`s, so the composition is recursive and
arbitrarily deep.

## The `Stringable` contract

```ts
// core/dsl/Stringable.ts
export type Stringable = {
  toString: () => string
}
```

That is the whole type. There is no interface ceremony, no
registry, no markers. Any object with a `toString` method
satisfies it — including plain strings (`'abc'.toString() === 'abc'`),
numbers, and JS built-ins. The minimal contract is what makes the
composition uniform: a Snippet, a Projection, a `List` of
Identifiers, and a raw string all behave the same way inside
`${...}`.

## The composition mechanism is template-literal interpolation

Template literals in JavaScript call `.toString()` on every
interpolated value. SKMTC's DSL leans on that:

```ts
// A typical Snippet's toString
override toString(): string {
  return `<${this.componentName} {...form.register('${this.fieldName}')}>
    ${this.children}
  </${this.componentName}>`
}
```

`${this.componentName}` interpolates a string. `${this.fieldName}`
interpolates a string. `${this.children}` interpolates whatever
`children` is — another Snippet, a `List`, an array of Snippets
joined by `\n`. Each value's `toString()` runs at the moment of
interpolation. The result is one composed string.

The chain is recursive. A `Definition.toString()` interpolates
its `value` (which is another `Stringable`); that value's
`toString` may interpolate further Snippets, which interpolate
`Identifier` instances. The chain runs depth-first, leaf strings
at the bottom, fully composed string at the top.

### A concrete trace

`gen-typescript`'s `TsProjection` produces something like
`export type User = { id: string; name: string };`. The trace from
the top-level `File.toString()` call is roughly:

```
TsFile.toString()
└─ joins file.imports → "import { ... } from '...'"
└─ joins file.definitions, each calls TsDefinition.toString()
   TsDefinition.toString()         // lang-typescript/src/TsDefinition.ts
   ├─ toTsKeyword(this.identifier.kind)  → "type"
   ├─ ${this.identifier.name}            → "User"
   └─ ${this.value}                      → Snippet.toString()
                                           └─ uses a ListObject of properties
                                              List.toString()    // lang-typescript/src/List.ts
                                              └─ for each value: value.toString()
                                              (each is "id: string", "name: string", ...)
```

No template engine is involved. No string concatenation operator
either. The whole tree is reduced by JavaScript's own template
literal machinery.

## The participating primitives

Every DSL class implements `Stringable`. Below is the roster a
generator author works with most often, grouped by role.

### Roots and wrappers

| Class | `toString()` output | Source |
|---|---|---|
| `SnippetBase` | (abstract — subclasses override) | `core/dsl/SnippetBase.ts` |
| `Definition` | `export <const|type> <name> = <value>;` | `core/dsl/Definition.ts:232` |
| `CustomValue` | The wrapped string verbatim | `core/dsl/CustomValue.ts:80` |
| `Inserted.toName()` | The peer Projection's identifier name (string return; not a `toString`) | `core/dsl/Inserted.ts` |

`SnippetBase` is the abstract root for **Projections** (named,
file-scope artifacts wrapped in `Definition`) and **Snippets**
(anonymous, embedded fragments). Both implement their own
`toString()` to define how they render. `register()` is not on
`SnippetBase` — it lives on each language package's snippet base
(`TsSnippet` from `@skmtc/lang-typescript`), which both layers are
built on.

`TsDefinition` (from `@skmtc/lang-typescript`) is the file-scope
wrapper that produces `export const ... = ...;` or
`export type ... = ...;`. Its `toString()` maps the identifier's
`kind` to the declaration keyword (`toTsKeyword`) and interpolates
`this.identifier` and `this.value` — further `Stringable`s.

`CustomValue` is the escape hatch for an arbitrary fragment that
doesn't have a structured DSL representation
(`Required<UserBody>`, `keyof typeof Status`, etc.).

### Identifier and entity kinds

| Class | Role |
|---|---|
| `Identifier` | Neutral naming data: a name + opaque per-language `kind`. `toString()` returns the name. |

`Identifier` (`core/dsl/IdentifierBase.ts`) is created via the language
package's factory functions: `createVariable(name)` or
`createType(name)` from `@skmtc/lang-typescript`. The `kind` they
write (`'variable'` / `'type'`) travels with the identifier and is
what `TsDefinition.toString()` maps to `const` vs `type` in the
rendered declaration (`toTsKeyword`). It also controls whether
`register({ imports })` renders `import { X }` or
`import { type X }` under `verbatimModuleSyntax`.

### The `List` builder

| Class | Role |
|---|---|
| `List<V, Sep, Bookends>` | A typed list with separator + bookend style. `toString()` joins values with the separator and wraps with bookends. |
| `KeyList`, `EntryList` | Helpers for transforming string-keyed records into Lists. |

`List` (from `@skmtc/lang-typescript`) is the most-used utility in
the codebase. Stock generators reach for it for any object
literal, parameter list, array, or line-separated block. Five
typed shortcuts cover the common cases:

```ts
List.toObject([...])   // { a, b, c }
List.toArray([...])    // [a, b, c]
List.toParams([...])   // (a, b, c)
List.toLines([...])    // a\nb\nc
List.toKeyValue(k, v)  // k: v
```

Two features that matter beyond syntax:

- **`undefined`-filtering at construction.** `new List([a, undefined, b])`
  silently drops the `undefined`. So conditional inclusion is
  just `List.toObject([alwaysIncluded, maybeIncluded && conditional])`
  without `.filter(Boolean)` boilerplate.
- **`skipEmpty: true`.** A List configured with `skipEmpty`
  renders to the empty string when it has no values, rather than
  rendering empty bookends (`{}` or `()`). This is what lets a
  Snippet conditionally include an options object without an
  outer `if`.

Two record-shaped helpers wrap the common cases:

```ts
List.toRecord({ id: 'string', name: 'string' })
// → "{id: string, name: string}"

List.toFilteredRecord({ id: 'string', name: undefined })
// → "{id: string}"   // name is dropped
```

`List.hasValue(v)` is the canonical "is this worth including"
predicate. It returns `false` for `undefined`, empty arrays, and
empty Lists. Use it instead of falsy checks (`!v`) which treat
`0` and `''` as absent.

### The Snippet roster

Snippets are anonymous classes that extend the language's snippet
base — `TsSnippet` from `@skmtc/lang-typescript`, which carries
`register` — and implement `toString()`. Stock generators ship
many of them — field renderers (`StringInput`, `SelectInput`,
`DatePickerInput`), parameter helpers (`PathParams`,
`ReactRouterPathParams`, `FunctionParameter`, `toPathTemplate`),
and per-format helpers.

A Snippet looks like:

```ts fragment
import { TsSnippet } from '@skmtc/lang-typescript'

export class StringInput extends TsSnippet {
  #fieldName: string

  constructor({ context, destinationPath, fieldName }: Args) {
    super({ context })
    this.#fieldName = fieldName
    this.register({
      destinationPath,
      imports: { '@/components/Input': ['Input'] }
    })
  }

  override toString(): string {
    return `<Input {...form.register('${this.#fieldName}')} />`
  }
}
```

State is captured in the constructor; imports get registered up
front (a side-effect on the file's import map); `toString()`
produces the inline JSX fragment. Parent code splices it via
`${stringInput}` in its own template.

## `toString()` must be pure

`Definition.toString()` is called multiple times — at least once
for the final serialization, plus during preview and integrity
hooks. Snippets composed inside it are interpolated each call.

This means **`toString()` must be referentially transparent**:

- Don't mutate `this` inside `toString()`. Two calls would produce
  different strings, and the integrity check sees the discrepancy.
- Don't read from anything that changes during the run
  (`Date.now()`, mutable module state, etc.).
- Don't trigger side effects (calling `register()` from inside
  `toString()` registers the same thing repeatedly; the dedup
  saves you, but the call is wasted work — and any non-idempotent
  side effect would silently misbehave).

The right pattern is to set state in the constructor and let
`toString()` read it. If you find yourself wanting to compute
something lazily, store the cached result on `this`. The
constructor is where side effects belong; `toString()` is the
projection.

## `exportPath` vs `destinationPath`

Two path strings appear constantly in generator code, and they
mean different things:

- **`exportPath`** is where a Projection's `Definition` *lives* —
  the file the `export const X = ...` is written into. Determined
  by the Projection's static `toExportPath`. Only Projections
  have an `exportPath`; it's a pure function of
  `(operation, enrichments)`.
- **`destinationPath`** is the file *currently being registered
  into*. Determined by the caller. Whatever Snippet, Projection,
  or `register` call is happening "right now" passes
  `destinationPath` to say "the side effect lands here."

Same file: when a Projection is registering its own
`Definition`, `destinationPath` equals `this.settings.exportPath`.
Different file: when a parent file (a form) references a
Projection living elsewhere (a model), `destinationPath` is the
parent's path, and the Driver registers an import linking the
parent to the Projection's `exportPath`.

Snippets have **no** `exportPath` — they are embedded into a
parent, not exported at file scope. They receive
`destinationPath` from the parent as a constructor argument and
register their own imports against it.

## Composition vs the import channel

The composition model handles file *bodies* — declarations and
the snippets inside them. It does **not** handle imports. Imports
travel through a separate channel: `context.register({ imports,
destinationPath })`.

Why the split:

- Imports need **deduplication**. Two snippets in the same file
  that both register `{ zod: ['z'] }` should produce one import
  line. The file's `imports: Map<module, Set<name>>` dedups on
  registration.
- Imports need to **render in the file header**, not inline. A
  template literal that contains `import { z } from 'zod'` lands
  in the file body at whatever position the snippet was spliced.
  The header is built separately from `File.imports`.
- Imports need to know **entity kinds** for `verbatimModuleSyntax`.
  The identifier's `kind` propagates into the import form (the
  Driver's `TsImport.fromIdentifier`, or an explicit
  `{ name, type: 'type' }` tag), so `import { type Foo }` renders
  correctly for type-only identifiers.

So the rule of thumb is: **anything inside the file's body
composes through template literals; anything at the file header
goes through `register({ imports })`.**

This is why a Snippet's constructor typically calls `register`
for its dependencies — registering imports is a side effect that
must run before serialization, and the constructor is where side
effects live.

## A worked composition

A simplified `ShadcnForm` snippet that composes Inputs into a
`form.handleSubmit` block:

```ts
class ShadcnForm extends TsSnippet {
  #fields: SnippetBase[]
  #submitFn: Identifier

  constructor({ context, destinationPath, operation, ... }: Args) {
    super({ context })

    // Field snippets register their own imports
    this.#fields = operation.bodyProperties.map(prop =>
      buildFieldSnippet({ context, destinationPath, prop })
    )

    // Cross-generator coordination: pull the mutation hook's name
    const inserted = context.insertOperation({
      projection: TanstackQuery,
      operation
    })
    this.#submitFn = inserted.settings.identifier

    // Register the form library imports
    this.register({
      destinationPath,
      imports: {
        'react-hook-form': ['useForm'],
        '@/components/ui/button': ['Button'],
        '@/components/ui/form': ['Form'],
      }
    })
  }

  override toString(): string {
    const fields = List.toLines(this.#fields)
    return `
      const form = useForm()
      const { mutate } = ${this.#submitFn}()
      return (
        <Form onSubmit={form.handleSubmit(mutate)}>
          ${fields}
          <Button type="submit">Submit</Button>
        </Form>
      )
    `
  }
}
```

Notice what is doing what:

- **Composition** builds the JSX body. `${fields}` interpolates a
  `ListLines<SnippetBase>` whose `toString()` joins each field's
  rendered JSX with newlines. `${this.#submitFn}` interpolates an
  `Identifier` whose `toString()` returns the mutation hook's
  name.
- **Registration** wires up the imports. The form library imports
  are registered during construction. Each field snippet
  registers its own component imports during *its* construction.
  None of those `import { ... }` lines appear in this template.
- **Coordination** runs through `insertOperation`. The peer's
  `Identifier` is captured via `.settings.identifier` and used
  inside the template. The peer's `Definition` is constructed
  and registered as a side effect of the `insertOperation` call.

## Common patterns

### Conditional inclusion

```ts
List.toObject([
  alwaysIncluded,
  someCondition && conditionalValue,  // false → undefined → filtered
  optional ?? undefined
])
```

The constructor filters `undefined`. Combined with `skipEmpty:
true`, this gives you "render `{a, b, c}` if any present,
otherwise nothing":

```ts
List.toObject([a, b, c], { skipEmpty: true })
```

### Stitching record properties

`List.toRecord` builds an object literal from a record:

```ts
const config = List.toRecord({
  url: `'/users/${userId}'`,
  method: `'POST'`,
  body: bodyExpression
})
// → "{url: '/users/${userId}', method: 'POST', body: <bodyExpression>}"
```

`List.toFilteredRecord` does the same but drops `undefined`
values up front. Useful for generators where every property is
conditional.

### Key-driven generation

`List.fromKeys(record).toLines(key => ...)` is the canonical
"map a record's keys into rendered lines" pattern:

```ts
const validators = List.fromKeys(schema.properties).toLines((key) =>
  `${key}: z.string()`
)
```

Returns a `ListLines<string>` that interpolates as newline-
separated content.

### Composing into a definition

```ts fragment
import { defineAndRegister, createVariable } from '@skmtc/lang-typescript'

defineAndRegister(context, {
  identifier: createVariable('userSchema'),
  value: new CustomValue({
    context,
    value: `z.object(${List.toRecord(propertyValidators)})`
  }),
  destinationPath
})
```

The `CustomValue` wraps a string that interpolates the
`ListObject` of property validators. `TsDefinition.toString()`
interpolates `value`, which calls `CustomValue.toString()`, which
splices the rendered List.

### Composing a Snippet into another Snippet

A parent Snippet just interpolates the child:

```ts
return `<Form>
  ${this.#fields}     // ListLines<SnippetBase>
  ${this.#footer}     // FooterSnippet
</Form>`
```

The parent doesn't call `.toString()` explicitly — the template
literal does that automatically.

## Common questions

### Why not use Mustache / Handlebars / EJS?

Three reasons:

1. **Type safety.** A template literal is checked by the TS
   compiler. `${this.identifier}` only compiles if `identifier`
   is in scope and has a `toString` method (which it does — every
   object does). External templates are opaque to the type
   system.
2. **IDE refactoring.** Renaming `identifier` to `name` updates
   every template-literal interpolation across the codebase.
   External templates would need separate find-and-replace.
3. **No build step.** A `.hbs` file is a separate artifact that
   needs loading, parsing, and caching. Template literals are
   just JavaScript syntax.

### Why doesn't `register` produce strings?

`register` is for *file map* updates — adding a `Definition` to
`File.definitions`, an import to `File.imports`, a re-export.
None of those are strings at registration time; they are
structured entries in maps. Serialization to strings happens at
Render time, when `File.toString()` joins them.

Composition handles the *contents of a Definition's value* — the
right-hand side of `export const X = ...`. That part is a string.
The split keeps file-structure concerns (deduplication,
ordering, import grouping) separate from value-composition
concerns.

### What if I need to interpolate a number?

Numbers have a built-in `toString()`. Interpolate them directly:
`${count}` interpolates `count.toString()`. No conversion needed.

For formatted numbers (locale-aware decimals, etc.), the
codebase has `formatNumber` in `core/helpers/formatNumber.ts`.

### Can I use array `.join()` instead of `List`?

Yes for one-off cases. `[a, b, c].join(', ')` produces
`"a, b, c"`. For anything more complex — bookends, optional
filtering, conditional inclusion, key-driven mapping — `List`
is shorter and harder to get wrong (no missing comma after the
last item if you accidentally use the wrong separator
mid-build).

### What happens if I pass a non-`Stringable` to `${...}`?

JavaScript calls `.toString()` on it. Every JS value has a
`toString` (either from `Object.prototype` or its own
implementation). So the type system never blocks the
interpolation — but you'll get `[object Object]` for plain
objects that haven't overridden `toString`. The result is
visible in the output immediately; this is a noisy failure mode,
not a silent one.

### Is `Stringable` a class or an interface?

Neither in the TypeScript sense — it's a structural type alias.
You don't `implements Stringable`; you just have a `toString`
method. This is duck typing at the type level. The structural
match lets primitives, DSL classes, and any third-party value
participate without ceremony.

## Further reading

- [How generators produce output](how-generators-produce-output.md)
  — `GenerateContext.toArtifacts`, `register`, `insertOperation`,
  `insertModel`; *who runs and when* (this page covers *how output
  composes*)
- [Files, deduplication, and integrity](files-and-dedup.md) —
  what `register({ imports })` and `register({ definitions })`
  actually mutate, and the dedup rules that govern repeated
  writes
- [Projections and Snippets](projections-and-snippets.md) — the
  two specializations of `SnippetBase` and when to use each
- [Cross-generator coordination](cross-generator-coordination.md)
  — how `Inserted.toName()` gives you a peer's identifier name
  for interpolation
- [API: SnippetBase](../reference/api/dsl-snippet-base.md) — the
  abstract root class
- [API: Definition](../reference/api/dsl-definition.md) — the
  file-scope wrapper
- [API: Identifier](../reference/api/dsl-identifier.md) — the
  name + entity-type primitive
- [API: Import](../reference/api/dsl-import.md) — the import
  channel (registered, not composed)
