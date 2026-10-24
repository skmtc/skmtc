# Reference: Nothing, Maybe, Loop, Wrap and Group

The classes in [`prototype/mod.ts`](prototype/mod.ts). Every class implements
`Stringable` (`{ toString: () => string }`). The source is canonical; each
example below is a test in
[`prototype/examples.test.ts`](prototype/examples.test.ts).

## Emptiness

| Value                    | Absent when the `Maybe` is constructed | Empty at render            |
| ------------------------ | -------------------------------------- | -------------------------- |
| `undefined`, `null`      | Yes                                    | Yes                        |
| `''`, `false`, `0`, `[]` | No                                     | No                         |
| `Nothing`                | No                                     | Yes                        |
| `Maybe`                  | No                                     | When `isNothing()`         |
| `Loop`                   | No                                     | When `isEmpty()`           |
| `Group`                  | No                                     | When its `parts` are empty |
| Any other instance       | No                                     | No                         |

`build` and `otherwise` run in the constructor, never during render. For a
`Loop` or `Group` subject both run, because its emptiness is decided at render;
neither may register anything.

## `Nothing`

Renders `''`.

```ts
new Nothing()
```

## `Maybe<T, U, V>`

Renders `value` when the subject is present, the `otherwise` value when it is
absent, and `''` when it is absent with no `otherwise`.

| Constructor                                                | Present when                                    | `build` receives                            |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `new Maybe(subject, build?, otherwise?)`                   | `subject` is not `undefined` or `null`          | the subject, `undefined` and `null` removed |
| `Maybe.when(condition, build, otherwise?)`                 | `condition` is `true`                           | nothing                                     |
| `Maybe.fromPredicate(value, predicate, build, otherwise?)` | `value` is present and `predicate(value)` holds | the value                                   |
| `Maybe.nonEmpty(items, build?, otherwise?)`                | `items` has at least one item                   | the list, typed `readonly [T, ...T[]]`      |
| `Maybe.nonEmptyText(text, build?, otherwise?)`             | `text` is a string other than `''`              | the text                                    |

Without `build`, `nonEmpty` and `nonEmptyText` render the value itself.

| Member        | Description                                                           |
| ------------- | --------------------------------------------------------------------- |
| `subject`     | The subject passed to the constructor                                 |
| `value`       | The built value, typed `U \| NonNullable<T>`; `undefined` when absent |
| `fallback`    | The `otherwise` value, typed `V` (default `Nothing`)                  |
| `isAbsent()`  | The present branch does not render                                    |
| `isNothing()` | Nothing renders: absent, and no fallback that renders                 |

```ts
new Maybe(
  anchor,
  a => new Wrap(['[`', type, '`](#', a, ')']),
  () => new Wrap(['`', type, '`'])
)
Maybe.when(isPaginated, () => pagination)
Maybe.fromPredicate(
  minLength,
  value => value > 0,
  value => new ZodConstraint({ name: 'min', value })
)
Maybe.nonEmpty(
  operation.toParams(['path']),
  params => new Parameters({ context, parameters: params })
)
```

## `Loop<T>`

Joins items with a separator (default `', '`). Absent and empty items are
skipped at render; a `''` item is a value and keeps its separator. No bookends:
use `Wrap`. To make an empty list disappear, use it as a `Maybe` subject.

| Member                             | Description                                                           |
| ---------------------------------- | --------------------------------------------------------------------- |
| `new Loop(items?, { separator? })` | `items`: `(T \| undefined \| null)[]`                                 |
| `add(item)`                        | Adds an item after construction, for accumulators; returns the `Loop` |
| `isEmpty()`                        | No item renders                                                       |

```ts
new Loop([new Maybe(name, n => new Name({ name: n })), new Maybe(description)], { separator: ' ' })
```

## `Wrap`

Joins its parts in order with no separator, and always renders every part.

```ts
new Wrap(['z.object({', new Loop(properties), '})']) // 'z.object({})' when empty
```

## `Group`

Base for a data class made of optional parts. The subclass keeps its data as
named fields, assigns `parts` once at the end of its constructor, and inherits
`toString()`, which renders `parts`. The framework reads `parts` for
emptiness.

| Member  | Description                     |
| ------- | ------------------------------- |
| `parts` | `Stringable`, default `Nothing` |

```ts
type StringConstraintsArgs = {
  schema: OasString
}

class StringConstraints extends Group {
  minLength: Maybe<number, Constraint>
  pattern: Maybe<string, Constraint>

  constructor({ schema }: StringConstraintsArgs) {
    super()
    this.minLength = new Maybe(
      schema.minLength,
      value => new Constraint({ keyword: 'minLength', value })
    )
    this.pattern = new Maybe(
      schema.pattern,
      value => new Constraint({ keyword: 'pattern', value: new Code({ value }) })
    )
    this.parts = new Loop([this.minLength, this.pattern], { separator: ', ' })
  }
}
```

## Mapping from `List`

| `List` (`@skmtc/lang-typescript`) | With these classes                          |
| --------------------------------- | ------------------------------------------- |
| `List.toObject(xs)`               | `new Wrap(['{', new Loop(xs), '}'])`        |
| `List.toArray(xs)`                | `new Wrap(['[', new Loop(xs), ']'])`        |
| `List.toParams(xs)`               | `new Wrap(['(', new Loop(xs), ')'])`        |
| `List.toLines(xs)`                | `new Loop(xs, { separator: '\n' })`         |
| `{ skipEmpty: true }`             | `new Maybe(loop, l => new Wrap([…, l, …]))` |
| `List.toEmpty()`                  | `new Nothing()`                             |
| `List.toConditional(x, c)`        | `Maybe.when(c, () => x)`                    |
| `list.values.push(x)`             | `loop.add(x)`                               |
