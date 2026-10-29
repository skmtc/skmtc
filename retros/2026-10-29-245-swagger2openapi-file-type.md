# Retro: #245 swagger2openapi `type: file` in components.schemas (with #246 folded in)

## 1. Summary

#246 asked to port the skmtc-hub#2158 review fixes into `@skmtc/swagger2openapi`. #245 asked to rewrite every
`type: file` in `components.schemas` to `type: string` plus `format: binary`, with one 0.1.5 bump shared by both.
Both shipped in PR #251, squash-merged as 9918a92b, with Publish and Test Coverage green on main. Review was clean
first time: 0 blocking findings and 1 deferred.

Run `2026-10-29-kubgs4` took 1h 43m wall-clock, of which 1h 21m was queued for a slot and 16m 46s was agent time.
Tokens: 16,951 input, 9.11M cached, 56,348 output, about $5.62 estimated. `implement` cost the most ($3.17, 11 min),
which was worth it: it covered two tickets, the fail-on-main proofs and the placement-trap check. `review_standard`
cost $1.77 and found nothing new, because 6 of its 9 raw findings repeated the author's dismissals.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| In `implement`, I typed `git checkout origin/main -- .` in place of a scoped command. It wiped the uncommitted #245 edits and staged main's files, so the edits had to be redone by hand and the test file recovered from a scratch worktree. | ~4 min, ~1M cached tokens | check | Add a PreToolUse Bash hook in the Orbital harness settings that blocks `git checkout <ref> -- .` and `git restore -s <ref> .` when the tree is dirty. | triage |
| Two done-when items say "the new tests fail on origin/main", but the #246 test "binary string under every example media type" and the #245 inline-under-`produces` test already pass on main, because #243 does both. Author, reviewer, check and follow_on each re-explained this. | ~4 summaries' worth of tokens, no rework | ticket | In the orbital-ticket-prep skill, split "new tests" into tests that must fail on main and regression guards that must pass on main. | triage |
| #250 merged during the run and took cli to 0.10.1, so this branch's cascade bump (cli 0.10.0 → 0.10.1) became a duplicate version. Self-review caught it after the rebase, and fb1dcacd set cli to 0.10.2. | 1 extra commit, ~2 min | check | Add a CI job (or a `deno task check` step) that fails when a PR's bumped `deno.json` version is not greater than the same package's version on main. | triage |
| `pnpm format:check`, a command the ticket lists for before the pull request, fails on 71 files that already fail on main. It could not act as a gate, so formatting was checked per file with `oxfmt --check <paths>`. | ~1 min | check | Format the repo once, then wire `format:check` into CI (#69). | [#69](https://github.com/skmtc/skmtc/issues/69) |
| The worktree had no `node_modules`, so `oxfmt: command not found` until `pnpm install --frozen-lockfile` ran. | ~1 min | workflow | Add `.orbital/bootstrap.sh` running `pnpm install --frozen-lockfile` (#218). | [#218](https://github.com/skmtc/skmtc/issues/218) |
| `deno task bump` rewrote `deno.json` with JSON.stringify layout, expanding `"exclude"` and other arrays. oxfmt then collapsed them, and running it on `cli/deno.json` also re-wrapped `permissions` arrays that were already unformatted on main. | ~2 min of manual re-edit | check | Have `.scripts/bump.ts` keep the original layout (edit the version and pin strings in place) or run oxfmt on the files it writes. | triage |

## 3. Keep

- Copy the new tests onto a scratch `git worktree add <tmp> origin/main` and run them there to prove fail-on-main. Write this down in the orbital-ticket-prep Traps template.
- Check a ticket's placement trap by moving the code into the forbidden spot for a moment and seeing the named tests fail. The ticket's Traps section already prompted this, so keep writing traps that way.

## 4. Deferred

- `deno/swagger2openapi/io.ts:175-185`: `convertStrResolve`, `convertFile`, `convertUrl` and `convertStream` still return `ConvertResult`, so `mediaTypeInference` is optional. Callers of the async entry points need a `?.`. Widen them to `ConvertResultWithInference` here and in the hub copy. https://github.com/skmtc/skmtc/pull/251#issuecomment-6505383397
- `deno/swagger2openapi/converter.ts` `processParameter` and `processResponse`: an inline nested `type: file` in a body or response schema, and a body parameter with `schema: {type: file}`, keep `type: file`. Anyone converting such a Swagger 2.0 document gets invalid OAS 3.0. #245 scoped this out.
- `deno/swagger2openapi/converter.ts` `processResponse`: an inline file response schema is replaced whole, which drops its `description` and `x-*`, while definitions keep them. A reader sees different shapes for the same schema. The ticket decided to leave this as it is.
- `deno/swagger2openapi/converter.ts` `processResponse`: an inferred file `$ref` is inlined as a binary string, while under `produces` the `$ref` stays. Generators see a named type in one case and an anonymous one in the other. The #243 tests pin the current behaviour.
- `deno/swagger2openapi/converter.ts` `toSchemaKind`: it recognizes only `type: file`. If it also recognized `string`/`binary`, all three file rewrites could become one pass in `fixUpSchema`. This is a refactor idea from the self-review.
- skmtc-hub#2180: the hub copy must take the #245 code and tests. That repo was not checked in this run.
