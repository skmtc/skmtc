# gen-eval check documentation

One page per check. Each page states what the check asserts, why it
matters (tied to the generation model in the `skmtc-generator` skill),
how it is measured mechanically, how to read the result, and the known
legitimate exceptions.

| # | Check | Module | Verdict type |
|---|---|---|---|
| 1 | [Expected file and folder structure](structure.md) | `src/checks/structure.ts` | pass/fail |
| 2 | [Generator consists primarily of producers](producer-share.md) | `src/checks/producer-share.ts` | informational |
| 3 | [Producers are constructor + toString only](method-discipline.md) | `src/checks/method-discipline.ts` | graded, acc-aware |
| 4 | [String composition happens inside toString](string-composition.md) | `src/checks/string-composition.ts` | informational |
| 5 | [A top-level Projection exists](top-level-projection.md) | `src/checks/top-level-projection.ts` | pass/fail, acc-aware |
| 6 | [Evidence-based accumulator detection](accumulator.md) | `src/checks/accumulator.ts` | fact (drives 3 + 5) |
| 7 | [Producer size buckets](producer-size.md) | `src/checks/producer-size.ts` | informational |
| 8 | [toString() is pure](tostring-purity.md) | `src/checks/tostring-purity.ts` | pass/fail |
| 9 | [No ad-hoc `{ toString }` object literals](adhoc-tostring.md) | `src/checks/adhoc-tostring.ts` | pass/fail |
| 10 | [as-cast count](as-casts.md) | `src/checks/as-casts.ts` | count, approval required |
| 11 | [Registration channels](registration-channels.md) | `src/checks/registration-channels.ts` | informational |
| 12 | [No import statements in template literals](template-imports.md) | `src/checks/template-imports.ts` | pass/fail |
| 13 | [TODO markers in emitted text](emitted-todos.md) | `src/checks/emitted-todos.ts` | informational |
| 14 | [Runtime discipline (sync Deno, side effects = logs + registers)](runtime-discipline.md) | `src/checks/runtime-discipline.ts` | pass/fail |

Architecture: a single shared AST pass (`src/parse.ts`) produces
`PackageFacts`; every check module is a pure function over those facts,
so adding a check never adds a parse. The accumulator verdict is
computed in the facts (not in the check) because checks 3 and 5 key
their exemptions off it.

There is deliberately **no composite score** — pass/fail checks are
facts, numeric checks are for human interpretation.
