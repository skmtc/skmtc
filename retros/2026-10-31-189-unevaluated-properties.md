# Retro: #189 — 3.1/3.2 `unevaluatedProperties` read as `additionalProperties`

Run `2026-10-31-quzwyw` of `implement-ticket-dg`. PR https://github.com/skmtc/skmtc/pull/272, merged as 687b4693.

## 1. Summary

The ticket asked the v3-1 and v3-2 parsers to rename `unevaluatedProperties` to `additionalProperties` when no in-place applicator is present. It also asked them to remove the keyword with a warning from `allOf`/`oneOf`/`anyOf` wrappers, and to update the docs and release core 0.32.1 through the cascade. All of it was delivered and merged. CI is green and the release was published. The run took 37m 03s and an estimated $8.71: 24k input tokens, 15.3M cached and 105k output. `implement` cost the most (12m, $4.19). That was worth it, because its remove-the-line checks found a blind spot in the snapshot. `review_standard` ($2.43) found three real gaps, which led to one address round (5.5m, $0.97) and one check (4m, $0.32).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's "Done when" listed composed tests for `allOf`, `oneOf` and single-member `allOf` only, although its Fix section also strips `anyOf`. I copied the list, and the reviewer flagged the untested `anyOf` strip as blocking. | 1 review round (~10m: address and check) | ticket | `orbital-ticket-prep` skill: check that every branch the Fix section names has a matching "Done when" test. | triage |
| The ticket's list of in-place applicators left out `$dynamicRef`. Self-review proposed adding it but did not build it, because the ticket named an exact list. The reviewer then made it should-fix as a regression: a closed empty object where before the object was open. | part of the same round | ticket | `orbital-ticket-prep` skill: when a ticket lists spec keywords, copy the list from the cited spec section (2020-12 §10.2, §8.2.3) rather than from memory. | triage |
| The ticket dictated the docs row "`unevaluatedProperties` with no `allOf`/… → `additionalProperties`". That is wrong when `additionalProperties` is also present, and the reviewer caught it as should-fix. | part of the same round | review-rule | Reviewer prompt: check each new docs table row against every early return in the code it describes. | triage |
| `OasObject.toJsonSchema` writes `additionalProperties: false` when the field is undefined. Because of that, the `dialect-differential.test.ts` snapshot compare passed the closed-object pair and the 3.0 check without the fix. A remove-the-line check found it, and I fixed it in the run. | ~3m | check | `dialect-differential.test.ts`: the loop now compares the IR `additionalProperties` field directly (done in 58f5544a). Any other test that compares object snapshots has the same blind spot. | none, fixed in run |
| The worktree root `.../Ko0yvV1vVu/deno` is the repo root, and it holds a `deno/` subfolder. `cd deno/core` from it failed, and the `follow_on` step hit the same thing. | ~4 commands across 2 steps | navigation | Orbital worktree naming: don't name the worktree folder after a top-level folder of the repo, or state the repo root in the step prompt. | triage |
| The ticket's formatting recipe says to run `pnpm install` before `npx oxfmt`. In this worktree that rewrote `pnpm-lock.yaml`, and I had to check it out again before committing. | ~2m | tool-cost | Fix #218 (a `.orbital/bootstrap.sh` that installs with `--frozen-lockfile`). | [#218](https://github.com/skmtc/skmtc/issues/218) (commented) |
| `deno task check` after `deno task bump core` rewrote `deno/deno.lock` with the new ranges. Release commit 9a76c80d was amended to include it. | ~1m | steering | `deno/CLAUDE.md` "Releasing": say that the bump commit includes the `deno.lock` update made by the next `deno task check`. | triage |

## 3. Keep

- Removing each guarding line and watching its test fail found a test that could not fail. This is already in the implement prompt; keep it.
- When the reviewer reports a mutant, rerun that exact mutant against the new test before replying. Write it into the `address` prompt.
- A ticket Context that gives exact line numbers, traps and the release recipe meant nobody had to look for anything. Keep using `orbital-ticket-prep`.

## 4. Deferred

- `deno/core/parse/v3-{1,2}/schema/toSchemasV3.ts`, `allOf` merge: a member's own `unevaluatedProperties`, or a `$ref`'d member's, is merged by a last-wins spread with no warning. A 3.1 Record member then wins over an earlier `additionalProperties`, and the result differs from 3.0. Anyone composing records under `allOf` meets this. Out of scope per the ticket; related to #194.
- The same files: mapping a closed `allOf` after the merge flattens it is recorded in the ticket as a possible later ticket.
- The same files: with a multi-type array (`type: ['object','string']`), the renamed `additionalProperties` goes onto the synthesized `oneOf` wrapper, not onto the object member. This matches 3.1 `additionalProperties` behavior, but the object member stays open.
- `deno/docs/reference/settings/source-resolution.md`: the old general sentence ("other 2020-12 keywords are not read and warn") was removed as the ticket asked. `prefixItems` and `patternProperties` are now not mentioned on that page.
- Self-review style findings that were left: the strip is repeated in three branches per tree; the destructure is duplicated; the v3-2 test title says "3.1". The ticket's one-tree-per-dialect rule rules out a shared helper.
- The run did not reproduce the skmtc-hub TypeSpec document itself; `follow_on` parsed its shape only. A hub ticket should remove the 3.0 codegen document once core 0.32.1 is pinned there.
