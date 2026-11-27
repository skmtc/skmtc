# Retro: #432 one rule for a reference inside a cycle

Run `2026-11-27-0f4dvh` of `implement-ticket-dg`, PR [#447](https://github.com/skmtc/skmtc/pull/447), merged as 6e007037.

## 1. Summary

#432 asked core to decide "is this reference inside a cycle" from one record: a lowlink (`leadsTo`, `depth`, `toOpenEnd`) kept while models are constructed, in place of the `reaches` set. The whole ticket was delivered as core 0.51.0, with patch bumps to 9 dependents and the plugin at 0.1.71. After the merge, follow_on ran the ticket's "Checked by others" import check on published core 0.51.0. Microsoft Graph went from 4 schemas that fail to load first to 0; Cloudflare stayed at 0. The run took 1h 11m, with 28k input, 22.8M cached and 160k output tokens, for about $12.55. review cost the most ($5.97, 19m, xhigh because the depth was `deep`). It found no defect, but its 4,000-graph fuzz and its line-by-line mutation pass are the strongest evidence that the rule is right. For a change to core's public API that every model generator depends on, that was worth paying for. implement cost $3.42 (18m).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| After #446 released cli 0.11.3, the merge step asked for `bump core --minor` again. That would have taken core to 0.52.0 and skipped 0.51.0, which was never released; only cli had collided. merge_main bumped cli alone. | 7m merge_main + 1 extra check/merge round (~8m) | workflow | orbital-workflows#105: the re-bump bumps only the packages whose version main already took (`deno task version-check --base origin/main` names them), never the minor again. | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| The push in open_pr and in merge_main went past the 2-minute Bash wait, because the pre-push hook reruns the full `deno task check`. That check had just passed on the same commit. | ~6m over two pushes | workflow | orbital-workflows#84: skip the hook when the check passed on that SHA, or wait longer than the gate takes. | [orbital-workflows#84](https://github.com/dmitrigrabov/orbital-workflows/issues/84) |
| CI on main at 6e007037 failed `tests-windows` in `GenerateView - user enters remote URL and selects watch mode`: a fixed 25 ms sleep between the arrow key and Enter. The change did not cause it, and the next main run was green. | watch_ci 7m + ci_triage 4m ($0.61) | check | `cli/components/GenerateView.test.tsx`: wait for the frame to show the new selection instead of sleeping a fixed time (skmtc#385). | [#385](https://github.com/skmtc/skmtc/issues/385) |
| The ticket's Traps named three release steps. `deno task check` then also failed with "plugin version: the published skills changed", which needs `deno task bump-plugin`. This is the second run in a row: the #430 retro has it too. | ~3m | ticket | orbital-ticket-prep: a ticket that changes a skill's `describes` also names `deno task bump-plugin`. | triage |
| The two tests the ticket named still passed when `toOpenEnd` followed only one model back, so they did not prove the chain the fix relies on. Implement found this by removing the line and added a longer-chain case. | ~3m | review-rule | reviewer rules: for each named test, remove the line it guards and check that it fails. The reviewer did this independently here, so the rule works and belongs in the ticket-prep checklist too. | triage |
| The worktree root is a directory named `deno` that holds `deno/`. Four Edit/Read calls against `<root>/core/...` failed before the right level was found. This is the second run in a row. | ~1m, 4 calls | navigation | implement-ticket-dg create_worktree: name the worktree directory after the run, not after the repository's `deno` subfolder. | triage |

## 3. Keep

- Mutation checks by removing a line. They found the gap in the ticket's tests and confirmed every guarding line; they already sit in the implement prompt.
- The reviewer's random-graph fuzz against the strongly connected sets. Write it down in `core/dsl/model/CLAUDE.md` as the way to verify any change to cycle detection.
- follow_on ran the "Checked by others" check against the published core before the generators were released. Keep this for core fixes whose evidence lives in a catalog document.

## 4. Deferred

- `core/dsl/model/ModelDriver.ts` (`toModelRef`): a cycle edge made by `context.insertModel` from inside a constructor does not pass `leadsTo` up. The reviewer judged this shape unsupported today: it already throws when the run enters at its target. A generator author would meet it by inserting a model from inside a constructor that is in a cycle.
- `core/dsl/PendingDefinition.ts` (`toOpenEnd`): after a constructor throws inside a cycle and the error is caught, cached Definitions point at a marker that is no longer pending, and a later build gets `inCycle: false`. The self-review reproduced this with Late:[B], B:[Late]. `#failItem` fails the run today, so it matters only if failures ever become recoverable.
- `core/dsl/PendingDefinition.ts` `depth`: it defaults to 0 and only `whilePending` sets it, so a marker pushed straight onto the public `pendingStack` compares wrongly in `leadBackTo`. Today only the test helper `toPending` does that.
- `core/dsl/PendingDefinition.ts` `toOpenEnd`: it walks the whole chain on every cache hit, with no path compression. Large cycles (Microsoft Graph) pay depth × references.
- Reviewer's nits ([comment](https://github.com/skmtc/skmtc/pull/447#issuecomment-7221246675)):
  - The JSDoc that calls `leadsTo` "the lowlink of Tarjan's algorithm" is close but not exact.
  - The `Definition.leadsTo` JSDoc omits that it is also `undefined` for the root of a cycle.
  - Three lines pass oxfmt's width of 100, and no CI job checks formatting.
- follow_on, Cloudflare: default naming collides for 3 schema-name pairs that differ only by separator or case (`stream_liveInput` and `stream_live_input`) and 2 path pairs (`/billable-usage` and `/billable/usage`). Each raises "Registered definition mismatch", and the run writes 0 files. Anyone who generates from the current Cloudflare document meets it.
- follow_on, Microsoft Graph: 138 generated file names are longer than 255 characters (gen-tanstack-query-fetch-zod service hooks), so macOS cannot write them. Nobody checked how the CLI handles that.
- skmtc-generators#129 is still open: projects get this fix only once the stock generators are released on core 0.51. The delivery lead's released-generator check still applies.
- `isReferencedBack` still marks the entry model, and the gen-zod `z.union`/`z.discriminatedUnion` difference depends on the entry. Both are left as the ticket's "Not in this ticket" says.
