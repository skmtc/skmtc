# Retro: #249 api publish timeouts and file-first read

Run `2026-10-30-xo4t6f` of `implement-ticket-dg`, PR [#259](https://github.com/skmtc/skmtc/pull/259), merged as a7ce0439.

## 1. Summary

#249 asked for three things:

- timeouts on the three `api publish` fetches: GitHub OIDC 20 s, the exchange 20 s, the publish 120 s;
- reading `<file>` before any OIDC call or stored-login refresh;
- a bump of `@skmtc/cli` to 0.10.4.

All three were delivered and merged, and CI is green on main. One review round added a fix: a timeout while reading the response body had been reported as a malformed answer. The run took 36m 09s and used 21.0k input, 14.2M cached and 80.3k output tokens, about $7.72. `implement` cost the most ($3.92, 13m 41s). That was worth it: every done-when item came out mutation-proven. `review_standard` ($2.05) was also worth it, because it caught the body-read gap.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's Context said the body reads "sit inside the existing try blocks, so no new catch is needed". But `res.json().catch(() => undefined)` at three sites swallowed the TimeoutError. Self-review found it, but the author parked it as "proposed, not built", and the reviewer required it. | 1 review round: address 5m 46s + check 3m 37s, about $1.07 | ticket | `orbital-ticket-prep` skill: before writing "no new catch is needed", grep the named functions for `.catch(` on the body reads and name each site. | triage |
| The ticket and `deno/CLAUDE.md` ("Format code across workspace: `deno fmt`") both name `deno fmt --check`. It fails on unmodified main files because the repo formats with oxfmt, and `deno task check` runs no format check at all. | about 4 min to diagnose; 1 hand-run `oxfmt` per run | check | Wire `oxfmt --check` into `deno task check` and CI. Change the `deno fmt` lines in `deno/CLAUDE.md` to `pnpm format:check` / oxfmt. | [#69](https://github.com/skmtc/skmtc/issues/69) (commented) |
| Reading the file first broke four subprocess tests in `deno/cli/lib/env-entry.test.ts`. They published a nonexistent `openapi.yaml` and relied on auth running first. Only the full `deno task check` (about 2 min) showed it. | about 4 min, 1 extra commit | navigation | `orbital-ticket-prep`: when a ticket reorders steps in a command, list the subprocess tests that run that command (`grep -rn "'api', 'publish'" deno/cli`) under "Where to work". | triage |
| The self-review rule "behaviour the ticket does not describe → Proposed, not built" led the author to defer a fix the ticket's own decision required ("exchange or publish timeout is `network`"). | the same review round as row 1 | steering | `implement-ticket-dg` implement prompt: add "a finding that makes a ticket's stated failure code or docs sentence false is a done-when contradiction; fix it here". | triage |
| The worktree root holds a nested `deno/deno/cli`. The author and `follow_on` each lost a `cd` to it, even though the ticket's Traps named it. | about 1 min | navigation | Implement prompt: state the package path relative to the worktree root (`deno/cli` under the git root). | none: trap already documented |

## 3. Keep

- Mutation-proving every done-when test (remove the line, see it fail, `git checkout` to restore) after committing first, so the restore is free. This belongs in the `implement-ticket-dg` prompt as a recipe.
- A never-answering fetch stub that rejects at once when there is no `signal`, so a missing timeout fails the test instead of hanging it. It lives in `deno/cli/tests/mocks/never-answering-fetch.mock.ts` and should be pointed to from `orbital-ticket-prep` for timeout tickets.
- Shared test helpers belong in `tests/mocks/`, not exported from a `*.test.ts`. Importing a test file registers its tests twice. Note this in `deno/cli/CLAUDE.md`.

## 4. Deferred

- `deno/cli/lib/api-publish-headless.ts` `readApiError`: if the error body stalls after a non-OK status, the result is `network` and the hub's status and hint are lost. CI users would meet it when the hub sends a 4xx header and then stalls. Source: self-review item (2), [#259](https://github.com/skmtc/skmtc/pull/259).
- `deno/cli/lib/api-publish-headless.ts` `PUBLISH_TIMEOUT_MS`: the 120 s limit has no flag or env override. A large document on a slow runner fails as `network`, and the publish may have landed on the hub anyway. Source: self-review item (3).
- `deno/cli/lib/api-publish-headless.test.ts`: the two `readPublishFile` tests still go through `withFolder` with an unused fetch stub. A reader of those tests may expect a network call. Source: the reviewer's nit, [comment](https://github.com/skmtc/skmtc/pull/259#issuecomment-6527739012).
- `deno/cli/tests/mocks/never-answering-fetch.mock.ts`: no test reaches the mock's already-aborted branch. Only a future test that passes a pre-aborted signal would.
