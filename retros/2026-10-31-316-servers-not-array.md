# Retro: #316 a `servers` field that is not an array

Run `2026-10-31-wp1qs3` of `implement-ticket-dg`, PR #317 (merged as 4cb8f553).

## 1. Summary

#316 asked that a `servers` field that is an object or a string stop failing the whole run with
`servers.flatMap is not a function`, in the 3.0, 3.1 and 3.2 trees. Delivered: one guard in `toServersV3`
(one `INVALID_OPERATION` at `…:servers`, read as no servers), tests in each tree, a `toArtifacts` case,
docs, core 0.36.1. Review found 0 defects. The run took 30m 42s (26m 28s agent time), with 19.6k input,
6.3M cached and 33.5k output tokens, for about $3.08. `implement` cost the most ($0.90, 7m), and was
worth it. The avoidable cost was the main-moved conflict: `merge_main` plus a second `check` and `merge` visit, about 14 minutes.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Another core PR (#313, core 0.36.0) landed after the PR opened; the squash was refused as CONFLICTING on every `deno.json` and `deno.lock` version line, so `merge_main` plus a second `check`/`merge` pass ran. | ~14 min, ~$0.5 | workflow | In `implement-ticket-dg`, make the step before `merge` merge the default branch and rerun `deno task bump core` when main has moved, so the reviewer never meets the version conflict. | triage |
| The ticket's Context said `toServersV3` was unguarded, but path-item `servers` already sat in a `tryParseAt` boundary; the existing `toPathItemV3` tests expected `undefined`, and three failed only at the final `deno task check`. | ~3 min, one extra check run (~2 min) | ticket | Ticket-prep skill: when naming a function to guard, grep its callers for existing boundaries and list the tests that pin current output. | triage |
| Paths in the ticket (`deno/core/...`) and the worktree layout (`<worktree>/deno/deno/core`) disagree; several calls failed or ran in the wrong directory, and `follow_on` also lost a call. | ~4 calls | navigation | Add the real worktree path layout (git root is `<worktree>/deno`, core at `deno/core` below it) to the ticket template's Commands block or the repo's `CLAUDE.md`. | triage |
| The prompt required `/review high`, but the ticket set review `light`; I skipped it and recorded that. The `light_check` step then did the mutation checks. | none seen | steering | Make the `implement` prompt say "run `/review high` unless review_depth is light", so the two instructions stop conflicting. | triage |
| The STE hook caught a 7-sentence paragraph in `error-codes.md` right after the edit. | 1 edit | check | None; the check worked. | none (already caught) |

## 3. Keep

- The per-tree mutation check (switch the guard off, see 7 failures per tree): both author and `light_check` did it. It belongs in the reviewer rules for one-guard-in-N-copies tickets.
- The STE hook firing on edit; it caught the prose problem before commit.
- `git show --remerge-diff` to review a merge's conflict resolutions (used by `check`).

## 4. Deferred

- `deno/core/parse/v3-{0,1,2}/server/toServerV3.ts`: the webhook `servers` position has no test of its own; same function, so low risk. Source: `light_check` summary.
- Same files: the real `internetstandards/override-this-value-in-internetnl-batch-api-doc-conf-py` fixture file was never run; the `toArtifacts` test uses its shape. Anyone adding the fixture to a corpus run would meet it.
- Same files: `''` and `0` for `servers` now record an issue where they were skipped silently. This is a deliberate edge, not covered by the ticket's decided points; the delivery lead may want to confirm it.

No issues opened or commented on: nothing here stopped a step or cost over 15 minutes beyond the merge conflict, which is marked `triage`.
