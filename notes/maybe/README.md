# Fewer branches in Skmtc generators

A small set of framework classes (`Nothing`, `Maybe`, `Loop`, `Wrap` and
`Group`) that lets a generator say "render this if it is there" without writing
the branch itself. In a trial on gen-md-docs and gen-zod, total cyclomatic
complexity fell by 44% and 34%, with output byte-identical to `main`.

Status, 2026-10-24: a type-checked prototype with tests, and a trial on branch
`exp/maybe-classes` in skmtc-generators. Nothing is in `@skmtc/core`, and
nothing lands there until the improvement is clear.

## The problem in one table

Across 179 producers in skmtc-generators, only 4% of the branches inside
producers choose by schema type. The rest decide what to render when a value is
missing or empty:

| Branch kind                                          | Share |
| ---------------------------------------------------- | ----- |
| Text or nothing on a flag (`x ? … : ''`, `x && …`)   | 43%   |
| Fallback for a missing value (`??`, `=== undefined`) | 37%   |
| Empty or length check                                | 13%   |
| Schema-type dispatch                                 | 4%    |

Agents writing generators add branches of these kinds by default, and the
existing `single-dispatch` rule covers only the last row.

## The result in one table

|                                            | `main`   | Trial   |
| ------------------------------------------ | -------- | ------- |
| gen-md-docs total complexity               | 279      | 157     |
| gen-md-docs branches                       | 222      | 101     |
| gen-md-docs highest score                  | 20       | 12      |
| gen-zod total complexity                   | 73       | 48      |
| gen-zod branches                           | 54       | 28      |
| `toString()` bodies scoring above 1 (both) | 28 of 39 | 1 of 58 |

## The rules, in short

1. Instances model the schema as data; `toString()` only interpolates.
2. Only `undefined` and `null` are absent. Conditions, empty lists and empty
   text are explicit choices (`Maybe.when`, `nonEmpty`, `nonEmptyText`).
3. Presence is decided from structure settled during generation, never by
   rendering a child and looking at the output.
4. One router per schema type dispatches; each class reads typed fields.
5. Real variants use a flat `switch`; there are no nested ternaries.

The parts of these rules that hold with today's API (`List`, typed fields,
`switch`) are in the `skmtc-generator` skill, section 5, "Where branches go".
The classes themselves stay out of the skills until they land in core.

## Where to read next

| Page                                   | Type        | Read it to                                                          |
| -------------------------------------- | ----------- | ------------------------------------------------------------------- |
| [`design.md`](design.md)               | Explanation | Understand the approach, the concepts and the rejected alternatives |
| [`reference.md`](reference.md)         | Reference   | Look up a class, a constructor or the `List` mapping                |
| [`trial.md`](trial.md)                 | Report      | See the measurements, round by round, and the open findings         |
| [`retrospective.md`](retrospective.md) | Explanation | See what would come next with more time, and what was learned       |
| [`prototype/`](prototype/)             | Code        | Run the classes and every example (`deno task check`)               |
| [`complexity/`](complexity/)           | Code        | Measure a generators checkout                                       |
