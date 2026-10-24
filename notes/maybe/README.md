# Fewer branches in generators: Nothing, Maybe, Loop and Wrap

Plan, 2026-10-24, updated after the first trial in gen-md-docs and gen-zod
(see [Trial 1](#trial-1-gen-md-docs-and-gen-zod)). Nothing here is in `@skmtc/core` yet. The four classes
exist as a prototype in [`prototype/`](prototype/), with tests for every
example on this page.

## Goal

Idiomatic Skmtc generator code has few branches. Classes are the building
blocks, and each class renders itself through a `toString()` that only reads
its own instance properties. When generator authors (people or agents) ignore
this, they write `if`s and ternaries, and cyclomatic complexity grows fast and
is hard to reduce later.

Skills and lint rules alone have not stopped this. Agents fall back on the
code structure they already know. This plan does two things:

1. Adds small framework classes that make the low-branch form the easy form.
2. Measures cyclomatic complexity, so that a regression is visible and the
   lint diagnostic can name the class to use instead.

## What we measured

[`complexity/`](complexity/) holds an experimental lint plugin and a report
script. They find producers the same way `skmtc/method-discipline` does and
count decision points per member: `if`, `? :`, loops, `catch`, `case`, `&&`,
`||`, `??` and each ts-pattern `.with()` / `.when()`.

```sh
deno run -A notes/maybe/complexity/measure.ts ../skmtc-generators
```

Results for skmtc-generators at `bd01a83` (179 producers, 18 generators):

| Producer score | Producers |
| -------------- | --------- |
| 1              | 60        |
| 2–5            | 87        |
| 6–10           | 28        |
| 11–20          | 4         |
| > 20           | 0         |

Median 2, 90th percentile 8, maximum 20 (`gen-md-docs` `TypeInfo`).

What the 428 branches inside producers test:

| Branch kind                                       | Share | Example                                          |
| ------------------------------------------------- | ----- | ------------------------------------------------ |
| Text or nothing on a flag (`x ? … : ''`, `x && …`) | 43%   | `${title ? '<h2>…</h2>' : ''}` in `ShadcnTable` |
| Fallback for a missing value (`??`, `=== undefined`) | 37% | `response?.schema ? toTsValue(…) : new TsNever(…)` |
| Empty or length check                             | 13%   | `entries.length`, `isEmpty(properties)`          |
| Schema-type dispatch                              | 4%    | `instanceof OasVoid`, `.isRef()`                 |

So the `single-dispatch` rule covers the smallest group. Most branches decide
**what to render when a value is missing or empty**. In functional terms that
is Option plus an empty value (a Monoid), not pattern matching.

Two more findings:

- `List` (`@skmtc/lang-typescript`) already has the core idea: it drops
  `undefined` items, and `skipEmpty` / `toEmpty()` / `toConditional()` render
  `''`. But `List` does a lot already, and its emptiness does not carry through
  nested parts. So generators write `title || description ? '<div>' : ''` by
  hand.
- The skill skeleton that agents clone has the pattern we want to remove:
  `deno/docs/skills/skmtc-model/skeleton/src/MyLibObject.ts` has
  `if (objectProperties && recordProperties)` and
  `recordProperties?.toString() ?? objectProperties?.toString() ?? …` in its
  `toString()`.

## Fixed principles

- Building blocks are classes. Each `toString()` is a pure read of its own
  instance properties. No render callbacks.
- Instances can change after construction, until render. During render they
  are stable.
- A `build` function given to `Maybe` runs in the constructor, never during
  render. Building Snippets or calling `register` during render breaks
  `tostring-purity`.
- No class renders a child to find out whether it is empty. Emptiness is read
  from state.

## The four classes

Each class has one job.

| Class     | Job                                                                   |
| --------- | --------------------------------------------------------------------- |
| `Nothing` | Renders `''`.                                                         |
| `Maybe`   | Renders a value or `''`. The only class that decides presence.       |
| `Loop`    | Joins items with a separator and skips absent items.                 |
| `Wrap`    | Joins its parts in order with no separator. Always renders every part. |

`Loop` replaces the list part of `List`. `Wrap` replaces bookends. `Maybe`
replaces `skipEmpty`. A `Loop` has no `skipEmpty` option: wrap it in `Maybe`
to make it disappear when it is empty.

### Two kinds of absence

| Kind                  | What counts                                      | When it is checked | What it controls        |
| --------------------- | ------------------------------------------------ | ------------------ | ----------------------- |
| Value absence         | `undefined`, `null`, `''`, `false`, `[]`         | Construction       | Whether `build` or `otherwise` runs |
| Structural emptiness  | `Nothing`, an empty `Loop`, a `Maybe` that is Nothing | Render        | Whether output is `''`  |

`0` is a value. `minimum: 0` renders. An empty array is absent, so
`new Maybe(operation.toParams(['path']), …)` builds nothing when there are no
parameters. A `false` that must render as text is
passed as `'false'`.

A `Loop` is never absent at construction, because the object exists. Its
emptiness is only decided at render. That lets a `Loop` that receives items
later (an accumulator) still control the `Maybe` around it.

### Code

From [`prototype/mod.ts`](prototype/mod.ts):

```ts
export type Stringable = {
  toString: () => string
}

export class Nothing implements Stringable {
  toString(): string {
    return ''
  }
}

const isBlank = (value: unknown): boolean =>
  value === '' || value === false || (Array.isArray(value) && value.length === 0)

const isEmpty = (value: unknown): boolean =>
  value instanceof Nothing ||
  (value instanceof Maybe && value.isNothing()) ||
  (value instanceof Loop && value.isEmpty())

const isPresent = <T>(item: T | undefined | null): item is NonNullable<T> =>
  item !== undefined && item !== null && !isBlank(item) && !isEmpty(item)

const isAbsentValue = (value: unknown): value is undefined | null =>
  value === undefined || value === null || isBlank(value)

export class Maybe<
  T extends Stringable,
  U extends Stringable = NonNullable<T>,
  V extends Stringable = Nothing
> implements Stringable
{
  subject: T | undefined | null
  value: U | NonNullable<T> | undefined
  fallback: V | undefined

  constructor(
    subject: T | undefined | null,
    build?: (present: NonNullable<T>) => U,
    otherwise?: () => V
  ) {
    this.subject = subject

    if (isAbsentValue(subject)) {
      this.value = undefined
      this.fallback = otherwise?.()
      return
    }

    this.value = build === undefined ? subject : build(subject)
    this.fallback = subject instanceof Loop ? otherwise?.() : undefined
  }

    isAbsent(): boolean {
    return this.value === undefined || isEmpty(this.subject) || isEmpty(this.value)
  }

    isNothing(): boolean {
    return this.isAbsent() && (this.fallback === undefined || isEmpty(this.fallback))
  }

  toString(): string {
    return this.isAbsent() ? `${this.fallback ?? ''}` : `${this.value}`
  }
}

export type LoopOptions = {
  separator?: Stringable
}

export class Loop<T extends Stringable = Stringable> implements Stringable {
  items: (T | undefined | null)[]
  separator: Stringable

  constructor(items: (T | undefined | null)[] = [], { separator = ', ' }: LoopOptions = {}) {
    this.items = items
    this.separator = separator
  }

    add(item: T | undefined | null): this {
    this.items.push(item)
    return this
  }

  isEmpty(): boolean {
    return !this.items.some(isPresent)
  }

  toString(): string {
    return this.items.filter(isPresent).join(`${this.separator}`)
  }
}

export class Wrap implements Stringable {
  parts: Stringable[]

  constructor(parts: Stringable[]) {
    this.parts = parts
  }

  toString(): string {
    return this.parts.join('')
  }
}
```

Notes on the types:

- `value` is `U | NonNullable<T>`, not `U`. Without `build`, the value is the
  subject itself. A constructor cannot set different class generics per call,
  so `U` alone would need an `as` cast.
- `build` receives `NonNullable<T>`. Inside it, `title` is a `string`, not
  `string | undefined`, so no `!` or `as` is needed.
- `isEmpty`, `isAbsent` and `isNothing` are methods, not fields, because they
  must read the state at render time.
- `isAbsent()` means the present branch does not render. `isNothing()` means
  nothing renders at all: absent, and no `otherwise` that renders.
- `fallback` is typed `V`, which defaults to `Nothing`.

### `Maybe` argument order

The deciding input comes first and the value comes second. Haskell
(`when cond action`), Scala (`Option.when(cond)(value)`) and Rust
(`cond.then(|| v)`) use the same order. `build` is a function, so the value is
built only for a present subject, the same way Scala takes `value` by name and
Rust has `then` next to the eager `then_some`.

### The two-way form: `otherwise`

Most choices left after the trial were "this when present, that when absent":
enum literals or the base type, `discriminatedUnion` or `union`, a link or
plain text, a list of schemes or `_no authentication_`, `z.lazy(…)` or a plain
ref. `Maybe` takes a third argument for the absent case (fp-ts `fold`,
Haskell `maybe default f m`):

```ts
new Maybe(anchor, a => new Wrap(['[`', type, '`](#', a, ')']), () => new Wrap(['`', type, '`']))
new Maybe(isRecursive, () => new ZodLazyRef({ … }), () => new ZodPlainRef({ … }))
```

`otherwise` is lazy like `build`, so only the branch that is needed is built
and registers anything. With a `Loop` subject both run in the constructor,
because the Loop may still be empty at render:

```ts
const schemes = new Loop<string>([], { separator: ', ' })
const auth = new Maybe(schemes, loop => new Wrap(['Auth: ', loop]), () => '_no authentication_')
// renders '_no authentication_' until a scheme is added
```

### Variants: a flat `switch`

Several optional parts that combine into different outputs are variants, not
absence. ZodObject has four: properties, a record, both, or neither. Nesting
`Maybe` with `otherwise` would be nested ternaries in another form. Use a flat
`switch (true)` in the constructor. TypeScript narrows inside each case:

```ts
switch (true) {
  case objectProperties !== null && recordProperties !== null:
    this.content = new Wrap([objectProperties, '.and(', recordProperties, ')'])
    break
  case objectProperties !== null:
    this.content = objectProperties
    break
  case recordProperties !== null:
    this.content = recordProperties
    break
  default:
    this.content = 'z.object({})'
}
```

No `Match` class in core: it would be a small copy of ts-pattern, and
narrowing does not carry into callbacks in an object of cases. ts-pattern
stays out of core because of its load time. Generator routers may keep it.

A `switch` like this still scores 4, because the alternatives are real. The
aim is not zero branches. It is that every branch left is a real variant,
flat, in one place.

### The parent decides presence

A Snippet is never empty. If it may have nothing to render, the parent does
not build it: it wraps the construction in a `Maybe` keyed on the source
data. The child renders unconditionally and has no `Maybe` of its own and no
`content` field for parents to read.

```ts
new Loop([
  new Maybe(name, present => new Name({ context, name: present })),
  new Maybe(operation.externalDocs, docs => new ExternalDocs({ context, externalDocs: docs })),
  new Maybe(operation.toParams(['path']), params =>
    new Parameters({ context, title: 'Path parameters', parameters: params })
  )
])
// Name.toString(): `**${this.name}**`
```

So `Loop` never needs to know whether a Snippet renders empty. When a child's
emptiness only appears after its own work, move that work into the parent and
pass the result as the subject. When a child is filled later (an accumulator),
create its `Loop` in the parent, pass it in, and key the `Maybe` on it.

## Examples

All of these are tests in
[`prototype/examples.test.ts`](prototype/examples.test.ts).

### ShadcnTable heading

Today `ShadcnTable.toString()` scores 9:

```ts
${title || description ? `<div className="flex flex-col gap-2">` : ''}
  ${title ? `<h2 className="text-2xl font-semibold tracking-tight">${title}</h2>` : ''}
  ${description ? `<p className="text-muted-foreground">${description}</p>` : ''}
${title || description ? `</div>` : ''}
```

With the classes, `toString()` scores 1. Presence is decided in the
constructor, and the `div` disappears when both children are absent:

```ts
class TableHeading implements Stringable {
  heading: Maybe<Loop, Wrap>

  constructor({ title, description }: TableHeadingArgs) {
    const children = new Loop(
      [
        new Maybe(title, t => new Wrap(['<h2 className="text-2xl font-semibold">', t, '</h2>'])),
        new Maybe(description, d => new Wrap(['<p className="text-muted-foreground">', d, '</p>']))
      ],
      { separator: '\n' }
    )

    this.heading = new Maybe(
      children,
      loop => new Wrap(['<div className="flex flex-col gap-2">\n', loop, '\n</div>'])
    )
  }

  toString(): string {
    return `${this.heading}`
  }
}
```

### An object that always renders its braces

Leave out `Maybe`, and an empty `Loop` still renders `{}`:

```ts
new Wrap(['z.object({', new Loop([]), '})']) // 'z.object({})'
```

### ZodInteger constraints

Today the constructor scores 6, with nested `if`s that push into a
`List({ skipEmpty: true })`:

```ts
if (schema.minimum !== undefined) {
  if (schema.exclusiveMinimum) {
    this.constraints.values.push(new ZodConstraint({ context, name: 'gt', value: schema.minimum }))
  } else {
    this.constraints.values.push(new ZodConstraint({ context, name: 'gte', value: schema.minimum }))
  }
}
// … the same for maximum and multipleOf
```

With the classes there is one `Maybe` per keyword. The remaining ternaries
choose a value (`gt` or `gte`), not whether something renders:

```ts
this.constraints = new Loop(
  [
    new Maybe(schema.minimum, value =>
      new ZodConstraint({ name: schema.exclusiveMinimum ? 'gt' : 'gte', value })
    ),
    new Maybe(schema.maximum, value =>
      new ZodConstraint({ name: schema.exclusiveMaximum ? 'lt' : 'lte', value })
    ),
    new Maybe(schema.multipleOf, value => new ZodConstraint({ name: 'multipleOf', value }))
  ],
  { separator: '' }
)
// toString(): `z.number().int()${this.constraints}`
```

### `build` runs only for a present value

Constructors have side effects, such as registering imports. An absent value
must not build the Snippet that would render it, or an unused import ends up
in the output:

```ts
const toRef = (refName: string | undefined, imports: string[]): Maybe<string, Registered> =>
  new Maybe(refName, name => new Registered({ name, imports }))

toRef(undefined, imports) // renders '', imports stays []
```

### A `Loop` filled after construction

```ts
const routes = new Loop<string>([], { separator: ',\n' })
const handlers = new Maybe(routes, loop => new Wrap(['export const handlers = [\n', loop, '\n]']))

routes.add('http.get("/pets", getPets)').add('http.post("/pets", addPet)')
// handlers renders the array. With no routes added, it renders ''.
```

The `Wrap` around a `Loop` subject is built even if the `Loop` stays empty. So
**the value built around a `Loop` subject must not register anything**. In
practice that holds: the Snippets that register are the items, and they only
exist once they are added.

### Boolean subject

```ts
new Maybe(isPaginated, () => pagination) // false: build does not run
```

`new Maybe(true)` with no `build` renders `"true"`. A boolean subject only
makes sense with `build`. TypeScript cannot express this through overloads
here, so it is a lint hint, not a type error.

## Trial 1: gen-md-docs and gen-zod

Branch `exp/maybe-classes` in skmtc-generators. Each generator carries a local
copy of the classes in `src/Maybe.ts`. Output is byte-identical: md-docs'
existing golden passes unchanged, and gen-zod got a new 49-schema golden
before the rewrite. Scores exclude `Maybe.ts`, which moves to core.

| | gen-md-docs before | after | gen-zod before | after |
| --- | --- | --- | --- | --- |
| Total | 279 | 164 | 73 | 47 |
| Branches | 222 | 118 | 54 | 34 |
| Module functions | 32 | 15 | 5 | 2 |
| Mean producer score | 4.8 | 3.4 | 3.9 | 2.4 |

- md-docs lost 17 helpers that rendered text (`toConstraints`,
  `toParameterNote`, the security and index helpers) and every use of `List`.
  The 15 module functions left compute data. TypeInfo and Parameter went up
  (20 → 24, 10 → 16) because they absorbed the helpers they called: 53 points
  became 24, and 27 became 16.
- gen-zod replaced `applyModifiers` / `withNullable` / `withOptional` with one
  `ZodModifiers` class (a `Loop` of `Maybe`s). ZodInteger and ZodNumber went
  from 9 to 2. Every `toString()` is a single interpolation.

Findings, and where they stand:

| Finding | Status |
| --- | --- |
| A Snippet that renders empty still gets a separator in a `Loop`; md-docs exposed `.content` fields to work around it | Resolved: [the parent decides presence](#the-parent-decides-presence). No `.content` reads remain |
| No "otherwise": two-way choices stayed ternaries | Resolved: [`otherwise`](#the-two-way-form-otherwise) (prototype only, not yet on the branch) |
| Real variants (ZodObject's four shapes) | Resolved: [flat `switch`](#variants-a-flat-switch) |
| An empty array did not count as absent | Resolved: `[]` is value absence |
| Old code tested truthiness: ZodString drops `minLength: 0` | Open. Kept byte-identical with `minLength \|\| undefined`. A rewrite can change output wherever old code tested truthiness; the golden catches it |
| `''` and `false` as absent are wrong for data that must render (`default: false`, `title: ""`) | Open. Worked around with a boolean subject and a comment |
| Core types use `null` (`TypeSystemObject`), and fields exist only on some `OasSchema` members (`'field' in r ? r.field : undefined`) | Open. Needs a core change; half of TypeInfo's remaining branches |
| Plain `Stringable` classes are not detected as producers by the complexity tool or `method-discipline` | Open. Producer detection has to include them |
| Narrowing in the constructor does not reach `build` callbacks | Open. Read the field into a local first |
| `Loop.items` is `(T \| undefined \| null)[]` and has only `add` | Open. Sorted insertion splices `items` directly |
| `new Maybe(flag, () => '"')` as a part of a `Wrap` makes conditional quotes and suffixes cheap | Pattern worth naming in the skill |

## Mapping from `List`

| `List` today                      | With the new classes                                  |
| --------------------------------- | ----------------------------------------------------- |
| `List.toObject(xs)`               | `new Wrap(['{', new Loop(xs), '}'])`                  |
| `List.toArray(xs)`                | `new Wrap(['[', new Loop(xs), ']'])`                  |
| `List.toParams(xs)`               | `new Wrap(['(', new Loop(xs), ')'])`                  |
| `List.toLines(xs)`                | `new Loop(xs, { separator: '\n' })`                   |
| `{ skipEmpty: true }`             | `new Maybe(loop, l => new Wrap([…, l, …]))`           |
| `List.toEmpty()`                  | `new Nothing()`                                       |
| `List.toConditional(x, c)`        | `new Maybe(c, () => x)`                               |
| `list.values.push(x)`             | `loop.add(x)`                                         |

## Other branch sources in the same style

These are not part of the four classes, but they follow the same rules and
cover most of the remaining "fallback for a missing value" group:

- **Missing schemas go through the router.** `toTsValue`, `toZodValue` and
  the others accept an absent schema and return the language's Nothing class
  (`TsNever`, `TsVoid`). MockRoute, ExpressRoute, EffectEndpoint and
  MutationFn each repeat `schema ? toTsValue(…) : new TsNever(…)` today. The
  router is the one place that may dispatch.
- **Modifiers become wrapper classes.** `applyModifiers` / `withNullable` /
  `withOptional` are copied into six generators as string functions. Classes
  such as `ZodNullable` and `ZodOptional` each wrap a child Snippet, and the
  router builds the chain once.

## Measuring

1. **Lint rule `skmtc/producer-complexity`**, with branch budgets: `toString`
   ≤ 2, constructor ≤ 5, routers exempt. Today's data supports these numbers
   (median 2, 90th percentile 8).
2. **Diagnostics that name the replacement.** The plugin already tells branch
   kinds apart within one file. So `x ? … : ''` in `toString` points to
   `Maybe`, and `x ?? new TsNever(…)` points to the router. Agents ignore
   "complexity 9" but follow "use `Maybe` here".
3. **A package total in gen-eval**, next to `producer-size`. A per-producer
   rule can be dodged by moving branches into a local helper, which is how
   `applyModifiers` hides its branches today.

## Skills

1. Rewrite `skmtc-model/skeleton` with the classes first. Agents clone it, so
   it is the largest single lever.
2. Add a short table to `skmtc-generator`: "about to write X, use Y".
3. Rewrite two or three stock producers (`TypeInfo`, `ShadcnTable`,
   `ZodInteger`) as examples to clone.

## Steps

1. Land `Nothing`, `Maybe`, `Loop` and `Wrap` in `core/dsl` with these tests.
   They are language-neutral, so Kotlin can use them too. Release through
   `deno task release`.
2. Trial: done for gen-md-docs and gen-zod (see Trial 1). Next, apply
   `otherwise` and the flat `switch` on the branch and measure again.
3. Rewrite the skill skeleton and add the skill table.
4. Add the `producer-complexity` lint rule and the gen-eval package total.
5. Run gen-eval with the old and new skills and compare the complexity of the
   code agents write. This shows whether the change works where earlier skill
   and lint changes did not.
6. Move the generators over one at a time. Mark the `lang-typescript` `List`
   deprecated, and delete it when nothing imports it.

## Open questions

- Whether `''` and `false` should stay value absence, given md-docs data
  that must render them. The alternative is absence = `undefined`, `null` and
  `[]` only, with a boolean subject for the rest.

- Names: `isNothing()` on `Maybe` and `isEmpty()` on `Loop` say different
  things on purpose (absent compared with no items). Check that this reads
  well in generator code.
- Whether `Wrap` should also skip `Nothing` parts, or keep every part as it
  does now.
