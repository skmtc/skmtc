# Fewer branches in generators: Nothing, Maybe, Loop and Wrap

Plan, 2026-10-24. Nothing here is in `@skmtc/core` yet. The four classes
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
| Value absence         | `undefined`, `null`, `''`, `false`               | Construction       | Whether `build` runs    |
| Structural emptiness  | `Nothing`, an empty `Loop`, a `Maybe` that is Nothing | Render        | Whether output is `''`  |

`0` is a value. `minimum: 0` renders. A `false` that must render as text is
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

const isBlank = (value: unknown): boolean => value === '' || value === false

const isEmpty = (value: unknown): boolean =>
  value instanceof Nothing ||
  (value instanceof Maybe && value.isNothing()) ||
  (value instanceof Loop && value.isEmpty())

const isPresent = <T>(item: T | undefined | null): item is NonNullable<T> =>
  item !== undefined && item !== null && !isBlank(item) && !isEmpty(item)

const toValue = <T extends Stringable, U extends Stringable>(
  subject: T | undefined | null,
  build: ((present: NonNullable<T>) => U) | undefined
): U | NonNullable<T> | undefined => {
  if (subject === undefined || subject === null || isBlank(subject)) return undefined
  return build === undefined ? subject : build(subject)
}

export class Maybe<T extends Stringable, U extends Stringable = NonNullable<T>>
  implements Stringable
{
  subject: T | undefined | null
  value: U | NonNullable<T> | undefined

  constructor(subject: T | undefined | null, build?: (present: NonNullable<T>) => U) {
    this.subject = subject
    this.value = toValue(subject, build)
  }

  isNothing(): boolean {
    return this.value === undefined || isEmpty(this.subject) || isEmpty(this.value)
  }

  toString(): string {
    return this.isNothing() || this.value === undefined ? '' : `${this.value}`
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
- `isEmpty` and `isNothing` are methods, not fields, because they must read
  the state at render time.

### `Maybe` argument order

The deciding input comes first and the value comes second. Haskell
(`when cond action`), Scala (`Option.when(cond)(value)`) and Rust
(`cond.then(|| v)`) use the same order. `build` is a function, so the value is
built only for a present subject, the same way Scala takes `value` by name and
Rust has `then` next to the eager `then_some`.

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
2. Rewrite ShadcnTable and ZodInteger with them. Measure before and after
   with `complexity/measure.ts`.
3. Rewrite the skill skeleton and add the skill table.
4. Add the `producer-complexity` lint rule and the gen-eval package total.
5. Run gen-eval with the old and new skills and compare the complexity of the
   code agents write. This shows whether the change works where earlier skill
   and lint changes did not.
6. Move the generators over one at a time. Mark the `lang-typescript` `List`
   deprecated, and delete it when nothing imports it.

## Open questions

- Names: `isNothing()` on `Maybe` and `isEmpty()` on `Loop` say different
  things on purpose (absent compared with no items). Check that this reads
  well in generator code.
- Whether `Wrap` should also skip `Nothing` parts, or keep every part as it
  does now.
