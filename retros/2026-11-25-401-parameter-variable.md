# Retro: #401 and #348 one variable name per parameter

## 1. Summary

#401 and #348 asked that the destructuring, property list and path template use one valid variable per parameter, and that a path's static text be escaped. Delivered in PR #408 (squash b7c6966c); lang-typescript 0.15.0 is on JSR, and Publish and Test Coverage on main are green.
The follow-on step generated hooks from the published package for the unusual names, type-checked and ran them, and found no fault in the change.
The run took 1h 06m: 22,514 input, 12.7M cached and 105,161 output tokens, an estimated $10.66, before forked sub-agents and this turn.
The longest step was review (29m 14s, $3.75): no blocking finding, but three should-fix ones, one of which stopped a duplicate version. The most expensive was implement (10m 24s, $4.24), worth it.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| review_standard ran `/code-review high`, the skill and level the author had just run, and posted three should-fix findings, three nits and one deferred. Its summary does not say where 29 minutes went. | 29m 14s, $3.75 | workflow | `implement-ticket-dg` review: for `standard`, read the self-review's summary first and scope `/review` to what it did not cover; record the sub-agent's time. | triage |
| #414 merged while this PR was open and shipped plugin 0.1.63 and skmtc-model 0.3.1, the numbers this branch used. Only two of the files conflicted. The reviewer caught it. | one thread; part of address (6m 27s) | check | `deno/.scripts/version-check.ts`: when the skills digest differs from the base's, require a plugin version, and versions of the changed skills, above the base's. | triage |
| The push in open_pr and in address passed the three-minute wait while the pre-push hook ran `deno task check` (tests alone 4m39s). I waited past the limit both times. | open_pr 4m 29s, address 6m 27s, mostly waiting | workflow | orbital-workflows#84: set the push wait above the gate time. | [orbital-workflows#84](https://github.com/dmitrigrabov/orbital-workflows/issues/84) |
| I wrote "Model generators give the key as it renders" in a comment and in my handoff from reading one generator; gen-zod and gen-valibot keep the document's key. A second JSDoc claimed too much about decoding. | two should-fix threads | review-rule | Reviewer: for a comment about what callers pass, read each caller. Contract note for `objectProperties.properties` in `deno/core/types/TypeSystem.ts`: whether keys are raw or rendered. | triage |
| Both tickets decided a new export, but #401 named a plain `deno task bump lang-typescript`; `verify-docs` refuses a new export on a patch. I ran the plain bump and the self-review caught it. | one bump and one plugin bump redone, one self-review finding | ticket | orbital-ticket-prep: a ticket that adds an export to core or lang-typescript names `--minor`, `record-api-surface` and the skills' `describes`. | triage |
| `deno/CLAUDE.md`'s Releasing section covers `deno task bump`, and not that a new export needs a minor; that is in `docs/skills/README.md` and `.scripts/api-surface.ts`. | three calls to learn the steps | navigation | `deno/CLAUDE.md` Releasing, step 1: one sentence that a public API change takes `--minor`, then `record-api-surface`, then `bump-plugin`. | triage |
| The test source held an invisible U+2028. The Edit tool could not match it in two attempts, and the step forbids scripts, so the nit stays. | two failed edits, one nit left | steering | `implement-ticket-dg` address: allow a one-off script for a character Edit cannot match. | triage |

## 3. Keep

- Evaluate generated code as a `data:application/typescript` module in a test, so reserved words are judged by a real parser. Record in `docs/skills/skmtc-lang-typescript/SKILL.md`.
- After the release, generate with a stock generator on the published package and run the output, as follow_on did. Record in `orbital-ticket-prep`.
- Commit first, then make mutations with Edit and restore with `git checkout`, two unrelated ones per run.

## 4. Deferred

- `deno/lang-typescript/src/ReactRouterPathParams.ts`, constructor: raw parameter names as variables, a syntax error for `enterprise-team` or `export`. Met by a generator that uses the export; none on skmtc-generators main does. Fix it or remove it. [Deferred findings](https://github.com/skmtc/skmtc/pull/408#issuecomment-7173669221), also self-review.
- `toPathTemplate.ts` with `queryArg`: `{ id }` gives `params[' id ']`, where `params. id` worked before. Met by a document with spaces in the braces. [Nits](https://github.com/skmtc/skmtc/pull/408#issuecomment-7173668660).
- `FunctionParameter.test.ts`, the test of rendered keys: literal U+2028 in the source. Met by an editor that normalizes it. Same nits comment.
- `FunctionParameter.ts`: two names that give one variable (`user-id` and `user.id`, `export` and `exportValue`) render a duplicate binding, invalid code. Met by users of such an operation. Follow-on defect (b) and self-review; the ticket leaves it.
- `toParameterVariable.ts`: `camelCase` drops non-ASCII letters (`名-前` gives `_`). Met by documents with such names that are not identifiers. Self-review; the ticket decided `camelCase`.
- `FunctionParameter.ts`, `stringLiteral`: a document key with the shape of a literal (`'id'` with its quotes) is read as rendered, and escapes other than `handleKey`'s are not decoded. Met by a generator that renders keys another way. [Thread](https://github.com/skmtc/skmtc/pull/408#discussion_r4700454227); now stated in comments.
- `FunctionParameter.hasProperty('user-id')` is false when keys are rendered. Met by a generator that asks for such a name; today's callers ask only for `body`. Self-review; existed before.
- `toPathTemplate.ts`: a CR in static text becomes LF in the template literal. Met by no known document. Found while implementing.
- `sanitizePropertyName.ts`: `class` stays bare and `2fa` gives `'2fa': 2fa`, both syntax errors in a destructuring. Met by a generator that destructures with it. Self-review; the ticket keeps it as it is.
- `docs/skills/skmtc-model/skeleton`: `deno.json` sets no `minimumDependencyAge`, so a copy made within a day of a release fails to resolve. Met by skeleton users. Follow-on.
- `docs/skills/skmtc-model/skeleton/deno.lock` still names lang-typescript 0.13. Met by whoever copies it. Found in address.
- skmtc-generators on core 0.47.2: `gen-typescript/src/Ts.ts:100` and `gen-zod/src/Zod.ts:122` fail type checking (OasIntersection). So [skmtc-generators#123](https://github.com/skmtc/skmtc-generators/issues/123) depends on [#117](https://github.com/skmtc/skmtc-generators/issues/117), which its text does not name, and its `^0.14` pins need an explicit move to 0.15.0. Follow-on defect (a).
- Not shown: gen-tanstack-query-supabase-zod and gen-effect-http with unusual names; `queryParamArgs` belongs to #123.
