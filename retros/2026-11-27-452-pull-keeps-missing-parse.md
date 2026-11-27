# Retro: #452 pull keeps local parse settings when the hub sends none

Run `2026-11-27-trqhp5` of `implement-ticket-dg`. PR https://github.com/skmtc/skmtc/pull/458, merged as `764d7614`.

## 1. Summary

The ticket asked `skmtc pull` to keep the local `parse` or `system` when the hub response has no `parse` key, so a hub project last pushed by CLI 0.11.2 or earlier no longer deletes local parse settings. It also asked push's overwrite check to count a hub project that holds only `parse`. Both shipped as CLI 0.12.1, with tests that fail when the guarded line is removed. Review was clean. follow_on ran the published JSR binary against a hub stand-in built from skmtc-hub's own schemas, and all four done-when items held.
The run took 1h 31m, 21m 43s of it waiting on the operator. It used 15.6k input, 17.3M cached and 72k output tokens, about $8.27. implement cost the most ($2.95, 7m). That was worth it: the code, tests, docs and self-review fix were done in one step. The longest step was check (40m 55s, $1.41). Most of that time went on the version bump the ticket kept from the author, two merges of main and one Windows rerun.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's Release section gave `deno task bump cli` to the delivery lead, so the PR opened with `coverage` red on version-check and was labelled `blocked`. The run then waited for the operator, and check ran the bump. | 21m 43s waiting on the operator + a second check visit | ticket | orbital-ticket-prep: in a single-package ticket, the Release section tells the author to run `deno task bump <dir>` in implement | triage |
| While the PR waited, main took cli to 0.12.0 (#439). The bump check had just made (0.11.6→0.11.7, `27a39d3e`) was superseded. check merged main again, resolved the `deno/cli/deno.json` conflict and bumped again to 0.12.1. | 1 extra merge + bump + full `deno task check`, ~10m | workflow | orbital-workflows#105: rerun version-check against `origin/main` just before the squash-merge, and bump only the colliding package | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| tests-windows failed on `CreateProjectView.test.tsx:143`, a spy assertion after a fixed 250 ms wait. The change did not touch it, and it passed on rerun. | 1 CI rerun, part of check's wait | check | `deno/cli/components/CreateProjectView.test.tsx`: wait for the spy call instead of a fixed 250 ms | [skmtc#385](https://github.com/skmtc/skmtc/issues/385) |
| The author dismissed "push sends `parse: {}`" because the hub would have to store `{}`. The reviewer found `client-settings.ts:354/390` in skmtc-hub already stores and returns `{}`. The author had read the hub only for the `parse` field's type. | 1 deferred finding argued on a false premise | ticket | orbital-ticket-prep: a ticket whose rule depends on what the hub stores names the hub file and lines that store and return it | triage |
| The worktree root is `.../jhHwvccdCU/deno` and the Deno workspace is `deno/deno`, so the first `ls cli/lib` in implement and the first git commands in follow_on ran one level wrong. This also happened in the #440 run. | ~1 call per step | navigation | workflow prompt context: state the repository root and the Deno workspace path for skmtc runs | triage |
| The CLI has no hub origin override. To run the real binary against a stand-in hub, follow_on had to write a fetch preload that redirected every skmtc.* host to 127.0.0.1. | a few minutes in follow_on | information | `deno/cli/lib/hub-env.ts`: accept `SKMTC_HUB_ORIGIN` to override the origin for the `local` environment | triage |
| The push ran the pre-push `deno task check`, which took over 2 minutes. A `sleep 60` wait was blocked, so open_pr switched to a background until-loop. | open_pr 3m 36s for one push | tool-cost | orbital-workflows#92: give agents one sanctioned way to wait on a long background job | [orbital-workflows#92](https://github.com/dmitrigrabov/orbital-workflows/issues/92) |
| follow_on's first `expect` script for the interactive push prompt hung until the 150 s tool timeout. Because the sandbox denies `ps` and no PID was recorded, it could not confirm the CLI child had exited. | ~3m | tool-cost | follow_on prompt: wrap a pseudo-terminal driver in `timeout` and record the child's PID at launch | triage |

## 3. Keep

- Mutation checks on each guarded line: removing the `'parse' in hubSettings` guard or the parse clause in `hasConfigData` failed the new tests. Already in the implement prompt.
- follow_on used the hub's own conversion and schema modules in a stand-in, instead of mocks, to test the published binary. Record this in the follow_on prompt as the pattern for CLI↔hub tickets.

## 4. Deferred

- `deno/cli/lib/push-headless.ts:50` with `pull-headless.ts:218`: a checkout that deletes its parse settings and pushes leaves `parse` out of the request, so the hub stores none. Other checkouts then keep their old parse on pull. This hits any team that clears parse settings. The fix is for push to send `parse: {}`; the hub already stores and returns it (skmtc-hub `client-settings.ts:354/390`). Source: https://github.com/skmtc/skmtc/pull/458#issuecomment-7222406762
- `deno/cli/commands/push.ts:124`: for a hub project that holds only parse settings, the interactive overwrite prompt reads "already has config (0 enrichment rows)". A user pushing onto such a project sees this every time. Pass a summary of parse/include/skip to `confirmOverwrite` and name them in the prompt. Source: https://github.com/skmtc/skmtc/pull/458#issuecomment-7222406762
- `deno/cli/components/CreateProjectView.test.tsx:143`: a fixed 250 ms wait before a spy assertion flakes on tests-windows. Any PR's CI can meet it. Tracked in https://github.com/skmtc/skmtc/issues/385.
- The CLI's hub origin cannot be overridden (`deno/cli/lib/hub-env.ts`). Anyone who tests push or pull against a local hub needs a fetch preload. Seen in follow_on.
