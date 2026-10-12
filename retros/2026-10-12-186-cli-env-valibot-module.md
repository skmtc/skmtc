# Retro: #186 — CLI reads environment variables through one valibot module

Run `2026-10-12-t6wgad` of `implement-ticket-dg`, 2026-10-12.

## 1. Summary

- **Asked.** One `cli/lib/env.ts` for `JSR_URL`, `SKMTC_API_ORIGIN`, `SKMTC_HUB_TOKEN`, `HOME`, `USERPROFILE` and `DENO_DIR`: empty is unset, malformed URLs are named errors, defaults in the schema, no `Deno.env.get` elsewhere in `deno/cli`.
- **Delivered.** PR #187, squash-merged as `a0363548`. All four done-when items hold; CI on `main` is green.
- **Duration.** 1h 00m wall clock, 36m 13s of agent time, 13m 16s waiting on the operator.
- **Tokens and cost.** 18,987 input, 16.8M cached, 140,567 output; about $9.28. Sub-agent tokens of `/review` are not counted.
- **Costliest step.** `review` (2 visits, $5.07, 16m 53s). It was worth it: it found the uncaught `EnvVariableError` regression in strict-mode commands and the wrong `doctor` status, which my own review had missed or left as "proposed".
- **Rounds.** One review round, three should-fix threads, plus two small fixes by the `check` step.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| I listed "catch `EnvVariableError` in login/push/pull/project" as Proposed, not built. The reviewer showed it was a regression: `pull --json` printed a JSON failure on `main` and an uncaught stack trace after. | One review round: review 16m 53s, address 4m 31s, check 10m 49s | steering | In the implement prompt's "Proposed, not built" rule, add: a new throw that is reachable from existing commands, or a change to what they print, is part of the change. Handle it here. | triage |
| `new URL('..', import.meta.url).pathname` in the new `env-entry.test.ts` built an invalid cwd on Windows; `tests-windows` failed and the `check` step fixed it. | About 5m of the `check` step, plus a CI round | check | Add a deno lint plugin rule in `deno/lint-plugin` that bans `.pathname` on `import.meta.url` URLs (use `fromFileUrl`). | triage |
| The first `doctor` fix put the error into a "Could not reach …" label and kept status `skipped`. That broke the file's two stated rules about not reporting connectivity problems, and the summary stayed `ok`. | Part of the review round | review-rule | Tell the reviewer: when a changed function's header comment states a rule, check each new branch against it. For error-handling changes, also check the exit code and summary status. | triage |
| The `env.ts` header claimed "never at start-up", but `mod.ts` reads `JSR_URL` before any command runs. I did not search for other readers of a whole-codebase claim. | One thread | review-rule | Same reviewer rule: for any "never"/"only" sentence in a touched comment, grep for counterexamples. | triage |
| `oxfmt` is not installed in the worktree, so formatting was checked by hand and never run. | Unverified formatting; no failure | information | Make bootstrap run `pnpm install` at the root so `pnpm format:check` can run. This repo has no `.orbital/bootstrap.sh`; add one. | triage |
| The publish TUI showed the env error under "Missing required publish arguments" with a `--token` example, which points at the wrong fix. The `check` step added an `invalid-environment` stage. | Part of the 10m 49s `check` step | review-rule | Tell the reviewer to read user-facing messages in a new error path for a wrong remedy. | triage |
| Test runs rewrote `deno/deno.lock` twice; I reverted it by hand before committing. | About 2m | check | Add a pre-commit or `deno task check` step that fails when `deno.lock` changes without a `deno.json` change. | triage |
| The run waited 13m 16s on the operator, about a fifth of the wall clock. | 13m | workflow | Not actionable from here. Triage may check whether the operator wait comes from the review hand-off. | none: no evidence |

## 3. Keep

- The ticket's done-when list mapped cleanly to tests (`JSR_URL=""` from every caller, `not-a-url` naming the variable) plus a one-line `grep`. Keep writing greppable done-when items.
- Breaking the code temporarily to see a new test fail caught nothing wrong this time but was cheap. It belongs in the implement prompt, where it already is.
- A `withEnv` test helper that snapshots with `Deno.env.toObject()` met the `grep` rule without a workaround. Mention it in `deno/cli/CLAUDE.md`'s test notes.

## 4. Deferred

- `deno/cli/lib/env.ts:18,20` — `v.url()` accepts scheme-less and non-http values (`localhost:8787`, `ftp://x`); Deno itself panics on `JSR_URL=localhost:4873`. Anyone with a mirror typo'd without a scheme would meet it. Source: https://github.com/skmtc/skmtc/pull/187#issuecomment-6125548313
- `deno/cli/tests/mocks/env.mock.ts` — `withEnv` keys are untyped strings; a typo'd name is silently a different variable. Test authors. Source: https://github.com/skmtc/skmtc/pull/187#issuecomment-6125548635
- `deno/cli/lib/hub-token.ts` — the `--origin` flag is not validated with the same URL rule as `SKMTC_API_ORIGIN`. Hub command users with a bad flag.
- `deno/cli/lib/env.ts` `readHomeDirectory` and `to-root-path.ts` `homedir()` can disagree, on Windows when `HOME` is unset. This already existed. Windows users.
- `deno/cli/components/PublishView.tsx` — the `invalid-environment` stage was type-checked, not run interactively. Anyone running `skmtc publish` in the TUI with a bad origin.
- `deno/cli/lib/doctor-headless.ts` — the follow-on run saw doctor exit 1 with JSON but did not read the check's status or message text. The test asserts them.
- `deno/cli` — 76 `deno lint` findings already present (for example `require-await`). Contributors running `deno lint`.
- `agent-context` — `jsrUrl` lost its trailing slash and now throws on a bad `JSR_URL`. Intended, from the ticket. Scripts that concatenate onto `jsrUrl` would meet it.

No issue was opened or commented on: no finding stopped a step or cost more than 15 minutes, and no open issue matches (only #183, unrelated).
