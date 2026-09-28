# Retro: #170 — Coveralls outages and retro-only Publish runs

Run `2026-09-28-1cm47y` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** Two CI settings were costing delivery runs time:

- A Coveralls outage turned `main` red. The #153 run waited 55 minutes at a
  post-merge gate for it.
- Every delivery run ends with a push that only adds `retros/<file>.md`, and
  Publish ran on it.

The ticket named the fix: add `fail-on-error: false` to the Coveralls step,
and add `paths-ignore: ['retros/**']` to Publish's `push` trigger.

**Delivered.** PR #172, squash-merged as `b406d2b3`.

- `coverage.yml`: the Coveralls step has `continue-on-error: true` and
  `timeout-minutes: 5`. A following step emits `::warning::` when the upload
  fails or times out. This replaced the ticket's `fail-on-error: false` (see
  2.1). The operator accepted the change at a gate.
- `publish.yml`: `paths-ignore` covers `retros/**`, `notes/**`, `assets/**`,
  `autoresearch/**`, `README.md`, `RESUME.md` and `CONTRIBUTING.md`. The
  header says to re-run a failed Publish with `workflow_dispatch`, because
  neither a docs-only merge nor an empty commit starts it.
- `deno/CLAUDE.md` no longer says Publish runs on every merge.
- Follow-up: #173 asks for the Orbital `ci_main` step to continue past a CI
  failure the change didn't cause.

**Verified.**
- Both workflows pass `@action-validator/cli` and parse with `@std/yaml`.
  `deno task verify-docs` passes.
- CI on `main` at `b406d2b3` passed. The upload succeeded, the warning step
  was skipped, and Publish had nothing to publish.
- A throwaway script replayed the last 25 commits on `main` through GitHub's
  documented path-filter rules. The retro-only merges #169, #162 and #157 now
  start neither workflow, and every code or CI commit still starts both.
- **Not seen live:** a retro-only push to `main`, or a real Coveralls failure
  or timeout. This retro's own merge is the first live test of the Publish
  filter.

**Cost.** 1h 16m wall clock, 170 uncached input and 52,857 output tokens,
about $1.06 at reference prices. Real cost is higher, because cached input is
excluded. The change itself was two YAML keys. Most of the wall clock went on
waiting: 31m 41s in `ci_main` and 2m 50s at the `pr_blocked` gate.

## 2. What was surprising, unexpected or problematic

1. **The ticket prescribed a mechanism that review showed was wrong.** The
   done-when said "The Coveralls step has `fail-on-error: false`", copied
   from skmtc-generators. The reviewer read the coverage-reporter source and
   found two problems:
   - `fail-on-error: false` runs `coveralls report --no-fail`, so *every*
     error exits 0. That includes a moved `deno/coverage.lcov`, a rejected
     token and a failed reporter download, and nothing in the run shows it.
   - The reporter posts with no connect or read timeout, so an outage that
     stalls instead of returning 500 would still hold Test Coverage for up
     to 360 minutes.

   `implement` wrote the ticket's line exactly and didn't look at what the
   input does. The fix (`continue-on-error` + `timeout-minutes` + a warning
   step) no longer met the literal done-when. `check` therefore left the
   thread open and raised the `pr_blocked` gate. That cost a second `check`
   visit and an operator decision.
2. **skmtc-generators has the same silent failure.** It sets
   `fail-on-error: false` on both of its uploads, so a broken token or a moved
   LCOV file there stops coverage with no signal. No issue exists for it yet.
3. **`ci_main` spent 29 minutes on a Blacksmith runner queue, not on CI.**
   Test Coverage for `b406d2b3` was created at 19:47:59, and its `coverage`
   job on `blacksmith-4vcpu-ubuntu-2404` started at 20:16:49 and ran for
   2.5 minutes.
   - Every Blacksmith coverage job queued between 19:41 and 20:16 started
     within the same six seconds (20:16:43–20:16:49). That is a runner-side
     stall, not load from this run.
   - `tests-windows` (GitHub-hosted) finished at 19:56. Publish (GitHub-hosted)
     finished in 30 seconds.
   - The new `timeout-minutes: 5` can't help here, because step and job
     timeouts count from when the job starts, not from when it is queued.
     This is another external cause of post-merge waits, of the kind #173
     describes.
