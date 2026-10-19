# Retro: #190 — accept OpenAPI 3.2 documents (v3-2 parser tree)

Run `2026-10-17-895xa7` of `implement-ticket-dg`, 2026-10-17 to 2026-10-19.

## 1. Summary

- **Asked.** A `core/parse/v3-2` tree copied from v3-1, a `'3.2'` dialect, a 3.2 passthrough in convert, a committed corpus test (3.1.0 vs 3.2.0 labels), every 3.2 field as a skipped-field warning, a stale-prose sweep, and no version bump. #199 (keep `_schemas/` out of the published package) was folded in.
- **Delivered.** PR #201, squash-merged as `5510d38b`, which closes #190 and #199. CI on `main` is green and follow_on verified the merged tree.
- **Duration.** 48h 36m wall clock, but only 1h 16m of agent time. 47h 14m was spent parked at `read_threads` after `open_pr` could not push.
- **Tokens and cost.** 32,107 input, 56.2M cached, 306,822 output; about $27.58. This does not include the tokens of the forked `/review` sub-agents.
- **Costliest step.** `review` (2 visits, 32m, $15.00). It was worth it: it found two blockers (a whole-document crash and a test that compared almost nothing) plus #199's unmet done-when. The first visit had no PR to post to, so it could not post its findings.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| GitHub push protection rejected `open_pr`'s push (strings shaped like OpenRouter keys in the `openrouter.yaml` fixture). The run still went on to `review` on a local branch, then `read_threads` failed and the run was parked until the operator decided. | 47h 14m wall clock; one extra `open_pr` and `review` visit (about $7) | workflow | In implement-ticket-dg, route an `open_pr` with no PR straight to an operator question, with the unblock URLs, instead of to `review`. | [orbital-workflows#82](https://github.com/dmitrigrabov/orbital-workflows/issues/82) (commented) |
| The ticket picked two corpus fixtures for the committed test without checking them for secret-scanner patterns. The "do not edit the fixture" rule then left the author no move. | Cause of the row above | ticket | When a ticket asks to commit third-party documents, the delivery lead runs a secret scan (`gitleaks detect --no-git`) on them before queuing it. | triage |
| The done-when's known exception ("`querystring` / `style: cookie` drop the operation") was true at operation level only. At path-item and webhook level, `toPathItemV3` threw outside the per-method catch and failed the whole parse. The reviewer reproduced it; my pending-fields test covered only operations. | One review round (blocking); part of the 13m 37s `address` | ticket | When a ticket names a failure mechanism as an accepted exception, probe it at every level where the field can occur (operation, path item, webhook, component) before writing it down. | triage |
| `version-equivalence.test.ts` compared `OasDocument.toJSON()`, which serializes components as `{ oasType }` only. So 952 + 650 component schemas went unchecked. The reviewer found it; I had not inspected the serialized output. | One review round (blocking) | navigation | In the JSDoc of `OasDocument.toJSON` (`deno/core/oas/document/Document.ts`), say that components are not serialized and that tests should read the component getters. | triage |
| The self-review fix excluded only the two new fixtures from core publishing. The package stayed at 21.1 MB across 756 files, and #199's done-when was not met. The reviewer measured it with `deno publish --dry-run`. | One blocking thread | check | Add a step to `deno task check` that runs `deno publish --dry-run` in `deno/core` and fails on any `_schemas/` or `*.test.ts` path, or above a size budget. | triage |
| The ticket's sweep listed files, not a pattern, so five more "3.1 → 3.0" comments (server, CLI) were found, left, and then requested in review. | One should-fix thread, about 3 minutes | ticket | For a prose sweep, write the grep pattern (`rg -n "→ 3\.0\|normalized to (an OpenAPI )?3\.0"`) into the done-when instead of a file list. | triage |
| In the worktree, the git root is `deno/` and the packages sit in `deno/deno/`. `address` and `follow_on` each lost a command to the wrong directory. | 2 failed commands, about 1 minute | navigation | Add one line to the root `CLAUDE.md`: "Deno packages live in `deno/`; run `deno task` there." | triage |
| `oxfmt --check` fails on `server/src/openapi.ts` and `createServer.ts` on `main`, so changed files cannot be held to the formatter. | About 2 minutes to confirm it was pre-existing | check | Wire the format check into CI, as #69 proposes. | [skmtc#69](https://github.com/skmtc/skmtc/issues/69) (commented) |

## 3. Keep

- Remove-the-line checks for each new guard (dialect line, convert prefix, `logSkippedKeys`, path-item catch, `case '3.2'` route), plus injecting drift into a v3-2 parser to prove the comparison test fails. These are already in the implement prompt. Add "inject a drift into the code under test" for comparison tests.
- The reviewer backed each blocker with a scratch repro and measured numbers (bytes, file counts, schema counts). That made the fixes mechanical. Keep it in the reviewer rules.

## 4. Deferred

- `deno/docs/reference/settings/source-resolution.md:4,99-100,185-199,371`, `docs/reference/api/to-artifacts.md:65`, `docs/using/how-to/pin-schema-source.md:43`, `docs/using/tutorials/01-your-first-generation.md:109`: the reader docs teach the retired 3.1 → 3.0 down-conversion and list no 3.2. Users checking 3.1/3.2 support meet this now, and it gets worse at the 3.2 release after #193. Source: [PR #201 deferred findings](https://github.com/skmtc/skmtc/pull/201#issuecomment-6265797719).
- `deno/core/parse/v3-{0,1,2}/operation/toOperationsV3.ts` (catch block) and `v3-2/webhook/toWebhooksV3.ts`: `INVALID_OPERATION` locations repeat the method (`paths:/search:get:get`) because `logIssue({ key: method })` traces onto a trail that already ends in the method. `pending-fields.test.ts` asserts the doubled form. Tooling that resolves `parseIssues[].location` meets it on every failed operation. Same source.
- `deno/core/parse/v3-2/securitySchemes`: a valid 3.2 `mutualTLS` scheme gets an error-level `INVALID_SECURITY_SCHEME` and is dropped. A media-type `$ref` to `components/mediaTypes` loses its schema with only a warning, and is not in the README dialect table. Both are review findings in #192's scope.
- OAuth flow objects (`authorizationCode` etc.) still drop unknown keys silently, and v3-0/v3-1 security schemes keep the dead `...skipped` destructure. Tracked as #200.
- `logSkippedKeys` in `v3-2/securitySchemes/toSecuritySchemes.ts` re-implements `core/enrichments/findUnknownKeys` shallowly. This is review finding #192's scope.
- About 245 relative imports in the v3-2 copy break the `@/` rule in `deno/CLAUDE.md`. The dialect-neutral `_helpers` and `_merge-all-of` now exist in three copies. Both come from the ticket's "copy verbatim" rule; anyone who edits one copy meets drift.
- `deno/convert/toV3Document.ts`: three identical passthrough branches with casts (review finding, left by design).
- `deno/convert/deno.json` still imports `@skmtc/openapi-down-convert`, which nothing uses.
- Neither core nor convert was version-bumped (the ticket forbids it), but CLI and server pin convert `^0.1.18`. The 3.2 passthrough reaches users only after the release that follows #193.
- `deno/core/parse/v3-0/document/toDocumentFieldsV3.ts:16` still has the stale 3.1 → 3.0 comment.
- `deno/core/_schemas/deno.json` is an OpenAPI document with a Deno config filename (optional rename in #199, not done).
