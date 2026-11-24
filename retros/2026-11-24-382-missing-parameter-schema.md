# Retro: #382, a parameter or header with neither schema nor content

Run `2026-11-24-89mhmz` of `implement-ticket-dg`, PR #384, merged as 5b2a75fe.

## 1. Summary

The ticket asked the 3.0, 3.1 and 3.2 parsers to give a parameter or header that has neither `schema` nor `content` the empty schema `{}`, and to log one `MISSING_PARAMETER_SCHEMA` or `MISSING_HEADER_SCHEMA` warning. Delivered: core 0.45.0 is published, CI on main is green, and #382 is closed.

The run took 50m 15s (43m 21s of agent time), with 20,275 input tokens, 21.4M cached tokens, 89,493 output tokens and about $9.94. Implement was the most costly step ($5.45, 17m 53s), and that was worth it: it included one full-check cycle that the minor bump forced, plus removal proofs for every guard. Check took 11m 18s, mostly on a Windows CI flake.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `tests-windows` failed twice on PR #384, in `cli/components/CreateProjectView.test.tsx` and in `GenerateView.test.tsx`. The PR changes no CLI code, and a re-run passed. | most of check's 11m | check | Make the CLI UI tests wait for the spy call with a deadline instead of a fixed number of ticks. | https://github.com/skmtc/skmtc/issues/385 |
| The self-review fixed `schema: false` by testing the raw keys, which dropped `schema: null` and `content: null`. The reviewer caught it. | 1 review round (address 4m 37s + check) | review-rule | Reviewer rule: when a guard tests a value the parser coerces (`if (!x)`), ask for `null`, `false` and `{}` cases. | triage |
| The ticket said "Released through `deno task bump core`", but adding an `OasIssueType` literal changes the public API. The api-surface check then demanded `--minor`, `record-api-surface`, skill `describes` bumps and `bump-plugin`. | ~5 min, one extra `deno task check` | ticket | orbital-ticket-prep: for a change to a core type such as a new issue type, write `deno task bump core --minor` in the ticket's release line. | triage |
| The ticket's evidence document (curog on skmtc.dev) was not reachable from the worktree, so the fixture was rebuilt from the quoted parameter, with made-up query names. | done-when (4) only partly shown | information | Ticket prep: attach the failing operation's JSON, or a fetch URL, to the ticket. | triage |
| The worktree root holds `deno/`, so the paths are `…/deno/deno/core`, and cwd resets broke commands in implement and follow_on. | ~2 min | navigation | Workflow: say in the step prompts that the repository's packages are under `<worktree>/deno/`. | triage |
| The `git push` pre-push hook runs the full `deno task check` (~2 min), which went past the 120s tool timeout in open_pr and address. | ~3 min wait per push | tool-cost | open_pr/address prompts: allow about 4 minutes for a push in this repository, or skip the hook after a recorded green check. | triage |

## 3. Keep

- Removal proofs: disable each guard with `false &&`, see its test fail, then restore it. Already in the workflow prompt.
- Copying the cross-version test shape of `parse/emptyParameter.test.ts` made the 3-version × parameter/header matrix cheap. Worth a pointer in `deno/core/CLAUDE.md`.

## 4. Deferred

- `core/oas/parameter/Parameter.ts` and `core/oas/header/Header.ts`, `toSchema`: `content: {}`, or a content entry with no schema, parses silently. A generator then throws "Schema not found for a JSON media type" on documents in the wild. Source: https://github.com/skmtc/skmtc/pull/384#issuecomment-7137978847
- `toSchema` with a 3.1/3.2 `schema: false`: the throw says "neither schema nor content", which is misleading. Rare: core already dropped boolean schemas. Source: https://github.com/skmtc/skmtc/pull/384#issuecomment-7137978152
- `core/parse/v3-{0,1,2}/parameter/toParameterV3.ts`: `console.warn('Path parameters must be required')` bypasses `parseIssues` and `silent`. Seen in every run on a path parameter without `required`.
- `core/parse/missingSchema.ts` `toEmptySchema`: the `{}` it puts in place records a trail ending in `:schema`, a pointer to nothing in the document. Attribution tooling would meet it.
- `OasHeader.toSchema`: the error cannot name the header, because `OasHeader` has no name field. Anyone who builds a header by hand would meet it.
- Done-when (4) is unproven against the real curog document on skmtc.dev. The hub's `skmtc/operation-code` stack also still needs to move to core 0.45.0, which the ticket's author will file in skmtc-hub.
