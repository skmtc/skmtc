# Retro: #293 version check on pull requests (run 2026-10-31-co2ypn)

## 1. Summary

#293 asked for a CI check that fails a PR when a changed package keeps the base's version or one already on JSR. Delivered in PR #303 (squash-merged as 6815ddbd): `deno/.scripts/version-check.ts`, the `version-check` task and a `pull_request` step in `coverage.yml`. CI on main is green, and the step ran on #303 itself and printed "Version check passed".
Run: 24m 05s wall clock, 18m 55s agent time; 17k input, 7.48M cached and 64k output tokens; about $5.31. The forked `/code-review` runs are not counted.
The most costly step was implement (11m, $2.80). It was worth it: one implementation round, tests for every "done when" item, each rule shown to be load-bearing by removing it, and real repros against git and live JSR. The review found no blocking issues.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| In implement, `git reset --hard HEAD~1` to drop a temporary repro commit also discarded two uncommitted edits (`export isPublished`, the `version-check` task line), which then had to be re-applied | ~1 min; a silent loss risk | workflow | Implement prompt in implement-ticket-dg: "commit your work before a temporary repro commit, and drop it with `git reset --keep HEAD~1`, never `--hard`" | triage |
| The worktree root is the repo root, with the Deno workspace one level down in `deno/` (`.../XiBxPdzcxW/deno/deno`). Implement's first commands ran in the wrong directory, and follow_on hit "Task not found" from the root | ~2 min over two steps | navigation | Ticket-prep Context "Commands" block: say the step starts at the repo root and every `deno task` needs `cd deno` first; or set the steps' working directory to `deno/` | triage |
| The ticket's decided command `git diff --name-only <merge-base>...HEAD` keeps rename detection on, so a file moved out of a package counted only for the package it moved into. Self-review caught it, not the ticket | one fix commit, ~3 min | ticket | Ticket-prep skill: when a ticket fixes a `git diff` command for path classification, write `--no-renames` into it | triage |

## 3. Keep

- Pure rule function plus a thin git and network `main`, with every rule line removed once to name the test that fails. Already in the implement prompt; it made review fast (0 blocking).
- Reproducing both failure messages on real history (`--base 2580fdad~1`, and a temporary unbumped commit) before handoff. It belongs in the ticket-prep "Done when" template for CI checks.

## 4. Deferred

- `.github/workflows/coverage.yml:45`: a stale green PR check still lets the silent no-publish through. The "guard main" ruleset has no required checks or up-to-date rule, and `allow_update_branch` is false. The second of two same-base bumps can merge on an old green check. Proposed fix: also run `version-check --base ${{ github.event.before }}` on push to main. Met by the next pair of parallel core runs. https://github.com/skmtc/skmtc/pull/303#issuecomment-6544880205
- `deno/.scripts/version-check.ts` `versionCheck`: the registry is queried one package at a time for every non-private package, including unchanged ones. A transient JSR 5xx on an unrelated package fails PR CI. Fix: look up only the changed packages, in parallel. https://github.com/skmtc/skmtc/pull/303#issuecomment-6544880490
- `deno/.scripts/version-check.ts`: the loop that builds the published set is duplicated from `release()` in `release.ts`. Met by the next edit to either. Same nits comment.
- `isShippedChange` uses hand-written path rules instead of each package's `publish.exclude` or `deno publish --dry-run`. cli ships `tests/` and `*.test.tsx` files that are not counted, and core's excluded `_schemas/` still counts. Met when a test-data-only PR is told to bump. Author's self-review, PR #303 body.
- The root `deno.json` exemption lets an exports or import change go through without a bump when the version is unchanged. This was kept per the ticket's decision. Met by a PR that edits only a package's `deno.json` imports. Author's self-review.
- Snapshot and fixture files outside `test/` (for example `__snapshots__`) count as shipped changes and force a bump. This was kept per the ticket's definition. Met by a snapshot-only PR. Author's self-review.
