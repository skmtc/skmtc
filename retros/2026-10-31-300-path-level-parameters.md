# Retro: #300 path-level parameters drop only affected operations

Run `2026-10-31-si5ua8` of `implement-ticket-dg`, PR #308 (merged as 1cf561be).

## 1. Summary

#300 asked that a malformed path-level `parameters` field (non-array, or an entry with `name`/`in` nested in
`schema`) stop failing the whole run, and drop only the operations it applies to, with an operation-level
override rule, in 3.0, 3.1 and 3.2, for paths and webhooks. That was delivered through a shared `parse/pathParameters.ts`,
plus `EMPTY_PARAMETER` for a `{}`/`null` field and docs in `error-codes.md`. It shipped as core 0.35.2.
The run took 1h 03m (48m agent time, 9m queued), with 20.8k input, 21.7M cached and 115k output tokens, for about $10.61.
`implement` cost the most ($5.87, 18m). That was worth it: there was one review round with one docs finding, no code defects, and green CI.
`check` (13.5m) was second, mostly a release re-bump after another PR took the version.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Core was released twice under this run. At `open_pr`, main had 0.35.0 (#306), so I dropped the release commit, rebased and re-bumped to 0.35.1. At `check`, #307 had taken 0.35.1, so the branch merged main and bumped again to 0.35.2. | ~15 min across open_pr and check, plus a full `deno task check` each time | workflow | `implement-ticket-dg` merge step: rerun `deno task bump` against JSR plus main immediately before the merge, as one step, rather than in author/check prose | [#311](https://github.com/skmtc/skmtc/issues/311) |
| I added a public `StackTrail.toDocumentString`. Only the api-surface check at the end of `deno task check` showed that `mod.ts` re-exports `context/StackTrail.ts` with `export *`, which made it a minor change. I moved it to an internal module. | ~6 min, one extra commit, and a release-commit reshuffle | navigation | `deno/core/context/CLAUDE.md`: note that `mod.ts` `export *`s whole files such as StackTrail.ts, so new exports there are public API; put helpers in a non-exported module | triage |
| oxfmt is not part of `deno task check`. Seven changed files were unformatted, and I found that only by running `npx oxfmt --check` by hand after the check had passed. | ~3 min, one extra commit, and the release commit rebuilt | check | Wire `oxfmt --check` into `deno task check` and CI | [#69](https://github.com/skmtc/skmtc/issues/69) |
| The "release commit last" rule meant three `git reset --mixed HEAD~1` reshuffles: one for the api-surface fix, one for formatting, one for the lockfile amend. | ~4 min | steering | Goal text: allow the release bump to be re-run at the end (drop and redo) instead of being kept last by hand; or do the bump in a workflow step after implement | triage |
| The worktree root directory is itself named `deno` and holds a `deno/` workspace (path `…/90ItAqxgx7/deno/deno/core`). My first `cd ..` left the repo, and `follow_on` lost ~2 min the same way. | ~3 min across two steps | workflow | Orbital `create_worktree`: name the worktree directory after the run id or repo, not the project key `deno` | triage |
| The reviewer caught that `error-codes.md` said any non-list `parameters` field drops operations, which is false for `{}`/`null`. My self-review read the docs against the code but missed the carve-out. | 1 review round (~6 min address) | review-rule | None needed: the reviewer's docs-vs-code reading caught it; keep that rule | none — reviewer caught it |
| The squash-merge title says "core 0.35.1", but 0.35.2 shipped, because the PR title was not updated after the re-bump. | cosmetic | workflow | `implement-ticket-dg` check/merge step: when a re-bump changes the version, update the PR title before squash-merging | triage |

## 3. Keep

- Table-driven tests across the three trees with a real `ParseContext`, plus single-line mutation checks per rule. They caught a real bug (a non-array field treated as overridable) before the first commit. This is already in the implement prompt.
- Reproducing "before" by checking out main's `parse/` over a WIP commit and running the new `toArtifacts` test. Write this down in `deno/core/CLAUDE.md` as the way to show a whole-run failure.

## 4. Deferred

- `deno/core/parse/pathParameters.ts` `toApplyingBrokenParameter`: override matching is case-sensitive, so a broken `X-Request-Id` header that an operation overrides as `x-request-id` still drops the operation. Authors of documents with header-name case drift would meet it. Raised in my self-review; the reviewer judged it out of scope.
- `pathParameters.ts` `isDroppedByPathParameter`: with several broken entries, the `INVALID_OPERATION` message names only the first. Every user reading the manifest would see it; each entry still has its own `INVALID_PARAMETER`.
- `pathParameters.ts` `toParameterEntries`: `''`, `0` and `false` now drop operations, where before they were read silently as no parameters. This follows the ticket Amendment; it is noted as a behavior change.
- The live catalog documents named in the ticket (steinbeck-lab/coconut, voluntarily/voluntarily-api, isthereanydeal/augmented-steam-server) were not fetched or run; fixture-shaped tests stand in for them (`follow_on` summary).
- Squash commit 1cf561be on main is titled "core 0.35.1", but 0.35.2 shipped (`follow_on` summary).
- Review dropped candidates (style only): the `readEntries` union shape in `pathParameters.ts`, and the six near-identical call-site blocks in `toOperationsV3`/`toWebhooksV3` (PR #308 review summary).
