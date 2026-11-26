# Retro: #410 normalize a workspace path once

## 1. Summary

#410 asked core to normalize a workspace path once: a `WorkspacePath` brand, and files looked up by key, with `normalizeWorkspacePath` called at least 4 times less often in the #409 record. PR #427 delivered both and was merged as 478d6142, which published core 0.48.0.
- **Calls:** 22,000 → 4,700, a factor of 4.7.
- **Output:** identical to main on 4 documents.
- **Profiles (follow_on):** `toNormalizedWorkspacePath`'s share of CPU fell from 25.0% to 4.0% on Microsoft Graph and from 17.6% to 3.4% on Cloudflare. Graph's median generation time fell from 3,543 to 2,685 ms.

The run took 1h 30m and cost about $33.57: 24.5k input tokens, 91.3M cached and 315k output.
- **Most costly step:** implement, at 37m 40s and $18.25. It was worth it: one review round, and no design rework.
- **Review:** 23m and $10.31. It found 4 real should-fix items, two of them in the docs.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The done-when item "compare a run of three catalog documents with main" has no script. A background agent had to build a /tmp harness: core from `git archive`, three generators from skmtc-generators origin/main, and a workspace with the pins stripped. The generators do not type-check on core 0.47+ (`OasIntersection`), so the run used `--no-check`. follow_on built the same harness a second time. | ~4m agent + ~100k sub-agent tokens; repeated in follow_on | check | Add `deno/.scripts/compare-output.ts` (base ref vs working tree, named documents, stock generators) and name it in `orbital-ticket-prep` for "output does not change" items. | triage |
| The ticket's own proposal (getFile looks up the key first) reached a factor of 3.3 against its "factor 4" done-when. Its measurement predates the four sites #337 added. Meeting the target needed a new public method (`getFileByWorkspacePath`), a driver guard, and test doubles reshaped. | ~12m in implement | ticket | `orbital-ticket-prep`: when a done-when item is a number, rerun the tried prototype on current main and record that figure in Context. | triage |
| Adding one method to `GenerateContextType` broke four driver test files. Their hand-rolled context doubles are incoherent: `getFile` always returns undefined while `findDefinition` returns cached definitions. The review then found that the reshaped ModelDriver double asserts nothing at :207. | ~8m + 1 nit | check | Add one shared, coherent context double in `core/test/` (a real file map), and move the four driver tests onto it. | triage |
| A member operation's container `WorkspacePath` went through `ToOasOperationSettingsFields.exportPath?: string` and was suffixed twice. This is the brand-loss trap the ticket named, and the reviewer caught it, not the self-review. | 1 review round (address $2.53, 10m) | check | A verify-docs or lint check: in `core/context/generateTypes.ts` and `core/dsl/**`, no `exportPath` field or parameter typed `string`. | triage |
| New doc sentences described the engine from the ticket's model ("normalizes one time", exportPath without the suffix), not from the code. The reviewer raised 2 should-fix items on them. | half of the address round | steering | `deno/CLAUDE.md`, docs rule: a sentence that says what the engine does to a value names the function that does it, and the author reads that function. | triage |
| oxfmt is not installed in worktrees, so formatting was only checked when the self-review ran `npx oxfmt`. That run also reformatted unrelated lines that are unformatted on main, and moved a `@ts-expect-error` off its line. | ~4m | check | #218: a bootstrap with root `node_modules`, plus `oxfmt --check` on changed files in `deno task check`. | [#218](https://github.com/skmtc/skmtc/issues/218) |
| The implement step made three non-repetitive multi-chunk edits through Python heredocs, against the user's rule (Edit for prose and single edits). Nothing blocked them. | none in output; the rule was broken | check | A PreToolUse hook that refuses a Bash `python3 - <<` that writes a file under the repo, except for a listed exception path. | triage |
| The worktree root is `…/deno` and the Deno workspace is `…/deno/deno`. cwd resets between the two broke a few calls in implement, open_pr and follow_on. | ~3 calls per step | navigation | `implement-ticket-dg`: export the Deno workspace path in Context (`workspace_dir`). | triage |

## 3. Keep

- Mutation checks for each rule: remove the line, see the named test fail, restore it. Already in the workflow prompt.
- A background agent for the base-vs-branch output comparison, kept apart from the main context. Write the harness down in `deno/.scripts` (finding 1) so the next run does not rebuild it.
- Use the #409 record (`deno task check-work`) as the measure of a performance done-when, with a caller breakdown when the factor is short. Record this in `orbital-ticket-prep`.

## 4. Deferred

- `lang-kotlin/src/KtFile.ts`, `lang-csharp/src/CsFile.ts`: package and namespace are derived from the constructor's `path`, not from the normalized `file.path` that `addFile` now writes. Met by anyone who calls `addFile` directly with a Windows-spelled path. This predates the change, and the author proposed it in the implement summary.
- `core/dsl/model/ModelDriver.test.ts:207`: the assertion holds whatever the Driver does, because the mock is seeded with the export file. The core/context tests still cover it. Review nit, left: https://github.com/skmtc/skmtc/pull/427#issuecomment-7202739207
- skmtc-generators `gen-effect-schema/src/EffectRef.ts:126-127`: normalizes two export paths to compare them, which does not compile on core 0.48. Met when the generators move to 0.48. This is the ticket's listed follow-up.
- skmtc-generators: gen-typescript and gen-zod do not type-check on core 0.47+, because their exhaustive switches miss `OasIntersection`. Stock generators get this speed-up only once they move to 0.48. Related to skmtc-generators#117.
- Cloudflare and Microsoft Graph generate nothing on old or new core: "Registered definition mismatch" for schema names that differ only in `-`/`_`, plus a case clash on Cloudflare. Met by users of those documents. Seen by implement and follow_on, and also in the #400 retro.
- `core/dsl/driverFiles.ts` `findDefinitionAt`: on a hit it looks the file up twice, and the Oas, Gql and Webhook drivers keep thin private `ensureFile` wrappers. Self-review, dismissed as cheap.
- The TS and C# `register` have no file-kind invariant, unlike Kotlin's. Raised by the reviewer and dropped as pre-existing.
- Pre-existing lint in touched files: an inline `npm:tiny-invariant` import (RenderContext.ts, lang-kotlin register.ts) and an unused `JsonFile` import in RenderContext.ts.
- Not measured: a Worker CPU profile of a wrangler bundle; gen-valibot, which the ticket's count used; the render phase on Graph and Cloudflare, which produce no artifacts.
- #410 still had the `in progress` label after it closed; close_ticket removed it (follow_on defect 7).
