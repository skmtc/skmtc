# Retro: #436 a snippet wraps toString only in a run that emits attribution

## 1. Summary

#436 asked `SnippetBase` to install its capturing `toString` only in a run with `attribution.postPass`. The aim was to take out about 4% of a large run's CPU profile. The run delivered it as core 0.52.0 in PR #448, merged as 2753ebfc. It also added one run-level test that the ticket did not list.

The run took 1h 01m, with 19k input, 23.2M cached and 91k output tokens, for about $10.78. implement cost the most ($4.60, 19m); it was worth it, because the patch, the tests, the removal proofs and the self-review all landed in one step. check took 16m of wall time but only 1m of agent time; most of the wait was CI after a forced re-bump. follow_on repeated the ticket's byte-for-byte comparison on four documents and the Graph profile, and both agreed with the ticket.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The core minor was bumped three times. implement chose cli 0.11.3, which #446 had already published, and had to reset and bump again. Then check found that #447 had merged as core 0.51.0, so it merged main and bumped to 0.52.0. Third run in a row with this. | ~5m in implement, most of check's 16m (CI again) | workflow | implement-ticket-dg: run `version-check` and the re-bump as a named step just before merge, not in the author's turn | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| The ticket's reference patch left the "bare test mocks read undefined" sentence beside `captureSink` in `generateTypes.ts`. My self-review fixed the same sentence on `capturesRender` but missed this one, and the reviewer flagged it as a should-fix. | one review round (address 4m, $0.41) | check | verify-docs or a grep check: when a PR changes a rule named in comments, flag comments that still state the old rule (here "pass-through path" beside "bare test mocks") | triage |
| The ticket said "Not in this ticket: the minor bump", yet its Release section, the run's goal and `verify-docs` all needed the bump. | ~1m of deciding, a risk of a wrong `blocked` | ticket | orbital-ticket-prep: do not list the bump under "Not in this ticket" when a done-when check fails without it | triage |
| The ticket's done-when names only SnippetBase-level tests, so no listed test failed when the `CoreContext` ternary was reverted. I added a run-level test to cover that line. | ~3m | ticket | orbital-ticket-prep: when a fix spans a decision point and a consumer, the done-when names a test for each | triage |
| `bump-plugin` is a step not in the ticket's Release section; `verify-docs` named it only after the first run failed. | ~2m, one extra verify-docs run | ticket | orbital-ticket-prep: the Release recipe for a core minor lists `bump-plugin` (same finding as the #430 retro) | triage |
| follow_on had to build an import map to run the published stock generators (pinned to core 0.48.0) against a newer local core, and failed about four times. | a few minutes, about $1 | information | skmtc-rs bench: a script that links local core and lang-typescript into the stock generators | triage |

## 3. Keep

- Removal proofs (turn each guarding line off, see a named test fail, restore it) found the untested `CoreContext` line before review. They are already in the implement prompt.
- follow_on compared output digests before and after on four real documents, which settled the ticket's "same output" claim. This belongs in orbital-eval for any performance ticket.

## 4. Deferred

- `deno/core/context/generateTypes.ts`, `GenerateContextType.attribution`: a dead public member that nothing sets or reads. An author who reads the type and sets it expects it to control instrumentation. Removing it needs a core minor. Source: https://github.com/skmtc/skmtc/pull/448#issuecomment-7221528120
- `deno/core/context/CoreContext.ts`, `toSupportedSubjects` / `toEnrichmentDefaults`: no test covers `captureChannel: undefined`, and a regression would only cost speed (reviewer nit, https://github.com/skmtc/skmtc/pull/448#issuecomment-7221527550).
- `GenerateContextType.capturesRender` is a required `boolean`. A non-cast test double outside core fails `deno check` on upgrade; making it optional would avoid that (self-review proposal).
- The prototype-level wrapper, with no own property on each snippet, was not tried (ticket "Not in this ticket").
- Raw (not deduplicated) Cloudflare document with gen-typescript, gen-zod and gen-tanstack-query-fetch-zod: 0 files and 2,636 issues, with `Registered definition mismatch` for names that differ only by `-` and `_` (such as `intel-sinkholes_api_response_common_failure`). Seen by follow_on before and after the change; not investigated.
- `deno/core/context/RenderContext.ts` fails `oxfmt --check` on main, and `CoreContext.ts` has `deno lint` unused-variable errors (`JsonFile`, `msg`) on main.
