# Retro: #216 CLI smoke tests resolve @skmtc/* from the workspace (run 2026-10-19-k77uqm)

## 1. Summary

- **Asked:** make the two GraphQL CLI smoke tests resolve every `@skmtc/*` package from the workspace, so they pass on a release branch whose core version is not on JSR yet. Keep the one-copy check, and make no version bump.
- **Delivered:** PR #217, squash-merged as 7ca4170a. CI on main is green and #216 is closed. Only the test file changed. The fixture gets a `deno.json` that holds only `links` to `core` and `worker`, and the CLI still writes its own pins. The proof with core at 0.30.0 passed.
- **Run:** 1h 04m wall clock, 26m of agent time. 16k input, 12.9M cached and 83k output tokens, about $7.45.
- **Costliest step:** `implement` was the most expensive, at 11m 26s and $3.65, and that was worth it: a repro, the cause, the proof, and two removal checks. The waiting cost more time: `check` (21m, 6m of agent time) and `watch_ci` (24m) spent about 38 minutes waiting on CI, more than half the wall clock.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `check` and `watch_ci` spent about 38 minutes waiting for CI, mostly `tests-windows`, whose status lagged after its test step had passed. The same suite then ran again on main. | About 38 min of 64 wall clock | workflow | In `implement-ticket-dg`, make `check` stop waiting once the PR's CI runs conclude, and let `watch_ci` own the wait on main. | triage |
| I reported the done-when "`deno task check` passes on main" as failing at the verify-docs api-surface gate (5 `Naked*GeneratorKey` exports re-shaped). CI and the reviewer saw it pass, and `check` posted a correction. It still fails locally on 7ca4170a with Deno 2.9.7. | About 5 min in `implement`, part of `check`'s 6m 39s, and a PR correction | check | `deno/.scripts/api-surface.ts`: record the Deno version next to the hashes and say so on a mismatch, instead of reporting a re-shape. | [#212 comment](https://github.com/skmtc/skmtc/issues/212#issuecomment-6271942200) |
| The worktree had no root `node_modules`. `deno test --allow-all` failed on `apps/web` tests and `npx oxfmt` could not run until I ran `pnpm install --frozen-lockfile`. This is the third run to hit it (#186, #193). | About 3 min and one full-suite rerun | workflow | Add `.orbital/bootstrap.sh` that runs `pnpm install --frozen-lockfile` at the root. | [#218](https://github.com/skmtc/skmtc/issues/218) |
| My first fix pre-wrote the core and worker pins in the fixture, which skipped `ensureWorkerDeps`, so the end-to-end test no longer covered the pins the CLI writes. My self-review caught it, not a rule. | One fix commit, about 3 min | review-rule | Reviewer rules: "an end-to-end fixture must not pre-create what the code under test writes". | triage |
| The ticket blamed `deno info` and `deno bundle` resolving differently. The real cause was `skmtc generate` writing a project `deno.json`, after which Deno ignores the parent workspace. The ticket's mechanism had not been checked. | About 3 min of probing | ticket | When a ticket names a cause, delivery-lead refinement records the one command that shows it, here the Deno "Ignoring the parent workspace config" warning. | triage |
| The git root is the outer worktree directory named `deno`, and the Deno workspace is `deno/deno`. My first `cat` failed, and `follow_on` lost about 2 commands to it. | About 2 min across two steps | navigation | Root `CLAUDE.md`: say up front that the git root holds `deno/` and that every `deno` command runs from `deno/`. | triage |

## 3. Keep

- Remove-the-line proofs with the failing state still applied (bump in place, `LINKED_MEMBERS = []`), so the test shows the ticket's exact error. This is already in the run prompt; keep it.
- Check a "fails on main too" claim in a throwaway `git worktree add --detach origin/main`. Also compare it with the CI result before reporting it; that comparison would have avoided the wrong claim. Belongs in `deno/CLAUDE.md`, next to the `deno task check` notes.

## 4. Deferred

- `deno/cli/tests/cli-graphql-smoke.test.ts`, lines 73–104, 134–150 and the header: since #168, `skmtc generate` rewrites `worker.ts` with zero generators. So `FIXTURE_WORKER` and the setup bundle never run, and the comments overstate coverage ("Generated N files"; stdout reads 0 files). Anyone who trusts this test as generator coverage meets it. https://github.com/skmtc/skmtc/pull/217#issuecomment-6271047110
- `deno/cli/tests/cli-graphql-smoke.test.ts` `LINKED_MEMBERS`: it links only `core` and `worker`. If worker gains another `@skmtc` dependency, the next unpublished release branch resolves it from JSR. Proposed fix: link every root `workspace` member. From the self-review.
- The same file's header says the project is built "in a temp dir" and that there is "one bundle build per test run". It is built under `cli/tests/.fixtures/`, and each test builds its own bundle. It predates this change and was left out of scope.
- Coveralls reported -0.006% (86.969%) on PR #217. It does not gate merges, and the cause, which may be the CLI subprocess path changing now that the fixture has a `deno.json`, was not traced. From `check`.
- `deno/.scripts/api-surface.json`: core is still at 0.29 with a 0.30-sized surface, and the gate's result differs between this machine and CI. The #212 release owner meets it at the bump and re-record.
