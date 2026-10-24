# Fewer branches in generators: Nothing, Maybe, Loop and Wrap

Plan, 2026-10-24, updated after the first trial in gen-md-docs and gen-zod
(see [Trial](#trial-gen-md-docs-and-gen-zod)). Nothing here is in `@skmtc/core` yet. The classes
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
  from structure that was settled during generation. Instances are always
  present; only the framework classes (`Nothing`, `Maybe`, `Loop`, `Group`)
  can be empty.
- Instances represent the underlying data, not generated text. The generate
  phase produces well-structured objects (`StringConstraints { minLength:
  Maybe<number, Constraint> }`, `Constraint { keyword, value }`); the render
  phase turns them into code by `toString()` interpolation, top-down, once. A
  constructor that goes straight from schema to text skips that step.
- Framework classes are held, not extended for behavior. The one base meant
  for extension is `Group`.
- Constructor parameters use named `Args` types, not inline object types.
  Imports inside a package use the `@/` alias, not relative paths.

## The classes

Each class has one job.

| Class     | Job                                                                   |
| --------- | --------------------------------------------------------------------- |
| `Nothing` | Renders `''`.                                                         |
| `Maybe`   | Renders a value or `''`. The only class that decides presence.       |
| `Loop`    | Joins items with a separator and skips absent items.                 |
| `Wrap`    | Joins its parts in order with no separator. Always renders every part. |
| `Group`   | Base for a data class made of optional parts. Renders its `parts`, and is empty when they are. |

`Loop` replaces the list part of `List`. `Wrap` replaces bookends. `Maybe`
replaces `skipEmpty`. A `Loop` has no `skipEmpty` option: wrap it in `Maybe`
to make it disappear when it is empty.

### Absence, conditions and empty values

These are three different things, and fp-ts keeps them apart. So does `Maybe`:

| Idea | fp-ts | Skmtc | Absent when |
| --- | --- | --- | --- |
| A missing value | `O.fromNullable(a)` | `new Maybe(value, build?, otherwise?)` | `undefined` or `null`, nothing else |
| A condition | `boolean.match` | `Maybe.when(condition, build, otherwise?)` | `condition` is `false` |
| A value that must pass a test | `O.fromPredicate` | `Maybe.fromPredicate(value, predicate, build, otherwise?)` | missing, or `predicate` fails; `build` gets the present value |
| An empty list | `NEA.fromArray`, `RA.isNonEmpty` | `Maybe.nonEmpty(items, build, otherwise?)` | the list is missing or has no items |
| Empty text | `S.isEmpty` (`''` is `S.Monoid.empty`) | `Maybe.nonEmptyText(text, build, otherwise?)` | the text is missing or `''` |

`''`, `false`, `0` and `[]` are values. `title: ""`, `default: false` and
`minimum: 0` render through the plain constructor. Skipping an empty list or
empty text is a stated choice, never a side effect of truthiness.
`Maybe.nonEmpty` hands `build` the list typed as non-empty
(`readonly [T, ...T[]]`), so `([first, ...rest]) => …` needs no check.

`Loop` drops absent items only, as `A.compact` drops `None`s: `undefined`,
`null`, `Nothing`, an empty `Loop`, a `Maybe` that is Nothing. A `''` item is a
value and keeps its separator.

When presence is decided:

| What | When it is checked | What it controls |
| --- | --- | --- |
| The subject of a `Maybe` | Construction | Whether `build` or `otherwise` runs |
| `Nothing`, an empty `Loop`, a `Maybe` that is Nothing | Render | Whether the output is `''` |

A `Loop` is never absent at construction, because the object exists. Its
emptiness is only decided at render. That lets a `Loop` that receives items
later (an accumulator) still control the `Maybe` around it.

### Code

From [`prototype/mod.ts`](prototype/mod.ts):

```ts
export type Stringable = {
  toString: () => string
}

export type NonEmpty<T> = readonly [T, ...T[]]

export class Nothing implements Stringable {
  toString(): string {
    return ''
  }
}

const isNonEmpty = <T>(items: readonly T[]): items is NonEmpty<T> => items.length > 0

const isEmpty = (value: unknown): boolean =>
  value instanceof Nothing ||
  (value instanceof Maybe && value.isNothing()) ||
  (value instanceof Loop && value.isEmpty()) ||
  (value instanceof Group && isEmpty(value.parts))

const isPresent = <T>(item: T | undefined | null): item is NonNullable<T> =>
  item !== undefined && item !== null && !isEmpty(item)

export class Maybe<T, U extends Stringable = NonNullable<T>, V extends Stringable = Nothing>
  implements Stringable
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

    if (subject === undefined || subject === null) {
      this.value = undefined
      this.fallback = otherwise?.()
      return
    }

    this.value = build === undefined ? subject : build(subject)
    this.fallback = subject instanceof Loop || subject instanceof Group ? otherwise?.() : undefined
  }

    static when<U extends Stringable, V extends Stringable = Nothing>(
    condition: boolean,
    build: () => U,
    otherwise?: () => V
  ): Maybe<true, U, V> {
    return new Maybe(condition ? true : undefined, build, otherwise)
  }

    static fromPredicate<T extends Stringable, U extends Stringable, V extends Stringable = Nothing>(
    value: T | undefined | null,
    predicate: (present: T) => boolean,
    build: (present: T) => U,
    otherwise?: () => V
  ): Maybe<T, U, V> {
    return value !== undefined && value !== null && predicate(value)
      ? new Maybe(value, build, otherwise)
      : new Maybe<T, U, V>(undefined, undefined, otherwise)
  }

    static nonEmpty<T extends Stringable>(items: readonly T[] | undefined | null): Maybe<NonEmpty<T>>
  static nonEmpty<T, U extends Stringable, V extends Stringable = Nothing>(
    items: readonly T[] | undefined | null,
    build: (present: NonEmpty<T>) => U,
    otherwise?: () => V
  ): Maybe<true, U, V>
  static nonEmpty<T, U extends Stringable, V extends Stringable = Nothing>(
    items: readonly T[] | undefined | null,
    build?: (present: NonEmpty<T>) => U,
    otherwise?: () => V
  ): Maybe<true, U, V> | Maybe<NonEmpty<T>> {
    const present = items !== undefined && items !== null && isNonEmpty(items) ? items : undefined
    if (build === undefined) return new Maybe<NonEmpty<T>>(present)
    return present === undefined
      ? new Maybe<true, U, V>(undefined, undefined, otherwise)
      : new Maybe<true, U, V>(true, () => build(present), otherwise)
  }

    static nonEmptyText(text: string | undefined | null): Maybe<string>
  static nonEmptyText<U extends Stringable, V extends Stringable = Nothing>(
    text: string | undefined | null,
    build: (present: string) => U,
    otherwise?: () => V
  ): Maybe<true, U, V>
  static nonEmptyText<U extends Stringable, V extends Stringable = Nothing>(
    text: string | undefined | null,
    build?: (present: string) => U,
    otherwise?: () => V
  ): Maybe<true, U, V> | Maybe<string> {
    const present = text === undefined || text === null || text === '' ? undefined : text
    if (build === undefined) return new Maybe<string>(present)
    return present === undefined
      ? new Maybe<true, U, V>(undefined, undefined, otherwise)
      : new Maybe<true, U, V>(true, () => build(present), otherwise)
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

export class Group implements Stringable {
  parts: Stringable = new Nothing()

  toString(): string {
    return `${this.parts}`
  }
}
```

Notes on the types:

- `value` is `U | T`, not `U`. Without `build`, the value is the subject
  itself. A constructor cannot set different class generics per call, so `U`
  alone would need an `as` cast.
- `build` receives `T`, with `undefined` and `null` removed. Inside it,
  `title` is a `string`, not `string | undefined`, so no `!` or `as` is needed.
- `when`, `fromPredicate`, `nonEmpty` and `nonEmptyText` are static constructors with their own
  generics. They are separate names rather than overloads, because an
  overloaded implementation would need casts to call `build`.
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
Maybe.when(isRecursive, () => new ZodLazyRef({ … }), () => new ZodPlainRef({ … }))
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
  Maybe.nonEmpty(operation.toParams(['path']), params =>
    new Parameters({ context, title: 'Path parameters', parameters: params })
  )
])
// Name.toString(): `**${this.name}**`
```

So `Loop` never needs to know whether a Snippet renders empty. When a child's
emptiness only appears after its own work, move that work into the parent and
pass the result as the subject. When a child is filled later (an accumulator),
create its `Loop` in the parent, pass it in, and key the `Maybe` on it.

### Data classes: `Group`

The parent can only decide presence when it holds the data that decides it.
For a data class whose presence follows from several of its own fields, the
class extends `Group`. It keeps its data as named fields and lists the ones it
renders in `parts`, once, at the end of its constructor. The framework reads
`parts` to tell whether the instance is empty; parents never do, and nothing
renders to find out.

```ts
type StringConstraintsArgs = {
  schema: OasString
}

