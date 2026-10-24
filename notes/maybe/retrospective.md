# About the work: what comes next, and what was learned

This page looks back on the `Maybe` work in October 2026: what would improve it
with more time, and which concepts would have saved the most effort had they
been clear from the start. For the design itself, see
[`design.md`](design.md); for the numbers, see [`trial.md`](trial.md).

## What would improve it with more time

In order of value:

1. **Data first across both generators, not only constraints.** Round 3
   applied the data-first shape to md-docs' constraints. Large parts of
   md-docs (modifiers, parameters, security) and some of zod still build text
   in constructors. That is the largest remaining source of branches the
   classes can remove.
2. **`parts` as a slot on `SnippetBase`, prototyped on a core branch.**
   `Group` cannot extend `SnippetBase`, so a data class that needs `context`,
   `register` or attribution cannot use it. A core branch would show the real
   shape and its effect on attribution, without merging anything.
3. **Fix the `Maybe.value` typing.** `Maybe<number, Constraint>.value` is
   `Constraint | number`. Data-first code reads values back, so the type needs
   to say what was built, for example by keeping identity `Maybe` and built
   `Maybe` as separate types.
4. **A third generator family.** The trial covers a model generator (zod) and
   a documentation generator (md-docs). An operation generator (msw or a
   tanstack-query generator) would test the classes on accumulators and on
   peer consumption.
5. **Lint rules that name the replacement.** A `producer-complexity` rule with
   per-member budgets, whose diagnostics name the class to use (`x ? … : ''`
   points to `Maybe`). Also merge the `method-discipline` fix, and teach
   `single-dispatch` to recognize routers such as `toConstraints`.
6. **The skill skeleton.** `skmtc-model/skeleton` still has the branchy
   `toString()` agents copy. Rewriting it belongs with landing the classes, so
   the skeleton never teaches an API that does not exist.
7. **The two core gaps.** The same annotation fields on every `OasSchema`
   member, and the parser inferring a type from constraint keywords. Together
   they remove most of md-docs' remaining field checks.
8. **Measurement in CI.** Count optional chaining, report totals per package
   and per branch kind, and track them over time, so a regression shows up in
   review rather than in a later audit.

## Concepts that would have helped from the start

These are the ideas that, once stated, changed the design. Each one would have
saved at least one round of rework.

1. **Rendering in Skmtc is a one-way interpolation of finished state.**
   `toString()` reads its own fields and interpolates its children; nothing
   asks a child what it rendered. A proposal to drop instances whose output is
   `''`, and the helper method written for it, went against this and were
   withdrawn.
2. **Instances model the data; render produces the code.** The generate phase
   builds objects that describe the schema. Early sketches went straight from
   the schema to text in constructors (`new Wrap(['min length: ', v])`), which
   skips the step that makes the output structured, reusable and inspectable.
3. **The building blocks are classes, not functions.** A first proposal used
   a render callback (`fragment(value, render)`). Skmtc's model is classes
   whose `toString()` reads only their own properties.
4. **Absence, conditions and empty values are different things.** The first
   prototype treated `''`, `false` and `[]` as absent, and broke
   `default: false` and `title: ""`. fp-ts keeps them apart, and the classes
   now do too.
5. **Presence is decided by whoever holds the data.** Children exposing a
   `content` field, and a `Loop` subclass inheriting emptiness, were both ways
   of letting a parent look inside a child. The parent deciding, and `Group`
   for data classes, avoid that.
6. **Framework classes are held, not extended.** Extending `Loop` gave a data
   class methods and state it does not need.
7. **A measurement is only as good as its blind spots.** The first numbers
   overstated the gain, because the tool skipped plain classes and counted
   `Maybe.when` as a branch. Check the tool before quoting what it reports.
8. **A question about a choice is not a request to change it.** Explaining the
   reasoning, then letting the owner decide, avoids rewrites that later have to
   be undone. The same goes for scope: core changes wait for clear evidence,
   and work that was not asked for (an agent A/B run) stays out.
