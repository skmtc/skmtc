# Retro: #311 version check after merge and lower-version rule

## 1. Summary

#311 asked for two things: `toVersionProblems` should fail a changed package whose version is lower than the base's, and the Publish workflow should run the version check against `github.event.before` before it releases. Delivered in PR #322, merged as 49144b37 after one review round with no blocking findings. The Publish run for the merge printed "Version check passed" and then released as before. Run `2026-10-31-bp9od0` took 19m 54s (14m 14s of agent time). Tokens: 16.5k input, 5.33M cached, 48.4k output, about $4.30. The most costly step was implement ($2.15, 6m 44s), and about 2 minutes of that was `deno task check`. It was worth it: the ticket's Context section (where to work, decisions, traps) meant no exploration was needed.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The self-review `/code-review high` returned 10 findings. Six of them re-raised choices the ticket's "Decided" section had already made: the run_attempt bypass, `fetch-depth: 0`, the registry loop, whole-job failure, merge queue altitude, and force-push. The reviewer then re-dismissed six of its own ten. | about 2 min of triage in two steps; the forked review's tokens are not recorded | workflow | The implement and review prompts in `implement-ticket-dg` should pass the ticket's "Decided" section to the forked `/code-review` as known decisions not to re-raise | triage |
| The worktree root is `.../worktrees/79tgES9GXB/deno` and the workspace is its `deno/` subfolder, so my first command `cd`'d one level too high and git failed with "not a git repository". | about 1 min, one wasted call | navigation | The `implement-ticket-dg` prompt should give the repository root and the workspace folder explicitly, or Orbital should name the worktree folder after the repository and not end it in `/deno` | triage |
| The ticket's repro said to change "a file under `deno/core/src/`", but core has no `src/` folder. I used `deno/core/helpers/`. | under 1 min | ticket | orbital-ticket-prep: check every path in "Done when" against main, as the Context section's paths already are | triage |
| The reviewer flagged that `deno/CLAUDE.md:46` runs to 83 characters in an 80-column paragraph. No check covers prose wrap in CLAUDE.md. | one nit, no round | check | none: an optional nit, not worth a lint | none — optional style nit |

## 3. Keep

- The ticket's "Decided", "Traps" and "Commands" blocks made implementation one pass with no exploration. Already written down in the orbital-ticket-prep skill.
- Repro on a scratch branch that is never pushed, dropped with `git branch -D` after switching back, kept the PR's diff clean. Already written down in retros/2026-10-31-293-version-check.md.
- Disabling a rule line with `if (false && …)` and running with `--no-check` is a fast way to prove a test fails when the rule is removed. Write it down in the implement prompt's "remove the line" guidance.

## 4. Deferred

- `.github/workflows/publish.yml` concurrency (`group: publish`, `cancel-in-progress: false`): when a newer push replaces a pending Publish run, the replaced push's `before...HEAD` is never version-checked. A collision in that push can still ship nothing without a message. This happens when several merges land within one Publish run (3 of the last 60 runs were cancelled). Source: https://github.com/skmtc/skmtc/pull/322#issuecomment-6548493123
- `deno/.scripts/version-check.ts` `isShippedChange` ignores the package's own `deno.json`, so a merge that only lowers a version (a bad conflict resolution or a revert) is not flagged, and the cascade would publish the lower version. Found in self-review; the ticket said to leave `isShippedChange` as it is.
- A failing version check on a real push to main was never exercised. Only the pass path is shown (Publish run 41237366873). Whoever meets the first real collision will be the first to see it fail.
- Re-running a failed Publish with "Re-run jobs" skips the check (`run_attempt == 1`), so a maintainer can bypass a real failure with one click. This was decided in the ticket, and the docs say the fix is a new PR instead.
