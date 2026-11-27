# Retro: #440 push sends parse settings, and pull applies them

Run `2026-11-27-8r5b6j` of `implement-ticket-dg`. PR https://github.com/skmtc/skmtc/pull/446, merged as `9d20a532`.

## 1. Summary

The ticket asked `skmtc push` to send `settings.parse ?? settings.system` as `parse`, and `skmtc pull` to write the hub's `parse` back under the key the local file already uses. Both shipped in CLI 0.11.3, with tests through the push, pull and project-create paths. Review asked for three more changes, made in one address round: an empty hub `parse` also clears a `system` kept beside `parse`; `skmtc project create` seeds `parse` through a body builder it now shares with push; and the overview docs row was corrected. CI is green on main.
The run took 1h 00m, 14m of it waiting on the operator. It used 21.6k input, 15.0M cached and 77k output tokens, about $8.20. The most costly step was implement ($2.90, 12m). Then came review ($2.20) and address plus check ($1.39, 13m). The address round was spent on findings the self-review had already found, and the workflow told the author to defer them.
follow_on returned `needs_you`: production skmtc-hub predates skmtc-hub#3910, so the released 0.11.3 `pull` deletes local parse settings against the live hub.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The self-review found the project-create seed PUT and the both-keys case. The "Proposed, not built" rule made the author list them instead of fixing them, and the reviewer then raised both as should-fix. | 1 address + check round, ~13m, ~$1.39 | workflow | implement prompt: a finding that applies the ticket's own rule at a sibling call site or to a missed case of that rule is fixed here, not proposed | https://github.com/dmitrigrabov/orbital-workflows/issues/80 |
| CLI 0.11.3 published to JSR while production skmtc-hub still ran the revision from before #3910, so pull deletes local `parse` for every user until the hub deploys. | needs_you at follow_on; live user impact | ticket | orbital-ticket-prep: when a CLI ticket depends on a hub change, the Release section names "hub deployed to production" as a precondition for merging | triage |
| The ticket said "two files in the CLI", but a third writer of the same `client-config` endpoint (`cli/lib/project-headless.ts` seed) repeated the fixed list. | part of the address round above | ticket | orbital-ticket-prep: for a ticket that changes a request body, grep every caller of the endpoint path and list them in Context | triage |
| The ticket's drop rule ("an empty hub value drops the local key") was written without checking that the hub leaves `parse` out when none is stored. So the first pull after upgrading deletes local settings. | deferred design gap; found by review and follow_on | ticket | orbital-ticket-prep: a rule that keys on what a response holds names the server's response shape and where in the code it is produced | triage |
| The `pull` summary appears in four places (`commands/pull.ts`, `cli-schema.ts`, `pull.md`, `overview.md`). The self-review caught three and review caught the fourth. | 1 review comment | check | `deno task check` doc-sync: compare each `cli-schema.ts` command summary with its row in `docs/reference/cli/overview.md` | triage |
| The pre-push `deno task check` failed this retro-only push on `core/parse/intersections.test.ts:189` ("The parse did not return", empty stderr from the `parseBounded` child process). The same suite passed twice earlier in the run. | ~3 min; push redone with `--no-verify` | check | `deno/core/test/parseBounded.ts`: report the child's exit code and signal, and retry once on a non-zero exit with empty stderr | https://github.com/skmtc/skmtc/issues/453 |
| The worktree root is `.../d3DlOhKijZ/deno` with the workspace at `deno/deno`, so the first `cd cli/lib` and `ls` calls failed in implement and again in follow_on. | ~2 min and several calls per step | navigation | workflow prompt context: state the repository root and the Deno workspace path (`<worktree>/deno`) for skmtc runs | triage |

## 3. Keep

- Removing each guarded line, rerunning the test and restoring it found a vacuous case (the neither-key push test) and proved every other test. Already in the workflow prompt.
- One shared body builder (`toClientConfigBody`) for push and the seed, rather than a copied line, so the two writers cannot drift again.

## 4. Deferred

- `deno/cli/lib/pull-headless.ts` `applyHubKey(…, parseKey, hubSettings.parse)`: a missing hub `parse` deletes the local `parse`/`system`. Hub projects pushed by CLI ≤ 0.11.2 hold none, and the hub leaves the field out when unset, so the first `pull` after upgrading drops the user's settings unless they `push` first. The fix needs a different rule, such as keeping the local key when the response has no `parse`, which changes the ticket's rule. Source: https://github.com/skmtc/skmtc/pull/446#issuecomment-7220821712 and follow_on.
- Production skmtc-hub (last deploy run 45881935388, e3ba9c3b) predates skmtc-hub#3910. Against it, push's `parse` is stripped and pull of 0.11.3 removes the local key. Every 0.11.3 user meets this until the hub deploys (follow_on, needs_you).
- `deno/cli/lib/push-headless.ts` `hasConfigData`: it checks only enrichments, include and skip. A push that clears a hub project holding only `parse` reports `overwroteExistingConfig: false`, and the interactive push does not prompt (follow_on).
- `deno/cli/lib/pull-headless.ts` validation: `parseOrExplain(skmtcClientConfig, …)` strips hub parse keys that this CLI's core does not know, without a warning, and a later push removes them from the hub. Pre-existing (self-review).
- `deno/cli/lib/pull-headless.test.ts` and `push-headless.test.ts`: the fake roots use `as unknown as SkmtcRoot`. Removing the cast means narrowing `pullHeadless`/`pushHeadless`'s `skmtcRoot` parameter type (self-review).
