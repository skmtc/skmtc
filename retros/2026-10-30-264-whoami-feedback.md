# Retro: #264 `skmtc whoami` and the publish target, with #260 `skmtc feedback` (run 2026-10-30-in3h0j)

## 1. Summary

#264 asked for `skmtc whoami` and for `api publish` to name its origin and env on every result. #260 asked for `skmtc feedback` on `POST /v1/feedback`. Both shipped in PR #266, merged as 7f19f428 and released as CLI 0.10.6; CI on main is green. The run took 57m 26s, with 52m of agent time. It used 22,396 input tokens, 32.7M cached tokens and 152,962 output tokens, for an estimated $14.36. The most expensive step was `implement` (31m, $9.31). That was worth it: copying from the hub's generated models gave a correct body the first time, and the self-review fixed five defects before review. Review took one round, with two should-fix comments.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The reviewer found that the `invalid_grant` catch in `commands/whoami.ts` had no test. The author's mutation checks covered each done-when item but not every new branch. | 1 review round: address 6.5m + check 4m, ~$1.7 | check | `deno/.github/workflows` coverage job: fail a PR when its changed lines have uncovered branches (Coveralls already runs; add a diff-coverage threshold) | triage |
| The `toWaitText` doc comment in `lib/feedback-headless.ts` said "90 → 2 minutes"; the code returns "90 seconds". The reviewer caught it. | Same review round | review-rule | Reviewer rules: check that every example in a new doc comment matches the code | triage |
| In `implement`, the author edited `lib/api-publish-headless.ts` with a Python script, against the workflow prompt. This is the second run in a row (see `2026-10-30-258-api-link.md`). | ~2 min plus a manual diff review | steering | Make the workflow author prompt and `~/.claude/CLAUDE.md`'s script exception agree, and say which wins in Orbital runs | triage |
| `git push` in `address` passed the 120 s Bash limit and moved to the background. The pre-push hook runs the full `deno task check` (~2.5 min) right after the author had run the same check by hand. | ~4 min and one duplicate full test run | workflow | implement-ticket-dg `open_pr`/`address` prompts: say the skmtc pre-push hook runs `deno task check`, so skip the manual run before a push and give the push a 5-minute limit | triage |
| #264's Context said `ApiPublishFailure` gets `origin` and `env`, but the OIDC steps in `lib/github-oidc.ts` also return that type and do not know the env. The author put the fields on a new `ApiPublishFailed` variant instead. | ~3 min | ticket | `orbital-ticket-prep` skill: when the ticket names a type to extend, list that type's other producers | triage |
| A subprocess test meant to prove `whoami` skips the JSR registry check failed: `JSR_URL` also redirects Deno's own module loading. `COMMANDS_THAT_SKIP_REGISTRY_CHECK` has no test seam. | ~3 min; the skip stays untested | check | `deno/cli/mod.ts`: move `shouldSkipRegistryCheck` and its Set to a lib module and unit-test each hub command's entry | triage |
| Running oxfmt on the changed files took three tries. In zsh, `$F` is not word-split, and `deno fmt --check` (the wrong formatter) printed 12 false failures. | ~2 min | navigation | `deno/CLAUDE.md`: name `npx oxfmt <files>` from the repository root as the formatter, and replace the stale `deno fmt` line under "Key Commands" | triage |
| In `follow_on`, a throwaway HOME made Deno re-download every dependency, which truncated the first output. | ~1 min | information | implement-ticket-dg `follow_on` prompt: keep `DENO_DIR` pointing at the existing cache when you change HOME | triage |

## 3. Keep

- Copy request and response shapes from the hub's generated model files at a pinned commit (`gh api .../contents/...?ref=`), as #264's Context told us to. Already in `orbital-ticket-prep`; it worked.
- Break each guarded line on purpose, see its named test fail, then restore it, and list the pairs in the summary. The reviewer relied on that list. It belongs in the author prompt's self-review questions (it is already there; keep it).
- Split one resolution rule into a no-side-effect "target" and a full "auth" call (`resolveHubTarget`/`resolveHubAuth`), not a second copy. Worth naming in `deno/cli/CLAUDE.md` under Authentication.

## 4. Deferred

- `deno/cli/lib/hub-token.ts` `validateHubToken`: no fetch timeout. `whoami` and `login`'s status check hang forever on a hub that accepts the connection and never answers ([PR comment](https://github.com/skmtc/skmtc/pull/266#issuecomment-6533711418); author proposal 1).
- `deno/cli/commands/whoami.ts` and `login.tsx`: failures under `--json` print plain text, but `reference/cli/overview.md` says errors are JSON. An agent parsing stdout meets this on every 401 or no-token case (same comment).
- `deno/cli/lib/feedback-headless.ts` `FeedbackFailure`: no `origin`/`env`, unlike publish failures. A user with a leftover local login cannot tell where a possibly-filed issue went (author proposal 2).
- `readApiError`, `errorMessage`, `rethrowTimeout`, `toSentence` and `ApiErrorDetail` live in `lib/api-publish-headless.ts`, so feedback, link and `print-hub-failure.ts` depend on the publish module. A publish refactor risks breaking them (author proposal 3).
- `COMMANDS_THAT_SKIP_REGISTRY_CHECK` entries for `whoami` and `feedback` are untested. A removed entry would make both commands fail offline (author).
- `deno/docs/skills/skmtc-cli/SKILL.md`: the feedback line says "with the user's agreement". The author added that policy; the ticket did not ask for it (author).
- Not verified live: a real `feedback` request (it files a public GitHub issue) and the 429/502/503 answers. `follow_on` checked only `whoami` and the `--kind` validation against staging.
- The missing-token recipe and the rejection message link different settings pages (`skmtc.dev` vs `skmtc.net`) for the same command. This is probably right per environment but unconfirmed (`follow_on`).
- The hub's "Publish from CI" page still has to say that `api publish` names its origin. That is a separate skmtc-hub change (ticket).
