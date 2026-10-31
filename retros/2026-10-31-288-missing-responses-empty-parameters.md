# Retro: #288 missing `responses` + #291 empty parameter entries (run 2026-10-31-96al19)

## 1. Summary

#288 asked core to keep an operation or webhook without `responses` (read as `{}`, warn `MISSING_RESPONSES`). #291, folded in mid-run, asked core to skip `{}`/`null` parameter entries with an `EMPTY_PARAMETER` warning. Both shipped in PR #296 (squash `2580fdad`) with a minor release, core 0.33.0, in all three parser trees. Tests cover every "done when" item, each with a mutation proof. Review was clean (2 optional nits), CI on main is green, and both tickets are closed.
Run: 28m 23s wall clock, 24m 17s agent time. Tokens: 17.9k input, 20.5M cached, 103k output. Estimated cost: $9.79.
The costliest step was `implement` ($6.27, 15m 47s). It carried two tickets, a rebase over #289 and a release, so the cost was worth it. `review_standard` ($2.64) re-ran a reproduction the author had already done (see Findings).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Self-review flagged a dangling `$ref` to a skipped empty `components.parameters` entry. The author built a fix (`registerRefError`), found it did nothing, then proved on main in a scratch worktree that parameter `$ref`s were never pruned. The reviewer then reproduced the same thing again in all three versions. | ~6 min author, a share of review's $2.64 | review-rule | In the reviewer's rules, a finding that the author dismissed with a reproduction on main is re-checked by reading that reproduction, not by re-running it, unless the diff contradicts it. | triage |
| Mutation proofs were done by hand, as in the #191 retro. A `git stash push -- parse/` meant to restore pre-#291 code only restored commit 2, so the probe proved nothing and had to be redone in a temporary worktree at main. | ~4 min, about 15 tool calls | tool-cost | Same change as the #191 retro: `deno/.scripts/mutate.ts` (apply, run, report, always restore), plus a "baseline on main" mode that runs a test file against `origin/main` in a temporary worktree. | triage |
| `mockParseContext` drops every logged issue, and a spread copy of it fails to type-check as `ParseContextType`. Asserting issue locations meant switching to a real `new ParseContext({...silent:true})` after a type error. | ~3 min | navigation | In the `test/mockParseContext.ts` JSDoc: "to assert logged issues and locations, use a real `ParseContext` and read `context.issues` (see `parse/missingResponses.test.ts`)". | triage |
| The first `toArtifacts` test for `/mi` read `operation.toParametersObject()`, which holds only operation-level parameters; path-level ones stay on `operation.pathItem.parameters`. | ~2 min | navigation | One line in `core/parse/README.md` or on `OasOperation.toParams`: path-item parameters are not merged into the operation. | triage |
| The orbital worktree root is itself named `deno` with the package dir `deno/deno`, so the first `cat core/...` commands failed. | ~1 min | navigation | `create_worktree` in orbital-workflows: name the checkout after the run id, not the repo-relative `deno`, or state the package path in the implement prompt. | triage |
| The STE hook flagged the markdown anchor `#missing_responses--warning` as an `-ing` word and kept reporting it after each edit. | <1 min, repeated hook noise | check | `ste-check.mjs`: skip link targets (`](#...)`) and inline code. | triage |

## 3. Keep

- Folding a sibling ticket mid-run as its own commit, with one shared release commit, avoided a second core minor and a second release race. The orbital-delivery-lead skill should name this as the pattern for tickets that touch the same issue-type files.
- Shared per-rule helpers in `core/parse/` (`toPresentResponses.ts`, `emptyParameter.ts`) instead of three copies per tree, tested by one table-driven file across v3-0/1/2, kept the trees from drifting. This belongs in `core/parse/README.md`.
- Assert issue type and message, not location, where a concurrent PR moves locations: #289 landed mid-run and these tests held.

## 4. Deferred

- `core/parse/v3-{0,1,2}/parameter/toParameterV3.ts` `toParameterListV3`: a non-empty invalid path-level parameter still throws to the top level and drops the whole run (3.0/3.1). Anyone with a malformed path parameter meets it. #291 defers it to the general parse-boundary work.
- Parameter `$ref`s are not registered as ref consumers, so a `$ref` to a dropped or skipped `components.parameters` entry is never pruned. It fails at generate time with `Ref "..." not found`, limited to that artifact. Same on main. Source: the self-review on PR #296.
- `deno/core/parse/emptyParameter.ts:9` could reuse `helpers/isEmpty.ts`. Reviewer nit: https://github.com/skmtc/skmtc/pull/296#issuecomment-6544505161
- `deno/docs/reference/error-codes.md`: `EMPTY_PARAMETER` sits in the `MISSING_*_TYPE` group rather than next to `INVALID_PARAMETER`. Reviewer nit, same comment.
- `deno/core/parse/README.md` and `deno/docs/skills/skmtc-debug/SKILL.md` "Issue types you'll see" do not list `MISSING_RESPONSES` or `EMPTY_PARAMETER`. An agent diagnosing a manifest meets the gap.
- `MISSING_RESPONSES` fires on valid 3.1/3.2 documents (decided by the delivery lead), and its message says "Operation" for webhooks too. Users of large 3.1 webhook-only specs see one warning per webhook.
