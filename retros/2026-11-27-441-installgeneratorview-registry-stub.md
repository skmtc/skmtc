# Retro: #441, stub the JSR registry in InstallGeneratorView tests

Run `2026-11-27-l0ijpf` of `implement-ticket-dg`, PR #449, merged as 061342ec.

## 1. Summary

The ticket asked that every test in `deno/cli/components/InstallGeneratorView.test.tsx` stub the JSR registry, so that a JSR outage cannot fail CI on `main`. The run added `stubRegistryGenerators` to the four tests that lacked it. With the network denied, the file went from 3 passed / 4 failed to 6 of 6. `deno task check` passed (5,432 tests), CI on `main` was green, and the follow-on step confirmed the result on merged `main`.
The run took 27m 25s and an estimated $4.03: 18,449 input, 5,521,205 cached and 35,147 output tokens.
The costliest step was `implement` ($1.89, 7m 54s), mostly the forked `/code-review high` and a 3-minute full `deno task check`, for an 8-line test-only diff. That review found only a lint nit, so it was more than this change needed. `watch_ci` (7m 22s) was waiting time, not agent work.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `implement` ran the forked `/code-review high` and a full `deno task check` on a one-file, test-only diff marked `review_depth = light`. The review returned one lint nit. | ~$1 of $1.89 (the fork is unrecorded), ~5m | workflow | In the `implement-ticket-dg` implement prompt, scale the self-review level to `review_depth` (light → `/code-review low`). | triage |
| The ticket's live-registry dependency only showed up during a JSR 500. No check runs the CLI component tests with the network denied, so the next test that forgets the stub will ship. | One red `main` plus a whole run (this one) | check | In the CI test job (or a `deno task check` step), run `deno/cli/components/*.test.tsx` and `deno/cli/tasks/*.test.tsx` with `--deny-net`. | triage |
| The worktree root is a directory named `deno` that holds the repo's `deno/` package root. `implement` (first `cat`) and `follow_on` (first worktree command) both ran from the wrong level and failed once. | 2 retries, <1m | navigation | Name Orbital worktrees after the run id only, or state the package root (`<worktree>/deno`) in the step context. | triage |
| The ticket says four tests fetched from jsr.io. The reviewer showed that only three did: 'all parameters provided' renders only `InstallGeneratorsTask`, which never calls `useGetGenerators`. | 0 rounds, a little review time | ticket | When writing a ticket that names tests, `orbital-ticket-prep` should check the claim with one run (here `--deny-net`). | triage |
| `deno lint` reports `no-unused-vars` for every `using fetchStub` binding in this file and in `CreateProjectTask.test.tsx`, but no CI job or `deno task check` runs `deno lint`, so the warnings pile up unseen. | Self-review finding, dismissed | check | Either wire `deno lint` into `deno task check` and rename the bindings to `_fetchStub`, or drop the rule for `using` bindings. | triage |

## 3. Keep

- Reproduce first with `--deny-net`, then prove each stub matters by removing it once and watching the file fail. This took seconds and gave the PR its evidence. Add it to the `test` skill as the recipe for network-isolation tickets.
- The follow-on step reran the single denied-network command on merged `main` instead of the whole suite, a cheap and exact post-merge check.

## 4. Deferred

- `deno/cli/components/useGetGenerators.ts:9`: the registry listing has no `.catch`. A CLI user who opens the install or create view while JSR is down gets an unhandled rejection instead of a message. Source: https://github.com/skmtc/skmtc/pull/449#issuecomment-7221609719
- `deno/cli/components/InstallGeneratorView.test.tsx` and `deno/cli/tasks/CreateProjectTask.test.tsx`: the `using fetchStub` bindings trip `deno lint` `no-unused-vars`. Anyone who runs `deno lint` sees 10 problems. This was a self-review finding, dismissed because the repo already uses the pattern.
- The stub in 'all parameters provided, installs immediately' guards no network call today. It matters only if that path starts listing generators. Source: the reviewer's light check on PR #449.
