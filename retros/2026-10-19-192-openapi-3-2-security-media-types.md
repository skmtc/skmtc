# Retro: #192 — OpenAPI 3.2 security scheme fields and media types

Run `2026-10-19-afbxp2` of `implement-ticket-dg`, 2026-10-19.

## 1. Summary

- **Asked.** Read security-scheme `deprecated`, `oauth2MetadataUrl` and `deviceAuthorization` into the IR, port the unknown-key warning to v3-0/v3-1, and parse media type `itemSchema`. Store `prefixEncoding`/`itemEncoding` as given, with a warning beside `encoding`. Resolve `components.mediaTypes` `$ref`s in `toMediaTypeItemsV3`. No version bump.
- **Delivered.** PR #204, squash-merged as `c064b40d` after one review round: 1 blocking and 4 should-fix comments, all fixed. CI on `main` is green, and follow_on verified the merged tree.
- **Duration.** 1h 02m wall clock, 58m 18s agent time, no queueing.
- **Tokens and cost.** 95,512 input, 54.0M cached, 254,542 output, about $22.39 without the forked `/review` sub-agents.
- **Costliest step.** `implement` (26m 20s, $9.96). It was mostly worth it, but it deferred two items as "Proposed, not built" that review then required. That cost the `address` round (8m, $3.25) and part of `review` ($7.19).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `implement` listed two items under "Proposed, not built": following `components.mediaTypes` entries that are `$ref`s (spec-legal input dropped with an error), and emitting `deprecated` from the three sibling `toJsonSchema` methods. Review made both should-fix. | One review round: `address` 8m / $3.25, plus part of `review` | workflow | In the implement prompt's "Proposed, not built" paragraph, say that spec-legal input the change mishandles, and the ticket's own rule at a sibling call site, are defects to fix in the step. | [orbital-workflows#80](https://github.com/dmitrigrabov/orbital-workflows/issues/80) (commented) |
| The remove-the-line proofs in `implement` removed one `logSkippedKeys` call per tree. No test covered the `http` and `openIdConnect` branches; the reviewer found this (blocking). | The blocking comment; about 3m in `address` | workflow | In the implement prompt's mutation paragraph, say that a rule applied in N branches is shown by removing it from each branch. | triage |
| `deno task check` failed on the verify-docs api-surface guard, which needs a minor bump the ticket forbids. I re-recorded `api-surface.json` at 0.29, and re-recorded it again after merging #203. This is the second lane to hit it. | About 6m in `implement`, plus a re-record in `address` | ticket | Batched-release tickets state the policy: re-record at the current minor in each lane, then bump the minor at the batch release (#191's retro proposes the same). | triage |
| Merging `main` conflicted with #203 in `core/parse/README.md` and `pending-fields.test.ts`, as the ticket predicted. The hand merge moved my seven rows into #203's new `readFields` shape. | About 4m in `address` | ticket | Parallel-lane tickets give each lane its own row file (for example `pending-fields.<lane>.test.ts`), so shared tables do not conflict. | triage |
| A new use of `INVALID_DEPENDENCY_REF` and of `UNEXPECTED_PROPERTY` left `docs/reference/error-codes.md` giving the wrong fix. Review caught it. verify-docs checks only that each issue code exists. | One should-fix comment; about 2m | review-rule | Reviewer rule: a new place that logs an existing issue code needs an "Also when:" paragraph in `error-codes.md`. | triage |
| During a mutation proof, `git checkout -- toMediaTypeItemV3.ts` also reverted my uncommitted thread-2 fix, so I had to re-apply three edits. | About 2m | tool-cost | The `mutate.ts` helper that #191's retro proposes, which restores only its own edit; until then, commit before each proof. | triage |
| oxfmt is not installed in the worktree, and `npx oxfmt --check $FILES` reported "no target files" because zsh does not split words. Each file had to be checked one at a time. | About 3m | navigation | Add a `deno task fmt:check` that runs oxfmt on `git diff --name-only` (one command, no shell splitting). | triage |

## 3. Keep

- Proving each guard by removing it and running the test caught two guards the first unresolvable-ref test could not fail. This is already in the implement prompt.
- Merge `main`, then re-run `deno task record-api-surface` instead of hand-merging `api-surface.json`. Belongs in the core `CLAUDE.md` release notes, next to the batched-release policy.
- Adopting the other lane's test convention when resolving a shared test file kept one style. Nothing to write down.

## 4. Deferred

- `deno/core/oas/mediaType/MediaType.ts` `toJsonSchema`: drops `itemSchema`, `prefixEncoding`, `itemEncoding` and `encoding`, so anyone who serializes a parsed 3.2 document back to JSON loses them. Source: [PR #204 deferred findings](https://github.com/skmtc/skmtc/pull/204#issuecomment-6267199643).
- `deno/core/parse/v3-2/mediaType/toMediaTypeItemV3.ts` `toMediaTypeItemsV3`: a referenced media type is parsed under the referencing content entry's location. Its issues and gen-map pointers name paths that are not in the document, and are repeated for each reference. Generator authors and manifest readers meet it. Same source.
- `toMediaTypeItemV3.ts`: keys next to a content `$ref` (such as `summary`) are ignored with no warning, unlike `toRefV31`. Users of 3.2 `$ref` siblings meet it. Same source.
- `toMediaTypeItemV3.ts`: `components.mediaTypes` entries that no content entry references are never parsed, so a broken unreferenced entry gives no diagnostic. Self-review, dismissed as the ticket's design.
- `deno/core/parse/v3-2/securitySchemes/toSecuritySchemes.ts`: the device flow's `scopes` is optional as the ticket says, but the 3.2 spec marks it REQUIRED, so a generator that reads every flow's `scopes` meets `undefined`. Review, dropped as ticket-mandated.
- `deno/.scripts/api-surface.json`: re-recorded at 0.29 without a bump. The release after #190–#193 must run `deno task bump core --minor` and then re-record. The release owner meets it.