4. **Trigger behaviour can't be tested before merge.** `on.push.branches:
   [main]` means the only live test of `paths-ignore` is a real push to
   `main`. The replay script is a model of GitHub's rules, not GitHub's
   matcher.
5. **Small slips in `implement`:**
   - A `deno eval` that imported `jsr:@std/yaml` wrote `@std/yaml` into the
     root `deno.lock`. `git diff` caught it before the commit, and later
     checks used `--no-lock`.
   - `gh issue view 170 --comments` printed nothing, with no error. `--json
     title,body,comments` worked.
   - `implement` shows 20m 40s for 4,158 output tokens. Most of that time was
     not model work. The `npx --yes @action-validator/cli` downloads account
     for some, but I can't account for all of it.
6. **Narrowing the change to one directory was a ticket-scope trap.** The
   ticket named only `retros/**`. The reviewer pointed out that `notes/**`,
   `assets/**`, `autoresearch/**` and the root docs also can't change a
   published version, and each hold the `publish` concurrency slot. Widening
   the filter needed a check that nothing in the npm build reads those files:
   `build-node.ts` copies `deno/core/README.md` and `deno/core/LICENSE`, not
   the root files.

## 3. Prevention and mitigation

| Problem | Who | Mitigation |
| --- | --- | --- |
| Done-when names a mechanism (2.1) | Ticket author | State the outcome ("a Coveralls outage leaves the job green, and a failed upload is still visible") and give the mechanism as a suggestion. Then a better mechanism doesn't need a gate. |
| Copied a setting without reading what it does (2.1) | Agents (`implement`) | For any CI or third-party input a ticket names, read the action's source or docs for what the input does on *every* error path before writing it. The reviewer did this in minutes. |
| Same silent failure in skmtc-generators (2.2) | Operator | Open an issue in `skmtc/skmtc-generators` to apply the same `continue-on-error` + timeout + warning setup to both uploads. |
| Runner queue stall (2.3) | Workflow / repo | `ci_main` could report "queued on runner" separately from "running", and treat a long queue as external (#173). The repo could move the coverage job to `ubuntu-latest` if Blacksmith queues keep recurring. |
| No pre-merge test for triggers (2.4) | Repo | Keep the replay script as a repo script (for example `deno/.scripts/check-triggers.ts`), so any trigger change can be run against recent history in CI or locally. |
| Lockfile side effect (2.5) | Agents | Use `deno eval --no-lock` or `deno run --no-lock` for scratch checks from inside the workspace. |
| Single-directory scope (2.6) | Ticket author | When a ticket adds a path filter, list the whole class of paths it applies to ("paths that never feed a published package"), not the one that caused the latest problem. |

## 4. What worked well

- **Review read the upstream source.** Both Medium findings came from
  coverage-reporter's `cmd.cr` and `jobs.cr`, not from guessing. Review cost
  $0.05 and changed the design.
- **One `address` pass cleared all seven threads.** One commit (`d87a10af`)
  and one reply per thread, with the ticket deviation named in both the reply
  and the PR description. `address` cost $0.16.
- **The gate was used for exactly what it is for.** `check` did not guess
  whether the operator would accept a different mechanism. It left one
  thread open, labelled the PR and wrote the choice out. The operator
  settled it in under three minutes.
- **Replaying history as verification.** Running real commits from `main`
  through the merged triggers showed both halves of the ticket: retro-only
  merges skip, and code merges still run. That beats reasoning about globs.
- **Checking the build before widening `paths-ignore`.** Reading
  `build-node.ts` settled whether the root `README.md` was safe to ignore
  before it went into the filter.
- **Separating the root cause from this repo.** The `ci_main` loop is in the
  Orbital workflow. The reviewer said so, `check` opened #173, and the PR
  stayed small.

## 5. Where the effort went

- **`ci_main`: 31m 41s, $0.03 (42% of wall clock).** All but 2.5 minutes was
  the Blacksmith queue (2.3). There was nothing for the agent to do. The cost
  is time, not tokens.
- **`check`: 2 visits, 8m 06s, 26,454 output tokens, $0.53 (50% of cost).**
  The second visit and most of the tokens came from the done-when deviation:
  checking the runner source for timeout semantics, writing the blocked
  comment, then the unblock round. Worth it given the ticket as written. A
  ticket that stated the outcome would have removed most of it.
- **`implement`: 20m 40s, $0.08.** Cheap in tokens, slow in wall clock
  (2.5). The work was a four-line diff. It missed the `fail-on-error`
  semantics, which pushed work into review, `address` and `check`.
- **`review`: 6m 13s, $0.05, and `address`: 2m 54s, $0.16.** The best value
  in the run.
- **`follow_on` ($0.07), `merge` ($0.06), `close_ticket` ($0.04), `open_pr`
  ($0.03):** proportionate.
