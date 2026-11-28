# Retro: #494 core: remove rootRef, which nothing reads (PR #495)

## 1. Summary

#494 asked to remove the unused `rootRef` from core's model API (a core minor), to remove it from the stock generators in their pin-move PR, and to show that the output on `core/_schemas` is unchanged. Core 0.58.0 shipped in PR #495 (squash 79212a02) and is published on JSR. The stock-generator half is not delivered: done-when item 2 lives in skmtc-generators, and #494 closed with nothing tracking it. Follow-on showed the output stays identical on a throwaway copy (40,519 files). Run `2026-11-28-irawip`: 40m 38s wall clock, 33m 25s agent time, 25,116 input / 25.2M cached / 99,433 output tokens, about $11.93. The costliest step was implement ($6.60, 14m 47s), which was reasonable for 36 files of mechanical removal plus a before/after byte comparison. Review ($2.99) found nothing to fix, but it did add gen-valibot to the list of generators left to change.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket put a change in another repository (stock generators drop `rootRef`) in its done-when, so #494 closed with item 2 not done and no ticket or PR tracking it. | Item 2 still open; follow-on spent about 5m proving it on a throwaway copy | ticket | orbital-ticket-prep: split a done-when item that lands in another repo into its own ticket in that repo, linked "Part of #N", before the run starts. | triage |
| verify-docs failed `plugin version` twice after the `describes` edit: first because I hand-bumped plugin.json, then because the digest needs `deno task bump-plugin`. This is the second run in a row with this finding (see the #490 retro). | Two extra full `deno task check` runs, about 7m | steering | deno/CLAUDE.md "Releasing" and the implement prompt's release line: "a published-skill edit needs `deno task bump-plugin`; commit its three files". | triage |
| The author's list of stock generators that still pass `rootRef` missed gen-zod and gen-valibot. The local skmtc-generators checkout was stale (core 0.48), so nobody grepped its origin/main until review and follow-on did. | Review and follow-on each found part of it, about 3m | information | Implement prompt for cross-repo tickets: run `git fetch` and grep the sibling repo's origin/main (`git grep <symbol> origin/main`), not its working tree. | triage |
| The skill skeleton is excluded from the workspace and pins `jsr:@skmtc/core@^0.47.0`, so `deno task check` never compiles it against local core. My first type-error probe on it showed nothing useful. | About 3m and two wasted probes | check | Add the skeleton to `deno task check` with its imports mapped to the local core and lang-typescript, and move its pin to the current minor. | triage |
| Main CI `tests-windows` failed three `cli/tasks/CreateProjectTask.test.tsx` tests (fixed sleeps, then "Spy not called"). The change did not cause it: the PR head with the same tree passed. | ci_triage 1m 39s; main shows red | check | Fix #385 by polling with a deadline instead of sleeping, and include CreateProjectTask.test.tsx. | [#385](https://github.com/skmtc/skmtc/issues/385) |
| The pre-push hook runs the full suite (about 4m), longer than the open_pr step's three-minute push wait, so the step needed a second wait. | About 1m extra in open_pr | workflow | Make open_pr's push wait at least 6 minutes for skmtc, or say there that the hook runs `deno task check`. | triage |
| `Edit` with `replace_all` on `      rootRef,\n` also matched lines indented more deeply and misindented five closing brackets in the skeleton. My diff read caught it. | About 2m, six extra edits | tool-cost | Implement prompt: with `replace_all` on an indented line, include the preceding line in old_string so that deeper indents do not match. | triage |

## 3. Keep

- Hashing a fixture generator's whole output on origin/main and on the branch (here `.scripts/work-run.ts` on remote-com.json, 955 files) proves "output unchanged" in a minute. Write it into deno/CLAUDE.md as the standard check for a no-behavior-change refactor.
- Follow-on checking a downstream repo on a throwaway copy against the published packages answered a cross-repo done-when item without an extra run. Keep it in the follow_on prompt.

## 4. Deferred

- skmtc-generators: remove `rootRef` from gen-typescript, gen-zod, gen-valibot (it stores it in `ValibotRef`), gen-arktype, gen-effect-schema, gen-kotlin-jackson and gen-msw (195 occurrences in 44 files) in the pin move to core 0.58. Until then they fail to type-check on ^0.58, with 50 TS2353/TS2339 errors. Open skmtc-generators PR #152 touches gen-typescript and gen-zod and may need a rebase.
- deno/docs/concepts/the-type-system.md quotes gen-typescript's `Ts.ts` and `TsProjection.ts` without `rootRef`, which does not match those files until the pin-move PR lands.
- deno/docs/skills/skmtc-generator/skeleton/deno.json pins core ^0.47.0, and `deno check mod.ts` there gives 44 errors (core 0.47.4 and 0.48.0 both load). Anyone who copies the skeleton as the skill says meets them.
- deno/cli/lib/kotlin-model-generator.ts union comment: it names a `UnionValue` class and a "oneOf → sealed interface" recipe that no code or skill holds. It no longer says how the parent ref reaches the union. Users of the Kotlin scaffold meet it at the 'union is not mapped' throw.
- Strict generate on core/_schemas leaves some stock generators with no output, the same before and after this change: gen-typescript and others on cloudflare.json (`Cannot merge schemas: enum values have no intersection`), gen-kotlin-jackson on remote-com.json (synthesized `ProjectBudget` collides with a component class), and gen-arktype on recursive models (skmtc-generators#97). Reported by follow-on.
- No test checks the arguments ModelDriver passes to the projection constructor. This gap predates the change, and the reviewer dropped it as out of scope.
