# Retro: #285 + #286 — bad `servers` entries become issues; the method appears once in operation and webhook issue locations

Run `2026-10-31-cj981e` of `implement-ticket-dg`. PR https://github.com/skmtc/skmtc/pull/289, merged as 06b31c2a.

## 1. Summary

#285 asked for each `servers` entry to be traced by its index and parsed through `tryParseAt`, so that a bad entry becomes one issue and the rest of the document still parses. #286, folded in, asked that the six operation and webhook catches stop writing the method twice in issue locations. Both are delivered in all three parser trees and released as core 0.32.3. CI on main is green, and both tickets are closed. The run took 47m 57s and an estimated $8.24: 18.6k input tokens, 16.0M cached and 84.9k output. `implement` cost the most (15m 54s, $3.85). That was worth it, because its self-review caught a regression in Link servers before the reviewer saw the code. `review_standard` ($2.37) raised one should-fix, which cost one address round and one check (12.5m, $0.69). A clash between two releases cost a `merge_main` step (5m, $0.38).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| #287 (#194) and this PR both bumped core from 0.32.1 to 0.32.2, and merging main gave no conflict. The merge step saw the clash and refused to merge. Merged as it was, Publish would have found 0.32.2 already on JSR, so these fixes would have shipped as nothing. No check failed. | merge refusal + `merge_main` (~6m, $0.74) | check | CI job: when a package's source differs from main, its `deno.json` version must differ from main's and must not be on JSR yet. | [#293](https://github.com/skmtc/skmtc/issues/293) |
| The Context listed the callers of `toOptionalServersV3` but not those of `toServerV3`. Link Objects also call `toServerV3`, so my first url guard there broke every response whose link had a bad server. My self-review caught it. | ~5m, 1 fix commit | ticket | `orbital-ticket-prep` skill: list the callers of every function the proposed fix edits, not only the entry point. | triage |
| "Use the type `tryParseAt` already records" has no single meaning: `tryParseAt` records whatever type it is given. I read it as the path-item `servers` precedent (`INVALID_OPERATION`), and the reviewer had to confirm that. | ~3m + one reviewer judgement | ticket | `orbital-ticket-prep` skill: name the literal value for any decided enum or type, such as `'INVALID_OPERATION'`. | triage |
| I added a `servers` case to `INVALID_OPERATION` in `error-codes.md`. The remediation under it still covered operations only, and the reviewer flagged that as should-fix. | 1 review round (address 4.5m + check 8m, $0.69) | review-rule | Implement prompt, self-review list: when you add a case to a reference entry, check that its Remediation and Example fit the new case. | triage |
| The worktree root `.../Wji4Gx6PGI/deno` is the repo root and holds a `deno/` subfolder. I hit 4 failed commands, and `follow_on` hit 4 more. The #189 retro recorded the same thing. | ~8 commands across 2 steps | navigation | Orbital worktree naming: don't name the folder after a top-level folder of the repo, or state the repo root in the step prompt. | triage (recurring, see #189 retro) |
| During a remove-the-line check, I restored a file with `git checkout --`. That threw away my uncommitted guard move in v3-2, and I had to apply it again. | ~2m | workflow | `implement` prompt, mutation check: make a WIP commit (or copy the file to /tmp) before the change, and restore from it. Never use `git checkout`. | triage |

## 3. Keep

- Reproduce the ticket's exact failing inputs as tests before fixing; all four `servers` shapes crashed as described. This is already in the implement prompt.
- Remove-the-line checks showed that a "not an object" guard could never fail a test, so it was dropped. Keep this in the implement prompt.
- When a merged branch's versions equal main's, rerun `deno task bump`. Write this into `deno/CLAUDE.md` "Releasing" next to the cascade caveat.

## 4. Deferred

- `deno/core/parse/v3-*/server/toServerV3.ts` `toServersV3`: a `servers` value that is not an array (e.g. `servers: 'https://x'`) makes `flatMap` throw. At document level the parse fails, and under an operation or webhook that item is dropped. Anyone with a hand-written document meets it. Source: https://github.com/skmtc/skmtc/pull/289#issuecomment-6544099075
- `deno/core/parse/v3-*/link/toLinksV3.ts:66`: a Link Object `server` is never checked. `null` drops the operation, and an object url is kept with no issue. Anyone who generates from documents whose links carry servers meets it. Source: same comment.
- `deno/core/parse/**`: other `logIssue({ key, stackTrail: st })` calls made inside `trace(key, …)` with the same key were not searched for; #286 suggested a grep. Such calls write their key twice in the issue location. Source: #286 Proposal.
- `toServersV3`: the error message holds the full `JSON.stringify(server)` of the bad entry, with no size limit, so a large entry bloats the manifest. Self-review dismissed it.
- Not done: a full `toArtifacts` or CLI run on the catalog documents named in #285. Only Parse-level output was shown (`follow_on` agreed).
