# Retro: #191 — OpenAPI 3.2 document-layer metadata into the IR

Run `2026-10-19-dboe8a` of `implement-ticket-dg`, 2026-10-19.

## 1. Summary

- **Asked.** Read the 3.2 fields tag `summary`/`parent`/`kind`, server `name`, response `summary`, example `dataValue`/`serializedValue`, discriminator `defaultMapping` and `$self` into the IR, in the v3-2 tree only. Add `INVALID_TAG_PARENT`, apply the example exclusivity rule, flip the pending-fields rows, and do not bump the version.
- **Delivered.** PR #203, squash-merged as `a5d7a9e2`. Review was clean (one nit, two deferred findings). CI on `main` is green and follow_on verified the merged tree.
- **Duration.** 33m 10s wall clock, 29m 05s agent time, no queueing.
- **Tokens and cost.** 17,358 input, 24.3M cached, 132,511 output; about $11.67, not counting the forked `/review` sub-agents.
- **Costliest step.** `implement` (19m 38s, $8.12, 70% of the run). It was mostly worth it: one round, no review fixes needed. About a third of it went to mutation proofs done one Edit at a time, and to restoring after them (see findings).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `deno task check` failed on the verify-docs "api surface" guard, which demands a core minor bump for any re-shaped export. The ticket forbids a bump, so I re-recorded `.scripts/api-surface.json` at 0.29 without one. #192 and #193 will hit the same wall and conflict on this file. | About 6 min (diagnose, read the guard and history, re-record); a deferred review finding | ticket | Batched-release tickets ("no version bump") state the api-surface policy: re-record at the current minor in each lane, then bump and re-record at the batch release. | triage |
| Mutation proofs cost about 30 tool calls in `implement`: Edit the code, run the test, restore with `git checkout` or a hand Edit. One restore left a removed branch and stray blank lines, and an Edit missed its anchor because oxfmt had reflowed the line. | About 6 min and a large share of the 18.4M cached tokens | tool-cost | Add a small `deno/.scripts/mutate.ts <file> <find> <replace> -- <test paths>` that applies, runs, reports and always restores, and point to it from the implement prompt's mutation-proof paragraph. | triage |
| Ticket text "`externalValue` and the other two" was ambiguous, and one reading contradicts the 3.2 spec (it would flag `dataValue`+`externalValue`). I had to read the skmtc-hub plan to settle it. | About 3 min; one judgement call flagged to the reviewer | ticket | When a ticket paraphrases a spec rule, quote the spec sentences or list the forbidden pairs explicitly. | triage |
| The type-level drift detector in `core/context/generateTypes.ts` claims to catch an `OasIssueType`/valibot mismatch "in either direction", but removing a valibot literal type-checks clean. Only `server` `openapi:check` caught it. | About 2 min (found by mutation); a latent false guarantee | check | Make the drift check two-way, e.g. also assign `OasIssueType` to `v.InferOutput<typeof oasIssueType>` via a mutual-assignability helper, or correct the comment. | triage |
| follow_on ran its first test from the worktree root (packages live in `deno/deno`), and looked for `openapi:check` in `deno/` when it lives in `deno/server`. The #190 retro recorded the same nested-layout loss. | About 3 min in follow_on (second run in a row) | navigation | Root `CLAUDE.md` line: "Deno packages live in `deno/`; `openapi`/`openapi:check` are tasks of `deno/server`." | triage |
| `oxfmt` on a zsh `$FILES` list reported "no target files" because zsh does not word-split variables. | About 1 min | navigation | In the repo's formatter note, give the command `git diff --name-only -z -- '*.ts' \| xargs -0 npx oxfmt --check`. | triage |
| In the parse README I wrote "(see below)" pointing at the `$self` paragraph, which sits above the table. The reviewer caught it as a nit. | One nit comment | review-rule | none: the reviewer already checks pointer text | none — reviewer already caught |

## 3. Keep

- Before writing tests, run the done-when items against what the worktree can show locally (all could here). This is already in the implement prompt; keep it.
- A `readFields` table next to `pendingFields`, asserting both the IR value and "no issue at that location", is a clean way to graduate pending rows. Note it in the `pending-fields.test.ts` header (done) so #192/#193 follow it.
- Commit an API-surface re-record on its own so a reviewer can drop it. Add this to the core `CLAUDE.md` release notes alongside the batched-release policy.

## 4. Deferred

- `deno/.scripts/api-surface.json`: re-recorded at 0.29 without a minor bump, so nothing now forces the bump the 3.2 batch owes. Whoever releases core after #190–#193 must run `deno task bump core --minor` and then re-record. Source: [PR #203 deferred findings](https://github.com/skmtc/skmtc/pull/203#issuecomment-6266869321).
- `deno/core/parse/v3-2/tag/toTagsV3.ts:36`: `INVALID_TAG_PARENT` is logged at `tags:parent` with no per-tag segment (the existing tag trail has none). Manifest readers with several tags must read the message to find the tag. Same source.
- `deno/core/oas/schemaPath/traverseSchema.ts:133`: a `{prop:value}` path segment ignores `discriminator.defaultMapping`, so an unmapped value throws instead of resolving to the default. Generator authors using schema paths on 3.2 unions meet it. Self-review, proposed not built.
- v3-2 parsers trust the types for `serializedValue`, tag `parent`/`kind` and `$self`. A non-string value is stored typed as `string`, so string methods crash later with no parse issue logged. Self-review, proposed not built.
- `deno/core/oas/{tag,example,discriminator}/*-types.ts`: the exported `*Data` valibot schemas lack the new fields (and `externalValue`). Nothing consumes them today; external users of those exports meet the gap.
- `deno/core/oas/tag/Tag.ts`: `OasTag` keeps its fields private and has no `toJSON`, so `OasDocument.toJSON()` serializes tags as `{ oasType: 'tag' }` and drops all tag metadata. This predates the run.
- `deno/core/parse/README.md:134`: "(see below)" points upward to the `$self` paragraph. [Review nit](https://github.com/skmtc/skmtc/pull/203#issuecomment-6266868860).
