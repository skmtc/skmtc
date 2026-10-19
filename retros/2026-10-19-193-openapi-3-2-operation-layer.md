# Retro: #193 OpenAPI 3.2 operation layer (run 2026-10-19-5chtkd)

## 1. Summary

- **Asked:** the 3.2 operation layer: the QUERY method, `additionalOperations` as an `UNSUPPORTED_OPERATION_METHOD` warning, `in: querystring`, `style: cookie`, a `toSchema()` fallback so `toParametersObject()` does not throw, and 3.0/3.1 unchanged. No version bump.
- **Delivered:** all of it in PR #206, squash-merged as c0cfbe55. CI on main is green, and #193 is closed.
- **Run:** 1h 14m wall clock, 58k input, 64.1M cached and 252k output tokens, about $24.73.
- **Costliest step:** `implement`, 28m 48s and $12.01, about half the run. Most of it was worth it: repros on a main worktree, the remove-the-line proofs and a full check. About 10 minutes went to the API-surface gate and to waiting on two full-suite runs.
- **Review:** `review` ($7.93) found three should-fix defects, one of them a real parse regression, so it was worth its cost.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `deno task check` failed on the verify-docs API-surface gate (a core minor bump is required for re-shaped exports), but the ticket forbids a bump. I re-recorded `.scripts/api-surface.json` at 0.29 in two steps, the same answer #191 found independently. | About 10 min in `implement`, plus a regeneration on every rebase and merge | ticket | The parallel-lane rules of batched-release tickets say: "re-record api-surface at the current minor; bump and re-record at the batch release". | triage |
| `open_pr` fetched and saw that main had moved (#203), but pushed before rebasing. That forced a rebase with 5 conflicts, a re-run of the check and a force-push. | About 6 min of the 8m 29s `open_pr` | workflow | In the `open_pr` push step, refuse to push unless `git merge-base --is-ancestor origin/main HEAD` holds, and rebase first. | triage |
| The parallel lanes collided in the same shared files: `pending-fields.test.ts`, `core/parse/README.md`, `generateTypes.ts` and the generated `api-surface.json`/`openapi.json`. This happened twice, in my rebase onto #203 and in `check`'s merge of #192. | About 6 min in `open_pr` and part of `check`'s 9m 44s | ticket | Split the shared kitchen-sink rows per lane (one pending-fields file per lane), or sequence lanes that share a table. | triage |
| `dropAdditionalOperationsV3` used `'additionalOperations' in pathItem` on an unvalidated value, so a string path item threw and failed the whole 3.2 parse. The reviewer caught it; my tests used only well-formed path items. | One review round; `address` 5m 48s | check | Add a malformed-shape case to `core/parse/dialect-differential.test.ts`: primitive path item, webhook and parameter values must give the same issue types in v3-1 and v3-2. | triage |
| The ticket placed the querystring count check "where the operation's parameters are merged", but no merge exists (`OasOperation.toParams` reads only operation-level parameters). | About 3 min reading `Operation.ts` | ticket | When a ticket names a code location for a rule, check that the location exists when the ticket is refined. | none — one-off ticket wording |
| oxfmt flagged existing drift in `core/dsl/GeneratorKeys.ts` on main, and I had to restore the file by hand so the PR did not reflow unrelated lines. No CI step checks formatting. | About 2 min | check | Wire `oxfmt --check` into CI and `deno task check` (#69). | [#69](https://github.com/skmtc/skmtc/issues/69) |
| Running `deno test` from `deno/` with `deno/core/...` paths gave 9 misleading type errors. oxfmt over a zsh `$FILES` list found no files, and the worktree had no `node_modules` until I ran `pnpm install`. `follow_on` also lost time to the nested root, the third run in a row. | About 4 min across `implement` and `follow_on` | navigation | Root `CLAUDE.md`: "packages live in `deno/`; run core tests from `deno/core`; run `pnpm install` before `npx oxfmt`; pipe file lists through `xargs`". | triage |
| `methodValuesNoTrace` (`string[]`, unread) had no guard, so removing `'query'` stayed green. The reviewer caught it, and a test was added in 878e0ab5. | Part of one review round | check | Fixed in the PR (`core/types/Method.test.ts`). | none — fixed in PR |

## 3. Keep

- **Proof against main:** a throwaway `git worktree add --detach /tmp/... origin/main` to run the new tests against main. It proved both "fails before" and "3.1 unchanged" for about 1 minute. Write this into the implement prompt's repro paragraph.
- **Batched mutation proofs:** break several guarded lines in different files at once and read the failing test names. This made the remove-the-line proofs about 3 runs instead of 13.

## 4. Deferred

- `core/oas/operation/Operation.ts` `toParams`/`toParametersObject`: a querystring parameter is returned as an ordinary named property, and a `['query']` filter drops it. The first generator that renders a 3.2 querystring will meet this (skmtc-generators#72). Source: https://github.com/skmtc/skmtc/pull/206#issuecomment-6267343023
- `core/parse/v3-2/parameter/warnQuerystringConflictsV3.ts`: `$ref` parameters are not counted, because they cannot be resolved at parse time. A 3.2 document that refs its querystring parameter gets no conflict warning.
- `core/parse/v3-2/parameter/warnQuerystringConflictsV3.ts`: a conflict that exists only at path level is reported once per operation, at `…:<method>:parameters`, not at `paths:<path>:parameters`. Readers of `parseIssues` locations meet duplicates.
- `core/parse/v3-{0,1,2}/parameter/toParameterV3.ts` `toExplode`: it reads the raw `style`, so an unstyled query or cookie parameter (default `form`) gets `explode: false`. Every generator that serializes array query parameters meets this today.
- `core/oas/parameter/Parameter.ts` `toSchema(mediaType)`: the single-entry fallback ignores an explicitly requested media type. A caller asking for `application/xml` gets the JSON schema without an error.
- `core/dsl/GeneratorKeys.ts`: an operation path without a leading `/` (invalid per spec, but not rejected by the parser) now classifies its key as generator-only, which is wrong in anchors attribution.
- `cli/lib/migrate-variants-headless.ts` `HTTP_METHODS` lacks `query`. This is harmless for pre-variant configs, but the list duplicates `methodValues`.
- `core/parse/v3-2/{operation,webhook}`: the `method as Method` casts in the operation map predate this change. Accumulating `[Method, Operation]` pairs would remove them.
- `core/parse/v3-2/parameter/toParameterV3.ts`: an explicit `style`/`explode` on a querystring parameter is kept. A querystring content entry with no `schema` still throws at generate time in `toSchema()`. Both were raised and dropped by the reviewer.
- `cli/components/useShortcut.test.tsx` "dispatches add-shortcut event after mount" failed once under full-suite load and passed alone. A flaky gate for every `deno task check`.
- `.scripts/api-surface.json`: core sits at 0.29 with a 0.30-sized surface. The batch release after #190–#193 must bump core's minor and re-record.
