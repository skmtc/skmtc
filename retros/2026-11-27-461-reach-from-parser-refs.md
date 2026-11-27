# Retro: #461, `ParseContext.toReach()` (file plan 2 of 6)

Run `2026-11-27-t0ppjq` of `implement-ticket-dg`, PR https://github.com/skmtc/skmtc/pull/464.

## 1. Summary

#461 asked for `Reach`, read from the refs the parser already records, as a core minor (0.53.0 → 0.54.0). It was delivered as written, with one review round. That round fixed a defect in the ticket's own reference patch: a JSON-pointer ref to a parameter or response was counted as a model. The PR merged as `11d63139`, Publish was green, and follow_on checked the published 0.54.0 against an independent walk on four real documents: 0 missing, 0 extra. The run took 41m 12s, with 19,905 input, 13.0M cached and 81,670 output tokens, est. $7.86. implement cost the most ($2.95, 8m 29s), then review_standard ($2.63). Both were worth it: the self-review in implement found the pointer-ref defect, and the reviewer reproduced it with the real parser.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The reference patch counted a pointer ref into `paths` (a parameter or response) as a model, because `canNameSchema` reads only the path. The self-review found it, but the step's "Proposed, not built" rule sent it to a review round, where the reviewer reproduced it. | 1 review round: address 6m 47s + check 6m 35s, about $1.17 | ticket | `orbital-ticket-prep` skill: a handoff whose code sorts refs must have a test for each `refType` it can meet, pointer refs into `paths` included | triage |
| `git push` in open_pr outlived the step's three-minute PID wait. The pre-push hook runs the full `deno task check` (about 4 min). It went to the background and finished. The same happened again in address. | about 4 min in open_pr and about 4 min in address, plus one extra call each | workflow | `implement-ticket-dg` push prompt: size the push wait to the repository's pre-push gate, or wait on the background task | https://github.com/dmitrigrabov/orbital-workflows/issues/84 |
| The ticket's version steps (bump, `record-api-surface`, skill `describes`) left out `deno task bump-plugin`, which `verify-docs` asks for once a skill file changes. | 1 extra verify-docs run, about 1 min | ticket | `orbital-ticket-prep` core-minor recipe: list `deno task bump-plugin` after the skill `describes` edit | triage |
| The worktree root is a folder named `deno` that holds the package folder `deno/`. The first `grep` in implement failed, and follow_on lost about two calls to relative paths. | 3 tool calls | navigation | Orbital worktree step: name the checkout folder after the repository (`skmtc`), or say "package root is `deno/`" in the implement prompt | triage |
| follow_on's scratch check of 0.54.0 was blocked by Deno's 24-hour dependency-age gate (as `deno/CLAUDE.md` describes) and needed one retry. | 1 retry | information | follow_on prompt for JSR libraries: point at the `minimumDependencyAge` exclusion in `deno/CLAUDE.md` | none: one retry only |

## 3. Keep

- Removing each rule's line in turn and watching a named test fail (four mutations in implement, one more in address), as the implement prompt asks. That is already written there.
- follow_on compared the published package against an independent walk on real documents. That is stronger than re-running the unit tests; write it into the follow_on guidance for library tickets.
- Typing hand-written test fixtures with the production type (`ReadRef['ref']`) instead of `as const`, as `~/.claude/CLAUDE.md` asks.

## 4. Deferred

- `deno/core/context/ParseContext.ts` `toReach()`: it maps every entry of `#oasRefs`, including dangling refs and refs held by subjects the parse removed, so `Reach` can name models that do not exist. The file plan (ticket 3) would meet this when it places files: https://github.com/skmtc/skmtc/pull/464#issuecomment-7224363126
- `deno/core/parse/toRefKey.ts`: a component name that contains `/` can collide with a deep-ref pointer key. This is old behaviour, and the reviewer dropped it as pathological. Only a document with such a name would meet it.
- `deno/core/parse/Reach.ts` `namedByOperation`: a path item parameter that the operation overrides is still named. This is accepted over-reach and is stated in the doc comment (1c191f79). A planner would count one model too many.
- `deno/core/context/ParseContext.ts` `toReach()`: it reads `consumer.stackTrail` for each ref, an array each time, which is most of the 156 ms on Microsoft Graph. A cheaper read needs a public `StackTrail` method (a minor). Ticket 3 meets this if the plan's build time matters.
- Not verified after the merge: Sentry and Microsoft Graph (the ticket's timing table), webhooks on a real document, and real documents with pointer refs into `paths`. Only unit tests cover the last two.
- GraphQL input gets no `Reach`, because its parser registers no `$ref`s. This is out of scope by the ticket. A GraphQL file plan would meet it.
