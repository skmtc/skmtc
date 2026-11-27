# Finish

The last step of every change to a generator. Its scope is your diff
(`git diff` against the base), unless you are given files. The output of
the generator does not change in this step, except where a pattern below
was a fault.

## 1. Measure

```
deno run --allow-read --allow-env <this skill>/scripts/complexity.ts <generator>/src
```

The script scores each function and method: 1, plus one for each `if`,
loop, `case`, `catch`, `?:`, `&&`, `||`, `??`, `&&=`, `||=` and `??=`.
It lists what is over the limit and exits 1 when anything is.

`deno lint` holds the same limit with the rule `skmtc/complexity`, when
the generator's `@skmtc/lint-plugin` is 0.1.3 or newer, and shows it at
the function in your editor. Run the script too: it gives the numbers
for your report, it lists the functions outside a class, and it works
with an older plugin.

- **The limit is 10.** A function is a router when more than half of its
  branches are the cases of a `switch`. The cases of a router do not
  count toward the limit. Its other branches do, so a router that also
  holds ten `if`s is over. The script lists a router that passes for
  this reason as `switch (exempt)`.
- A constructor over the limit holds two concepts. Split it by concept
  (`producers.md`, rules 1 and 9), not by line count.
- The script also lists each function outside a class. Each one needs a
  reason that a class cannot give: the router, the config of the entry
  and of the base (`transform`, `isSupported`, `toIdentifierName`,
  `toIdentifierType`, `toExportPath`), an identity function in
  `base.ts`, a type guard on raw input, `toEnrichmentSchema`.

For a change to a generator that exists, run the script on the base
too, and compare. A change that renders one new case adds about one
class, one router case, and no function outside a class.

`--max <n>` or `--max=<n>` sets another limit. Any other `--` argument
stops the script with exit code 2. The script needs `--allow-env` because
the TypeScript parser reads the environment when it loads.

## 2. Read the diff for these patterns

Each pattern, with what replaces it.

| In the diff | Write this |
|---|---|
| A function that takes a schema and returns a schema, or a yes or no about it | Nothing. The parser gives the schema as it is to be rendered. If the reading is wrong for your documents, a `settings.parse` key changes it |
| A function that returns target code and is not `toString()` | A producer, with the code in its `toString()` |
| Target code in a string that a field stores | A producer in that field |
| `items.map(…).join(…)` over producers, outside the `members` and `properties` of a model generator's classes | A `List`, built in the constructor |
| One field that holds every part (`chain`, `parts`, `lines`) | One field for each part, and a template over them |
| A `toString()` that builds parts and joins them | A class for each part |
| The same condition in two places | One class, or one choice in the producer that holds the part |
| `schema.type` tested outside the router | A router case that passes the narrowed schema to its class |
| `x.isRef() ? x.resolve() : x` | `x.resolve()` |
| A name or a path built outside `base.ts` | A function in `base.ts` |
| A peer's name written by hand, or its statics called | An insert, and the name from its result |
| An import written in a template | `this.register({ imports })` |
| A walk over `$ref`s with a set of visited schemas | `toModelRef`, and its `suspended` and `inCycle` |
| A helper file copied from another generator | An export of that generator's package, or the engine. If neither has it, report the gap |
| A second function that corrects the output of the first | The place the first decision belongs ("When a case does not fit" in `SKILL.md`) |
| `x ? … : ''` or `x \|\| undefined` on a value from the document | `x !== undefined && x !== null`. `0`, `false` and `''` render |
| Code for a document that is broken | Nothing, or a router case that throws and names the schema and the setting |
| An `as` cast | The signature, from `deno doc` |
| A `TODO` in generated output | Code that works, or the subject left out with `isSupported` |

When one pattern is in three or more files, say so in your report. It
is a candidate for a rule in `@skmtc/lint-plugin`.

## 3. Check

Run each command and read its exit code, not its output.

1. `deno lint`, with `jsr:@skmtc/lint-plugin` in the generator's
   `deno.json`. The rules `skmtc/no-template-imports`,
   `skmtc/no-adhoc-tostring`, `skmtc/tostring-purity`,
   `skmtc/single-dispatch` and `skmtc/method-discipline` report the
   forms that a script can see. From plugin 0.1.3, `skmtc/complexity`
   reports each function over the limit of section 1. A clean lint does
   not show that the producers are the right ones: that is what
   sections 1 and 2 are for.
2. The generator's tests.
3. A run on a real document. Read the manifest, then one output file,
   import header first.
4. A type-check of the generated output in the target project. For
   TypeScript output, `skmtc generate <project> --typecheck`.

## 4. Break it on purpose

For each producer and each router case you added, break it (return
early, delete the case), run the tests, confirm that one fails, and
restore the file. A test that still passes tests nothing. Report how
many breaks the tests caught.

## 5. Compare the output of a refactor

Before a change that must not alter the output, keep a copy of the
output for a large real document. After the change, format both copies
the same way and compare the two trees with `diff -r`. Without the
format step, a change of layout looks like a change of output.

## 6. Report

- Each command you ran, with its exit code.
- The complexity summary before and after.
- Each function outside a class that you added, with its reason.
- Each function you wrote for a job that "What Skmtc already does"
  gives to Skmtc, and why the existing call did not serve.
- What you could not check.
- Each place where this skill or the docs were wrong or silent.
