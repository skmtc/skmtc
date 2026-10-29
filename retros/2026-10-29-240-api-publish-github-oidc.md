# Retro: #240 `skmtc api publish` signs in with GitHub Actions OIDC

## 1. Summary

#240 asked for a GitHub Actions OIDC token source for `skmtc api publish`, tried after `--token`, `$SKMTC_HUB_TOKEN` and the `skmtc login` store. The CLI exchanges the job's OIDC token at the hub for a linked repository token and publishes with it. Delivered in PR #247 (squash `37f258b9`, CLI 0.10.0), and CI on main is green. One review round with two should-fix comments. Run `2026-10-29-2ysra8`: 46m 17s, 22,934 input / 21.45M cached / 144,507 output tokens, est. $11.76. The review step cost the most ($4.87, 12m), and it was worth it: it found the one real defect, `--origin-url` refused by the hub under a linked repository token, which the ticket's contract summary left out. Implement came next ($4.52, 13m 38s).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's "hub contract" listed the exchange route and the scope of the issued token. It left out that the revisions handler refuses `originUrl` from a linked repository token, so the CLI spent the single-use OIDC JWT and then failed with 400. Only the reviewer, reading skmtc-hub, caught it. | 1 review round: address 5m 30s + check 6m 22s, ~$1.54 | ticket | `orbital-ticket-prep` skill: when a ticket adds a new token kind, list every `tokenKind` branch in the hub handlers the token reaches, not only the issuing route. | triage |
| `deno task bump cli --minor` failed verify-docs twice in a row: first the skill-currency check (`skmtc-cli` `metadata.describes`), then the plugin-digest check (`deno task bump-plugin`). Neither step is written in the Releasing section. | ~4 min, two extra verify-docs runs | navigation | `deno/CLAUDE.md` "Bump without publishing": add that a minor/major bump of `cli` or `core` means rereading the matching skill, updating `metadata.describes`, then `deno task bump-plugin`. | triage |
| After the address step made `resolveApiPublishAuth` private, the head had a formatting slip (`const resolveApiPublishAuth =async`). `deno task check` and the pre-push hook passed, and the check agent found it by reading. | 1 extra commit (8c295218) | check | Run `oxfmt --check` in CI and in `deno task check`. | [#69](https://github.com/skmtc/skmtc/issues/69) (commented) |
| The ticket's trap said to set `HOME` to a temp folder in tests. In the `env-entry.test.ts` subprocess that moves Deno's cache, so the child re-downloaded every dependency to stderr and the one-line-stderr assertion failed. | ~3 min | check | `deno/cli/lib/env-entry.test.ts` `runCli`: always pass the parent's `DENO_DIR` (`toDenoDir()` now exists in that file), so every subprocess test that sets `HOME` is safe. | triage |
| The author made one edit with a Python heredoc, which the workflow prompt and the user's CLAUDE.md forbid. Caught by self-reading, reverted and redone with Edit. | ~1 min | check | A PreToolUse Bash hook that refuses `python3 -`/`perl -i`/`sed -i` writing under the worktree. | triage |
| The follow_on agent's first test command used the wrong path: the git root is `…/deno` and the package is `deno/cli`. The ticket says this, but the follow_on prompt does not carry the ticket. | ~1 min | workflow | The `implement-ticket-dg` follow_on prompt should pass the package directory (or the ticket's "Commands" block) to the agent. | triage |

## 3. Keep

- Exporting the auth + publish glue (`runApiPublish`) so precedence and secrets are tested in-process with stubbed `fetch`, plus a local `Deno.serve` stand-in for the OIDC provider in subprocess tests. Worth a line in the `skmtc-cli` test conventions, or in `deno/cli/CLAUDE.md`.
- Mutation proofs named per rule (precedence, the `GITHUB_ACTIONS` check, the `--origin-url` refusal). The prompt already asks for them; keep it.

## 4. Deferred

- `deno/cli/lib/github-oidc.ts` and `api-publish-headless.ts`: no timeout on the OIDC, exchange or publish `fetch`. A hung provider holds a CI job until its timeout. Source: https://github.com/skmtc/skmtc/pull/247#issuecomment-6503743499
- `deno/cli/commands/api.ts` `runApiPublish`: auth, including the single-use exchange, runs before `<file>` is read. A path typo in CI spends an exchange and reports an auth error before the file error. Source: same comment.
- `deno/cli/commands/api.ts` `resolveApiPublishAuth`: a stale stored login whose refresh fails throws `DeviceLoginError` before OIDC is tried. Self-hosted runners with an old `~/.skmtc/auth.json` would meet it. Found in self-review, not built (the ticket keeps the `resolveHubAuth` order).
- The `--origin-url` help text (`mod.ts`, `cli-schema.ts`) does not mention that a linked repository token refuses it. Only the reference page does. Someone reading `-h` in CI would meet it.
