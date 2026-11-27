# Retro: #444 generate counts GPT tokens only with --count-tokens

## 1. Summary

#444 asked that `skmtc generate` count GPT tokens only with a new `--count-tokens` flag. Without the flag, `gpt-tokenizer` must not load, the success line must not name tokens, and `--json` `stats` must have no `tokens` key. `dev` must follow the same rule, the docs must change, and the release is a cli minor. It was delivered as cli 0.13.0 and plugin 0.1.78 (PR #481, squash `7635974c`). follow_on checked the published package: the default run does not load the tokenizer, and it is about 100 ms faster than 0.12.8 (972 ms against 1.076 s).

The run took 2h 23m (1h 25m of agent time), with 22.7k input, 39.4M cached and 131k output tokens, for about $17.07. implement cost the most ($6.13, 17m), and it was worth it: the self-review found that the Ink view dropped the flag, and the mutation checks proved each test. check took the most time (1h 40m, $5.74). Most of that time went to four merges of main and four re-bumps, and to the Windows defect. Finding the Windows defect was worth the time, but the re-bumps were not.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Main moved four times during check (among them core 0.55.0 and 0.56.0). Each move needed a merge, two of them with hand-resolved conflicts (the smoke test, `GenerateView.tsx`), then a new `bump cli --minor` and `bump-plugin`, and a new full check. | most of check's 1h 40m wall / 50m agent | workflow | orbital-workflows#105: do the re-bump against main as one named step just before the merge, not after every move of main. | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| On Windows, `cli/lib/tokenizer-load.test.ts` gave `deno info` a filesystem path as the root. `deno info` reported that root as having no dependencies, so the five "tokenizer not loaded" checks passed with nothing checked. Only the positive control failed in tests-windows. Neither the author nor the reviewer saw this. | 4 fix commits in check, plus CI rounds | review-rule | Reviewer rules: a test that asserts something is absent must also assert that it saw something (a non-empty graph, at least one match). Otherwise it can pass with nothing checked. | triage |
| The delivery lead's message asked for a plain `bump cli`, which gave 0.12.9. The ticket asks for `--minor`, and the skill's describes '0.13' needs it, so check restored `deno.json` and bumped again. | ~3m in check | steering | orbital-delivery-lead skill: a message about a re-bump quotes the bump command from the ticket's Release line, not a shortened form. | triage |
| The reviewer found that no test covered `mod.ts` passing `countTokens` to `generateSwitch`, which the done-when needs ("A test runs it with `--count-tokens`"). The author's tests started at `generateSwitch`. | 1 review round (~6m address, $0.77) | navigation | `deno/cli/CLAUDE.md` (or the ticket Context): a CLI flag's end-to-end test goes in `cli/tests/cli-graphql-smoke.test.ts`, which runs the real `mod.ts`. | triage |
| A first `generate.ts` test used an absolute artifact key, so `generate` wrote files under `deno/var/` in the worktree. Nothing failed. The author saw it in `git status`. | ~2m in implement | check | `deno task check-work`: fail when a test run leaves untracked files outside `.fixtures/` and temp directories. | none: one-off, caught locally |
| follow_on ran git one directory above the worktree root (the root is the directory named `deno`). It also tried to parse benchmark `--json` stdout that starts with 5.9 KB of engine log lines (that project pins core 0.54.0, which is older than the #472 fix). | 3 wasted calls | information | follow_on prompt: name the worktree root path, and say that projects pinned to core below 0.55.1 print log lines before the `--json` output. | none: covered by #472 |

## 3. Keep

- A mutation check for every done-when test: put the bug back, see the test fail, restore the code. It found the Windows-blind guard only after CI, but it proved every other test. It is already in the implement prompt.
- Measuring the published package in follow_on with hyperfine, before and after, on a real benchmark project. Put "measure the claim the ticket makes" into the follow_on prompt for performance tickets.
- Merging main with no rebase or force-push, and re-running the bump task each time instead of editing versions by hand. Already in the workflow.

## 4. Deferred

- `deno/cli/commands/generate-switch.ts:77`: a headless `generate --watch` with a resolvable source runs once and exits, because `toGenerateLocalArgs` ignores `watch`. A CI or non-TTY user who passes `--watch` meets it. This bug was there before the PR. Source: https://github.com/skmtc/skmtc/pull/481#issuecomment-7226462795
- `deno/cli/lib/to-generate-message-string.ts` and `deno/cli/commands/generate.tsx` `toGenerateMessage`: the success line format is in two places. A change to one of them that misses the other makes the headless and TTY lines differ. This was there before the PR, and the self-review left it.
- `deno/cli/commands/generate.test.tsx:57`: an `element.props as {...}` cast, which this PR widened by one field. A reviewer of the test file meets it. Source: the PR's "Nits (optional)" comment.
- `deno/cli/lib/tokenizer-load.test.ts`: six `deno info` runs take about 1 s and need a warm cache. Kept as is. A cold-cache CI runner pays more.
- Not checked live: `dev` and the TTY Ink view with `--count-tokens`, which only tests and code review cover. Also not checked: larger documents (Microsoft Graph) and whether skmtc-hub shows a token count, which the ticket puts out of scope.
- oxfmt is not installed in Orbital worktrees, so the changed files were not formatted with it. Already https://github.com/skmtc/skmtc/issues/218.
