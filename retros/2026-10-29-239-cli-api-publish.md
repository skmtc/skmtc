# Retro: skmtc api publish (#239)

## 1. Summary

The ticket asked for a standalone `skmtc api publish <file> --api @account/slug`. With `--visibility` it uses the create route; without it, it adds a revision. It needed per-failure codes, docs and a version bump.
It was delivered in PR #241, squash-merged as a56d0879, and CI on main is green.
Run `2026-10-29-rkq1tw`: 36m 36s wall clock, 31m 42s agent time. It used 20,467 input, 18.2M cached and 101,746 output tokens, an estimated $9.84.
The most costly step was implement (13m 50s, $5.24), then review_standard ($3.03). Implement was worth its cost: the ticket's Context named every file, pattern and trap, so the work needed no exploration loops.
There was one review round with two should-fix comments, both doc or help-text truth. Neither was a code defect in the request path.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The `--origin-url` help in `cli/mod.ts` and the `api publish` descriptor in `cli/lib/cli-schema.ts` claimed the hub records the URL on both routes, which contradicts `api.md`. The reviewer caught it, not self-review. This repeats retro 171: help text is hand-copied in two places. | 1 review round (address 5m + check 3.6m, ~$0.84) | check | In `cli/mod.ts`, take each `.option()` description from `getCommandDescriptor(...).flags`, so the descriptor is the one source; a cli-schema test then fails on drift. | triage |
| `docs/reference/cli/api.md` said "`status`, `requestId` and `details` are there when the hub answered", but three return paths in `api-publish-headless.ts` broke that. | same round | review-rule | Reviewer rule: for each reference-page sentence about when an optional JSON field is present, check every return path of the result union. | triage |
| The test "reads `<file>` against the cwd, not a `.skmtc` ancestor" passed even after `toAbsoluteRootPath` was swapped in. `toRootPath` walks up only inside `homedir()`, and macOS temp dirs resolve via `/private`. | ~4 min, 3 test runs | navigation | Doc comment on `toRootPath` in `cli/lib/to-root-path.ts`: the walk only runs under `homedir()`; tests must set HOME to a `realPath` temp root. | triage |
| `pnpm format:check`, the ticket's pre-PR command, fails on main on ~72 files that have nothing to do with the change, `cli/deno.json` among them. So it cannot gate a PR, and each run has to check by hand which failures are its own. | ~2 min per run, recurring | check | Format main once and add the oxfmt check job to CI. | [#69](https://github.com/skmtc/skmtc/issues/69) (commented) |
| The worktree root is `.../deh-YvghLV/deno`, and the repo's `deno/` folder sits inside it. The first commands in implement and follow_on used the wrong path. | ~1 min each, 2 steps | workflow | In orbital-workflows `implement-ticket-dg`, name the worktree folder after the run (not the repo), or state that ticket paths are relative to the git toplevel. | none: under 15 minutes |

## 3. Keep

- Mutation checks on each guard (remove the line, see a named test fail) found the test that could not fail. This is already in the workflow prompt; keep it.
- Ticket Context with "Outside facts" pinned to a hub SHA let the author and the reviewer both check hub claims without guessing. Keep doing this in orbital-ticket-prep.
- Reading the hub model (`catalog.tsp`) to settle the reviewer's "contentRef is optional" point avoided a speculative change.

## 4. Deferred

- Hub `postV1ApisUpload` (reached by `skmtc api publish --visibility` on an existing API) sets no `captureWebhookEvent`. CI runs that always pass `--visibility` add revisions with no webhook and no pipeline delivery. publish-action#1 users meet this on every push. The preferred fix is on the hub side. Source: https://github.com/skmtc/skmtc/pull/241#issuecomment-6497135095
- `cli/lib/api-publish-headless.ts` `toApiPublishUrl`: `--origin-url ""` is silently not sent, with no error or warning. Meets a CI template with an unset variable (self-review, proposed, not built).
- `cli/lib/project-headless.ts` `uploadSchemaRevision` is a second client for `/revisions`. It has a raw `text.slice(0,300)` error, no `requestId`, and no `originUrl`. `isObject`, `errorMessage` and `Scoped` are also copied. A future change to that route or to hub-error parsing has to be made twice. The ticket limited sharing to `toScopedPath`.
- `cli/commands/api.ts` `export const description` is unused (mod.ts hard-codes the group text). It has the same pattern as `commands/project.ts`; anyone editing it sees no effect.
- `toPublished` treats a missing `revision.contentRef` as `hub-error`. The hub omits it only for link-only revisions, so this matters only if the hub ever answers an upload with one.
- `project create --visibility` still takes a free string with a silent `private` fallback (`commands/project.ts`). Its users get private on a typo.
