# Retro: #462 one Subject shape and one runner (file plan 4 of 6)

Run `2026-11-27-rhxpnl` of `implement-ticket-dg`, PR https://github.com/skmtc/skmtc/pull/465.

## 1. Summary

The ticket asked for `Subject.ts`: one subject shape for the four kinds and one loop, `#runSubjects`, in place of the four run loops. It changes no behavior, and the ticket's docs table follows the new names.
The patch applied unchanged. The review found 5 should-fix and 2 nits, and the address step fixed all of them in one round.
#461 merged first, so the check step merged main and bumped again (core 0.54.1). The PR merged as cfc1557c, CI and Publish are green, and follow_on confirmed the change on JSR: identical artifacts before and after on the GitHub document, in three filter scenarios.
The run took 58m 49s: 18,615 input, 26.1M cached and 134,010 output tokens, an estimated $12.70.
The costliest step was review ($5.19, 12m). It was worth it: it found a type hole in the patch and two pre-existing false doc passages that the author's self-review and every check passed.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's docs table said the edits "only follow the names", but two of the edited paragraphs were false about the code: `generate-context.md` claimed a transform error does not propagate and appears in `logs`, and `the-three-phases.md` showed a whole-generator include gate that does not exist. The reviewer caught both. | 2 of 5 should-fix; part of a 10m address round | ticket | orbital-ticket-prep: for a docs table of renames, read each named paragraph against the code and list the false sentences as edits too. | triage |
| The reference patch declared `Subject`'s `isSupported`/`transform`/`toPreviewModule` with method syntax. That made the parameters bivariant, so `#runSubjects` compiled with an entry of one kind and subjects of another. `deno check` passes this, and only the reviewer's scratch check found it. | 1 should-fix, ~3m in address | check | deno lint plugin in `deno/.lint/`: flag method signatures that take a generic parameter in exported type literals under `core/`; prefer function-typed properties. | triage |
| The ticket's done-when listed seven tests and none asked `toPreviewModule` or `toSource`, so a wrong model or GraphQL preview source passed all 306 context tests. The reviewer found the gap. | 1 should-fix, one test added | ticket | orbital-ticket-prep: for a refactor that moves wiring into new methods, the done-when names one test for each moved method. | triage |
| The address step's first thread replies passed `--repo` to `gh api`, as the workflow prompt says for "every gh call". `gh api` rejects the flag, and all five posts failed. | ~1m, one retry | steering | orbital-workflows `address` prompt: "Pass `--repo` on every `gh` call, except `gh api`, whose path names the repository." | none — cost under threshold |
| #461 and #462 ran side by side, so the second to merge needed a main merge and a re-bump, as the goal planned. The check step took 14m, most of it the full `deno task check` again. | ~14m check step | workflow | none: planned in the goal; the delivery lead's batching chose it. | none — planned and expected |
| The STE hook rejected six sentences in the new docs text (length or passive), and each needed a second Edit. | ~6 extra edits | tool-cost | none: the hook works as intended and the rewrites are short. | none — working as intended |

## 3. Keep

- An adversarial scratch `deno check` with `@ts-expect-error` lines, run against both the old and the new file, proves a type-level fix in both directions. Write it into the review and address prompts for type findings.
- Mutation-checking each ticket rule: remove the line, see the named test fail, restore. It showed the 28 tests held, and that the trail-shape trap is caught only by `check-work`.
- follow_on's before/after differential on the published packages gives behavior-preserving refactors a cheap end-to-end check. Write it into the follow_on prompt for "changes no behavior" tickets.

## 4. Deferred

- `deno/core/context/Subject.ts` `GqlOperationSubject.matches` / `GenerateContext.#runGenerator` gqlOperation case: an object filter in `settings.skip`/`settings.include` for a GraphQL generator is ignored, with no skipped result and no warning. A GraphQL user who writes a per-operation filter meets it. It was there before this change and the ticket excluded it. Source: self-review on PR #465.
- `deno/core/context/Subject.ts` every `isSupported`: the `typeof entry.isSupported !== 'function'` guard is dead for entries made by the factories. The ticket's traps say to keep it for tests and old callers; whoever tidies the entry types next meets it.
- `deno/core/context/Subject.ts` subject classes: `trail`/`enrichmentPath`/`label` are mutable fields, and `enrichmentPath` is the same array as `trail` for operations. Code that mutates one would change the other. Nothing does today. Source: self-review.
- `deno/core/context/GenerateContext.ts` `toSupportedSubjects` and `toEnrichmentDefaults`: they still switch on kind themselves instead of using `Subject`. The ticket names them as a later ticket.
- Settings filters: a wrongly shaped model filter (`{ '@skmtc/gen-zod': ['repository'] }`, an array instead of `{ refName: [] }`) is ignored, with no skipped result and no error. A user who guesses the shape meets it on their first filter. Seen by follow_on; related to #330.
- Generate: two copies of core in one run fail with "is not a code file: a model Definition cannot go there", which does not name the duplicate core. A generator author whose import map pulls a second core meets it. Seen by follow_on's harness.
