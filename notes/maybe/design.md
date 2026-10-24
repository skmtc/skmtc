# About the approach: fewer branches through data and framework classes

This page explains how the `Maybe` classes came about, what each idea is for,
and which alternatives were tried and dropped. It is for people deciding
whether the classes belong in `@skmtc/core`, and for anyone extending them. For
signatures, see [`reference.md`](reference.md); for the numbers, see
[`trial.md`](trial.md).

## The value to our code

Idiomatic Skmtc generator code has few branches, because the framework, not
the generator, carries the structure. When generator authors (people or
agents) fall back on habits from other code, they write ternaries and `if`
chains in every producer, and the complexity grows faster than it can be
removed. The classes give those authors a smaller set of moves that are
low-branch by construction:

- **Less code to review.** gen-md-docs lost 17 helper functions that built
  text; ZodInteger and ZodNumber went from 9 to 1. Almost every `toString()` is
  one interpolation.
- **Intent is visible.** `Maybe.when`, `Maybe.nonEmpty` and the plain
  constructor say whether code tests a condition, a non-empty list or a
  missing value. A truthiness check says none of these, and the trial found it
  was dropping real values (`minLength: 0`, `default: false`) on the way.
- **The compiler catches gaps.** Exhaustive switches on `schema.type` turn a
  new schema type into a type error, not a silently missing section.
- **Output does not change.** Each rewrite was checked byte-for-byte against a
  golden file.

## The approach

1. **Measure before designing.** An experimental lint plugin scores the
   cyclomatic complexity of every producer and records what each branch tests.
   That showed the problem is absence and emptiness, not dispatch.
2. **Borrow from functional programming, within Skmtc's model.** fp-ts keeps
   absence (`Option`), conditions (`boolean.match`) and empty values (a
   Monoid's `empty`) apart, and makes "present or absent" a value rather than
   a branch. Skmtc's building blocks are classes that render through
   `toString()`, so the ideas become classes, not functions.
3. **Prototype with tests.** Every example in these notes is a test in
   [`prototype/`](prototype/).
4. **Trial on two generators that differ.** gen-md-docs has most of its
   branches in helper functions; gen-zod has most of its branches in
   producers. Each round was gated on byte-identical output.
5. **Measure again, and keep the measurement honest.** The tool was corrected
   twice during the trial; the numbers in these notes come from the corrected
   tool.

## Concepts

### Instances model the schema; render only interpolates

The generate phase builds objects that describe the schema. The render phase
turns them into code by `toString()` interpolation, top-down, once. A
constructor that goes straight from the schema to output text skips the data
step:

```ts
// Skips the data step: the instance holds text waiting to render.
this.minLength = new Maybe(schema.minLength, v => new Wrap(['min length: ', v]))

// Data first: the instance holds a fact about the schema.
this.minLength = new Maybe(
  schema.minLength,
  value => new Constraint({ keyword: 'minLength', value })
)
// Constraint renders `${LABELS[this.keyword]}: ${this.value}`
```

### Absence, conditions and empty values are different things

| Idea                          | fp-ts             | Skmtc                                                                          |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| A missing value               | `O.fromNullable`  | `new Maybe(value, build?, otherwise?)`: absent only when `undefined` or `null` |
| A condition                   | `boolean.match`   | `Maybe.when(condition, build, otherwise?)`                                     |
| A value that must pass a test | `O.fromPredicate` | `Maybe.fromPredicate(value, predicate, build, otherwise?)`                     |
| A non-empty list              | `NEA.fromArray`   | `Maybe.nonEmpty(items, build?, otherwise?)`                                    |
| Non-empty text                | `S.isEmpty`       | `Maybe.nonEmptyText(text, build?, otherwise?)`                                 |

`''`, `false`, `0` and `[]` are values. `title: ""`, `default: false` and
`minimum: 0` render.

### Presence is structural

Rendering in Skmtc is a one-way read of finished state. Nothing renders a child
to find out whether it is empty. Two rules follow:

- **The parent decides whether a child exists.** It wraps the child's
  construction in a `Maybe` keyed on the source data, so a child never has to
  report that it is empty.
- **A data class whose presence follows from its own fields extends
  `Group`.** It lists its rendered fields once in `parts`; the framework reads
  `parts` to decide emptiness, and parents never look inside.

Instances are always present. Only the framework classes (`Nothing`, `Maybe`,
`Loop`, `Group`) can be empty.

### Branches that remain have one place each

- **Dispatch:** one router per schema type, an exhaustive `switch` with a
  `never` default. Each class reads typed fields from a schema the switch has
  narrowed, so no `'minLength' in schema` guards are needed.
- **Two-way choices:** `otherwise`, the third argument of every `Maybe` form.
- **Real variants** (ZodObject's four shapes): a flat `switch (true)` in the
  constructor, which TypeScript narrows in each case. No nested ternaries.
  ts-pattern stays out of core because of its load time.

## Alternatives that were rejected

| Alternative                                             | Why it was dropped                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A `fragment(value, render)` function                    | Skmtc's building blocks are classes, and every `toString()` reads only its own instance properties. A render callback breaks that |
| Treating `''`, `false` and `[]` as absent               | Broke data that must render (`default: false`, `title: ""`); fp-ts keeps them apart for this reason                               |
| Children exposing a `content` field for parents to read | Couples the parent to the child's internals                                                                                       |
| Extending `Loop` so a data class inherits its emptiness | The subclass inherits `add()` and a public `items` it does not need; the same coupling, hidden in inheritance                     |
| Rendering a child to check whether its output is `''`   | Treats rendering as a query, against Skmtc's one-way render model, and conflates "renders nothing" with a `''` value              |
| A `Match` class in core                                 | A smaller ts-pattern; narrowing does not carry into callbacks in an object of cases, and a flat `switch` already narrows          |

## Costs and limits

- **Every `Group` names its rendered fields twice**, as fields and in `parts`.
  Finding every `Maybe` field automatically would avoid that, at the cost of an
  implicit rule.
- **`Maybe<number, Constraint>.value` is typed `Constraint | number`**,
  because without `build` the value is the subject, and a class cannot type
  that per call. Reading data back takes a narrowing step.
- **`Group` cannot also extend `SnippetBase`**, so a data class that needs
  `context` or `register` cannot use it. In core, `parts` becomes a slot on
  `SnippetBase`.
- **Core's types cause most of the branches left in md-docs**: annotation
  fields that only some `OasSchema` members declare, and a parser that does not
  infer a type from constraint keywords. See [`trial.md`](trial.md).