export class StringConstraints extends Group {
  minLength: Maybe<number, Constraint>
  maxLength: Maybe<number, Constraint>
  pattern: Maybe<string, Constraint>
  default: Maybe<string, Constraint>

  constructor({ schema }: StringConstraintsArgs) {
    super()
    this.minLength = new Maybe(schema.minLength, value => new Constraint({ keyword: 'minLength', value }))
    this.maxLength = new Maybe(schema.maxLength, value => new Constraint({ keyword: 'maxLength', value }))
    this.pattern = new Maybe(schema.pattern, value => new Constraint({ keyword: 'pattern', value: new Code({ value }) }))
    this.default = new Maybe(schema.default, value => new Constraint({ keyword: 'default', value: new Code({ value }) }))
    this.parts = new Loop([this.minLength, this.maxLength, this.pattern, this.default], { separator: ', ' })
  }
}

// Constraint { keyword, value } renders `${LABELS[this.keyword]}: ${this.value}`
// TypeInfo: new Maybe(constraints, c => new Wrap(['(', c, ')'])) drops out when it is empty
```

Each field is named twice, as a field and in `parts`. That is deliberate: the
alternative, the framework finding every `Maybe` field by itself, is implicit.
In core `Group` becomes a `parts` slot on `SnippetBase`, so a data class can
also use `context` and `register`.

Reading the data back has one wart: `Maybe<number, Constraint>.value` is typed
`Constraint | number`, because without `build` the value is the subject
itself, and a class cannot type that per call. Reading it takes a narrowing
step.

Two ways of deciding presence were tried and rejected:

- **Rendering the child to see whether it is `''`.** Rendering in Skmtc is a
  one-way interpolation of finished state. Using output as a query goes
  against that, and it conflates an instance that renders nothing with a `''`
  value.
- **Extending `Loop` so a data class inherits its emptiness.** It inherits
  `add()` and a public `items` array it should not have, and it is the
  `.content` problem hidden in inheritance.

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
        Maybe.nonEmptyText(title, t =>
          new Wrap(['<h2 className="text-2xl font-semibold">', t, '</h2>'])
        ),
        Maybe.nonEmptyText(description, d =>
          new Wrap(['<p className="text-muted-foreground">', d, '</p>'])
        )
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

### A condition

```ts
Maybe.when(isPaginated, () => pagination) // false: build does not run
```

A condition always goes through `Maybe.when`. Passed to the constructor,
`false` is a value and renders as `false`.

## Trial: gen-md-docs and gen-zod

Branch `exp/maybe-classes` in skmtc-generators (`76afcd9`). Each generator
carries a local copy of the classes in `src/Maybe.ts`, identical to
[`prototype/mod.ts`](prototype/mod.ts). Output is byte-identical to `main`:
md-docs' existing golden passes unchanged, and gen-zod got a new 49-schema
golden before the rewrite. Tests: md-docs 72, zod 155. Lint and `deno check`
are clean.

Scores come from [`complexity/measure.ts`](complexity/) with
`--exclude Maybe.ts`. The tool scores every class that renders (not only
detected producers) and counts `.with`/`.when` only in a ts-pattern `match`
chain, so no `Maybe` form counts as a branch: the decision lives in the
framework class.

| | md-docs `main` | round 1 | round 2 | round 3 | zod `main` | round 1 | round 2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Total | 279 | 170 | 160 | **157** | 73 | 54 | **48** |
| Branches | 222 | 119 | 109 | **101** | 54 | 34 | **28** |
| Highest score | 20 | | 23 | **12** | 13 | | **13** |

Round 1 introduced the four classes and the parent-decides rule. Round 2 moved
to fp-ts absence (`when`, `fromPredicate`, `nonEmpty`, `nonEmptyText`), added
`otherwise`, and used a flat `switch` for ZodObject. Round 3 split md-docs'
constraints into data classes per schema type behind one router
(`toConstraints`), each a `Group`, which took `TypeInfo` from 23 to 10 and
removed 13 of its 20 `'field' in r` checks. zod's highest score is its
`toZodValue` router. Earlier versions of this
note quoted 164 and 47: the tool then skipped plain `Stringable` classes, which
overstated the gain.

- md-docs lost 17 helpers that rendered text (`toConstraints`,
  `toParameterNote`, the security and index helpers) and every use of `List`.
  The module functions left compute data. TypeInfo and Parameter absorbed the
  helpers they called: 53 points became 24, and 27 became 12.
- gen-zod replaced `applyModifiers` / `withNullable` / `withOptional` with one
  `ZodModifiers` class. ZodInteger and ZodNumber went from 9 to 1. Every
  `toString()` is a single interpolation.
- No nested ternaries remain in either generator's source.

Findings:

| Finding | Status |
| --- | --- |
| A Snippet that renders empty still got a separator in a `Loop`; md-docs exposed `.content` fields to work around it | Resolved: [the parent decides presence](#the-parent-decides-presence). No `.content` reads remain |
| No "otherwise": two-way choices stayed ternaries | Resolved: [`otherwise`](#the-two-way-form-otherwise) |
| Real variants (ZodObject's four shapes) | Resolved: [flat `switch`](#variants-a-flat-switch) |
| `''`, `false` and `[]` treated as absent broke data that must render (`default: false`, `title: ""`) | Resolved: [fp-ts absence](#absence-conditions-and-empty-values). Every old truthiness check is now an explicit `when`, `nonEmpty` or `nonEmptyText` |
| `Maybe.when(x !== undefined && x > 0, …)` does not narrow `x` in `build` | Resolved: `Maybe.fromPredicate(x, v => v > 0, build)` |
| The complexity tool skipped plain `Stringable` classes and counted `Maybe.when` as a ts-pattern arm | Resolved in the tool. `method-discipline` covers plain classes on branch `fix/method-discipline-plain-classes` (not merged) |
| `Maybe.nonEmptyText(format, format => format)` needed an identity `build` | Resolved: `build` is optional on `nonEmpty` and `nonEmptyText` (overloads, no casts) |
| `nonEmpty` hands `build` a readonly list, so children had to take `readonly X[]` | Keep. Children should accept readonly input |
| `'minLength' in r ? r.minLength : undefined` for every constraint, because one class rendered every schema type | Resolved: one data class per schema type behind `toConstraints`, an exhaustive `switch` on `schema.type` |
| `default` typed `unknown` needed a ternary and `String()` before `Maybe` would take it | Resolved: `default` is typed per schema class, and the `Maybe` subject may be any type |
| A data class whose presence follows from its own fields | Resolved: [`Group`](#data-classes-group) |
| 7 annotation checks remain in `TypeInfo` (`format`, `nullable`, `deprecated`, `readOnly`, `writeOnly`, `enums`, `default`): core declares them on some `OasSchema` members only (`OasArray` calls its default `defaultValue`) | Open. Core change: the same annotation fields on every member |
| The parser infers a missing `type` from `properties`, `items`, `default` and `example`, not from constraint keywords, so a typeless `{ minLength: 3 }` becomes `OasUnknown` and loses its constraints | Open. Core change, same behavior as `main` |
| `TypeSystemObject` uses `X \| null` fields | Accepted. Other generators read them as a contract; 2 branches in ZodObject |
| `Maybe<T, U>.value` is typed `U \| T`, so reading data back needs narrowing | Open |
| A choice on a value filled after construction (`OperationCount`'s plural) stays a ternary in `toString` | Accepted. It reads state that is final at render |
| ZodRef's two setups (lazy and plain) each have side effects and set several fields | Accepted. `if`/`else` in the constructor; not a rendering choice |
| `Loop.items` is `(T \| undefined \| null)[]` and has only `add` | Open. Sorted insertion splices `items` directly |
| `Maybe.when(flag, () => '"')` as a part of a `Wrap` makes conditional quotes and suffixes cheap | Pattern worth naming in the skill |

## Mapping from `List`

| `List` today                      | With the new classes                                  |
| --------------------------------- | ----------------------------------------------------- |
| `List.toObject(xs)`               | `new Wrap(['{', new Loop(xs), '}'])`                  |
| `List.toArray(xs)`                | `new Wrap(['[', new Loop(xs), ']'])`                  |
| `List.toParams(xs)`               | `new Wrap(['(', new Loop(xs), ')'])`                  |
| `List.toLines(xs)`                | `new Loop(xs, { separator: '\n' })`                   |
| `{ skipEmpty: true }`             | `new Maybe(loop, l => new Wrap([…, l, …]))`           |
| `List.toEmpty()`                  | `new Nothing()`                                       |
| `List.toConditional(x, c)`        | `Maybe.when(c, () => x)`                              |
| `list.values.push(x)`             | `loop.add(x)`                                         |

## Other branch sources in the same style

These are not part of these classes, but they follow the same rules and
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

1. Land `Nothing`, `Maybe`, `Loop`, `Wrap` and `Group` (as a `SnippetBase` slot) in `core/dsl` with these tests.
   They are language-neutral, so Kotlin can use them too. Release through
   `deno task release`.
2. Trial: gen-md-docs and gen-zod, three rounds (see Trial). Nothing lands in
   core until the improvement is clear. Next is the data-first approach across
   both generators, beyond constraints.
3. Rewrite the skill skeleton and add the skill table.
4. Add the `producer-complexity` lint rule and the gen-eval package total.
5. Move the generators over one at a time. Mark the `lang-typescript` `List`
   deprecated, and delete it when nothing imports it.

## Open questions

- Names: `isNothing()` on `Maybe` and `isEmpty()` on `Loop` say different
  things on purpose (absent compared with no items). Check that this reads
  well in generator code.
- Whether `Wrap` should also skip `Nothing` parts, or keep every part as it
  does now.
