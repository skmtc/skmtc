# Retro: #422 return core's log lines at INFO and above from /artifacts

## 1. Summary

#422 asked `@skmtc/server` to return core's log lines at `INFO` and above in `POST /artifacts` `logs`, with the parse phase's warnings, and to release through the cascade. It is delivered in three releases, all on JSR: PR #423 (server 0.3.41, core 0.47.3), then follow-up PR #424 (core 0.47.4, server 0.3.42). The follow-on step checked the published server against two real schemas and saw the lines; it deployed no stack and did not view the hub.
The run took 1h 11m, with 63,939 input, 24.1M cached and 103,401 output tokens, an estimated $11.74 before forked sub-agents and this turn.
The most costly step was implement ($3.24, 10m 21s), and it was worth it. One review round (review $2.36, then address $1.43 and check $0.55) moved the fix into core. After the merge, the follow-up PR cost about $3 more (fix_pr, review_fix_high, a second follow_on).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The docs I wrote in address say every `error` issue reaches `logs`, but `ParseContext.#logDependencyIssue` called `#addIssue` and logged nothing. I fixed `logIssueAt` and did not search for the other paths that record a parse issue. follow_on caught it, which cost a second PR. | about 18m, about $3 (fix_pr, review_fix_high, follow_on visit 2, watch_ci visit 2) | check | `core/context/ParseContext.test.ts`: a test that parses a corpus schema with `silent: false` and asserts that each `error` and `warning` issue in `parseIssues` has exactly one log line. | triage |
| Self-review found that `debug` parse issues arrive as `WARN` lines. I listed it as "proposed, not built", although the ticket's "Not in this ticket" says to keep `DEBUG` lines out. The reviewer made it should-fix. | one review round: address 8m 44s and check 7m 37s, about $2 | ticket | orbital-ticket-prep: a rule the change must keep goes under "Done when", not under "Not in this ticket". | triage |
| open_pr's push outlasted the three-minute wait, because the pre-push hook ran `deno task check` (about 3m) on a tree that had just passed it. I waited past the limit. The same happened in address. | about 3m each in open_pr (5m 24s) and address | workflow | orbital-workflows#84: set the push wait above the time of the repository's pre-push gate. | [orbital-workflows#84](https://github.com/dmitrigrabov/orbital-workflows/issues/84) |
| Test Coverage on `main` failed at 2ef8026a in three CLI terminal-UI tests on Windows. The same tree had passed on the PR. ci_triage named the known flake. | watch_ci visit 2 and ci_triage, about 8m | check | skmtc#385: wait for the frame in the terminal-UI tests, not a fixed delay. | [skmtc#385](https://github.com/skmtc/skmtc/issues/385) |
| `silent`'s meaning (parse issues are logged only when it is `false`) took four reads of `CoreContext` and `ParseContext`. `to-artifacts.md` says that `silent` "suppresses log output". | about 6 calls in implement | navigation | `docs/reference/api/to-artifacts.md` `silent`: say that it controls only the logging of parse issues. Also the deferred item below. | triage |
| The worktree root is named `deno` and holds `deno/`, so the working directory moved between the two levels. This happened again in follow_on. | about 3 calls | tool-cost | Orbital: name a worktree directory after the run, not after the project folder. #409's retro asks the same. | triage |

## 3. Keep

- Make each line wrong in turn and see its test fail. This showed that the tests are real, in implement, address and fix_pr. It is already in the implement prompt.
- Post a real large schema (`openai-openapi.yml`) to the published server and count lines by level against `parseIssues`. This found the gap that the unit tests missed. Write it in orbital-ticket-prep for tickets that change logging.

## 4. Deferred

- `core/context/ParseContext.ts` `logIssueAt`: each parse line's `message` holds the whole issue as JSON, with the stringified `parent`. On a large API this makes the `/artifacts` reply large (about 225 kB for openai) and gives long lines on the hub's Logs tab. [Deferred findings](https://github.com/skmtc/skmtc/pull/423#issuecomment-7200540145).
- `docs/reference/api/to-artifacts.md:140` and the `@param args.silent` JSDoc in `CoreContext.ts`: they say that `silent` suppresses log output, but it only controls whether parse issues are logged. A direct caller of `toArtifacts` who sets `silent: true` still gets console output and loses the parse lines. Same comment.
- A parse line's `message` looks like JSON but holds unescaped quotes (seen in a dependency-error line near `"anyOf" array is empty`), so `JSON.parse` fails on it. A hub or client that parses the message meets it. Seen by follow_on after #424.
- `@skmtc/server` console: with `silent: false` it prints every parse issue, hundreds of lines on a large schema. Stack operators who read the server's stdout meet it. Seen by follow_on.
- `ParseContext.#logDependencyIssue` comment (#424): it says that `logIssueAt` picks the issue's protocol shape, but the `switch` beside it still does that. This is a nit from the #424 review.
- Parse `error` issues now arrive as `ERROR` lines in the CLI's `logs.ndjson`. `manifest-format.md` describes that file as "one `ERROR` line for each item that failed". The sentence still holds, but a reader may count parse errors as failed items.
