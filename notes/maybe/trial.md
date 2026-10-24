# Trial report: gen-md-docs and gen-zod

The `Maybe` classes applied to two stock generators, in three rounds, on
branch `exp/maybe-classes` in skmtc-generators (latest `76afcd9`). This page
records the measurements and every finding with its status. For the reasons
behind the design, see [`design.md`](design.md).

## Setup

- Each generator carries a local copy of the classes in `src/Maybe.ts`,
  identical to [`prototype/mod.ts`](prototype/mod.ts).
- Output is byte-identical to `main`. gen-md-docs' existing golden passes
  unchanged; gen-zod got a new 49-schema golden before its rewrite.
- Tests: md-docs 72, zod 155. Lint, `deno check` and the workspace tests are
  clean. No version is bumped, so nothing publishes.

## How the scores are measured

[`complexity/measure.ts`](complexity/), run with `--exclude Maybe.ts`:

```sh
deno run -A notes/maybe/complexity/measure.ts ../skmtc-generators --exclude Maybe.ts
```

A score is 1 plus the decision points (`if`, `? :`, loops, `catch`, `case`,
`&&`, `||`, `??`, and `.with` / `.when` in a ts-pattern `match` chain) of every
class that renders and every module function. No `Maybe` form counts: its
decision lives in the framework class. Optional chaining (`?.`) is not counted.

Earlier drafts of these notes quoted 164 and 47. The tool then skipped plain
`Stringable` classes and counted `Maybe.when` as a ts-pattern arm, which
overstated the gain.

## Results

|                  | md-docs `main` | Round 1 | Round 2 | Round 3 | zod `main` | Round 1 | Round 2 |
| ---------------- | -------------- | ------- | ------- | ------- | ---------- | ------- | ------- |
| Total            | 279            | 170     | 160     | **157** | 73         | 54      | **48**  |
| Branches         | 222            | 119     | 109     | **101** | 54         | 34      | **28**  |
| Highest score    | 20             |         | 23      | **12**  | 13         |         | **13**  |
| Module functions | 32             | 15      |         | **16**  | 5          | 2       | **2**   |

By branch kind, `main` against the trial:

| Kind                               | md-docs  | zod     |
| ---------------------------------- | -------- | ------- |
| Fallback for a missing value       | 122 → 36 | 8 → 1   |
| Text or nothing on a flag          | 54 → 29  | 28 → 6  |
| Empty or length check              | 19 → 2   | 7 → 7   |
| Dispatch on schema type or variant | 24 → 32  | 11 → 14 |

Dispatch went up by design: routers and flat switches make real variants
explicit where a ternary chain hid them.

## What each round did

1. **Round 1:** the four classes and the parent-decides rule. md-docs lost 17
   helper functions that built text, and every use of `List`; gen-zod replaced
   `applyModifiers` / `withNullable` / `withOptional` with one `ZodModifiers`
   class.
2. **Round 2:** fp-ts absence (`when`, `fromPredicate`, `nonEmpty`,
   `nonEmptyText`), `otherwise`, and a flat `switch` for ZodObject. ZodInteger
   and ZodNumber went from 9 to 1.
3. **Round 3 (md-docs only):** constraints as data classes per schema type
   behind one router, `toConstraints`, each a `Group`. `TypeInfo` went from 23
   to 10, and 13 of its 20 `'field' in r` checks went away. The highest score
   left in md-docs is 12; in zod it is the `toZodValue` router, at 13.

## Findings

| Finding                                                                                                                                                                                                                       | Status                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A Snippet that renders empty still got a separator in a `Loop`; md-docs exposed `.content` fields to work around it                                                                                                           | Resolved: the parent decides presence. No `.content` reads remain                                                                          |
| No "otherwise": two-way choices stayed ternaries                                                                                                                                                                              | Resolved: `otherwise`                                                                                                                      |
| Real variants (ZodObject's four shapes)                                                                                                                                                                                       | Resolved: flat `switch`                                                                                                                    |
| `''`, `false` and `[]` treated as absent broke data that must render (`default: false`, `title: ""`)                                                                                                                          | Resolved: fp-ts absence. Every old truthiness check is now an explicit `when`, `nonEmpty` or `nonEmptyText`                                |
| `Maybe.when(x !== undefined && x > 0, …)` does not narrow `x` in `build`                                                                                                                                                      | Resolved: `Maybe.fromPredicate`                                                                                                            |
| `Maybe.nonEmptyText(format, format => format)` needed an identity `build`                                                                                                                                                     | Resolved: `build` is optional on `nonEmpty` and `nonEmptyText`                                                                             |
| `'minLength' in r ? r.minLength : undefined` for every constraint, because one class rendered every schema type                                                                                                               | Resolved: one data class per schema type behind an exhaustive `switch`                                                                     |
| `default` typed `unknown` needed a ternary and `String()`                                                                                                                                                                     | Resolved: `default` is typed per schema class, and a `Maybe` subject may be any type                                                       |
| A data class whose presence follows from its own fields                                                                                                                                                                       | Resolved: `Group`                                                                                                                          |
| The complexity tool skipped plain `Stringable` classes                                                                                                                                                                        | Resolved in the tool. `skmtc/method-discipline` covers plain classes on branch `fix/method-discipline-plain-classes` in skmtc (not merged) |
| 7 annotation checks remain in `TypeInfo` (`format`, `nullable`, `deprecated`, `readOnly`, `writeOnly`, `enums`, `default`): core declares them on some `OasSchema` members only (`OasArray` calls its default `defaultValue`) | Open. Core change: the same annotation fields on every member                                                                              |
| The parser infers a missing `type` from `properties`, `items`, `default` and `example`, not from constraint keywords, so a typeless `{ minLength: 3 }` becomes `OasUnknown` and loses its constraints                         | Open. Core change; same behavior as `main`                                                                                                 |
| `Maybe<T, U>.value` is typed `U \| T`, so reading data back needs narrowing                                                                                                                                                   | Open                                                                                                                                       |
| `Loop.items` is `(T \| undefined \| null)[]` and has only `add`                                                                                                                                                               | Open. Sorted insertion splices `items` directly                                                                                            |
| `skmtc/single-dispatch` recognizes only routers named `to<X>Value`, so it would flag `toConstraints`                                                                                                                          | Open. md-docs excludes the rule today                                                                                                      |
| `nonEmpty` hands `build` a readonly list                                                                                                                                                                                      | Accepted. Children accept readonly input                                                                                                   |
| `TypeSystemObject` uses `X \| null` fields                                                                                                                                                                                    | Accepted. Other generators read them as a contract; 2 branches in ZodObject                                                                |
| A choice on a value filled after construction (`OperationCount`'s plural)                                                                                                                                                     | Accepted. It reads state that is final at render                                                                                           |
| ZodRef's two setups (lazy and plain) each have side effects and set several fields                                                                                                                                            | Accepted. `if`/`else` in the constructor; not a rendering choice                                                                           |
| `Maybe.when(flag, () => '"')` as a part of a `Wrap` makes conditional quotes and suffixes cheap                                                                                                                               | A pattern worth naming in the skill                                                                                                        |
