# Retro: #294 merge and array defects left after #194

## 1. Summary

#294 asked for four fixes in the `allOf`/`oneOf`/`anyOf` merge and array parse: sibling keys of a multi-type member, the exclusivity of a larger inclusive bound, no missing-`items` warning in 3.1/3.2, and a nested null-only `oneOf`. All four were delivered in PR #307 (squash 5e6eefdb) with core 0.35.1. Publish and Test Coverage are green on main. The run took 1h 00m: 25k input tokens, 34.6M cached and 181k output, an estimated $15.37 before the forked `/review` agents. The most costly step was implement (28m, $8.31). It was worth it: each fix had a test proven to fail without it, and the self-review caught a null-member-with-title case. The review round (review $3.09 + address $2.14 + check $0.84) found three defects the self-review missed.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `withGroupSiblings` merged `type: 'object'` into `$ref` members, resolving them and losing their names. The warning sat in a comment in `decompose-union.ts`, but no test covered a ref member under a group with a sibling key. The reviewer caught it. | 1 review round (~13m, ~$3) | check | `deno/core/parse/v3-{1,2}/_merge-all-of/merge-union.test.ts`: one table-driven test that runs `mergeUnion`/`mergeIntersection` with a throwing `getRef` over every wrapper shape that has `$ref` members (siblings, nested groups, null members), so a new merge path cannot resolve refs. | triage |
| `normalizeExclusiveBounds` overwrote `minimum` with a numeric `exclusiveMinimum`. The ticket said "handle each tree's own form", but I tested only the merge, not the normalization that feeds it. The reviewer caught it. | same round | ticket | orbital-ticket-prep: when a fix depends on a normalized input, name the normalizer (here `normalize-schema-shape.ts`) under "Where to work" and ask for a test that combines both keywords. | triage |
| A nested group's `nullable` was dropped by the `flatMap` in `mergeCrossProduct`. Item 1 named `nullable`, but I took the null-only filter to cover it and did not test `type: [..., 'null']` beside another member. The reviewer caught it. | same round | review-rule | The self-review prompt in implement-ticket-dg: for each value the ticket lists by name (here `nullable`), run one full parse with that value and assert it in the output. | triage |
| Core 0.34.0, and later 0.35.0, landed while the PR was open. I rebased and bumped, then merged main, took main's side in 11 version files, and bumped again. | ~6m and a merge commit | workflow | implement-ticket-dg: make the release commit in the merge step, after merging main (already proposed in the #284 retro). | triage |
| "One commit per defect" with items 1 and 4 in the same `merge-union.ts` meant setting changes aside as patches, then checking files out and re-applying them by hand. | ~5m | steering | The goal text in implement-ticket-dg: allow one commit per file group when defects share a function, or say how to split them (commit item by item, in order). | triage |
| `git checkout HEAD -- $SRC` failed because zsh does not word-split an unquoted variable; the revert-and-fail check had to be rerun with `${=P}`. Then `deno task check` ran twice because the first run's output was cut. | ~4m | tool-cost | The user's `~/.claude-two/CLAUDE.md` Tools section: "in zsh, split a path list with `${=VAR}`; write a long check's output to a file and read its exit code". | triage |

## 3. Keep

- Revert-the-source-and-run before each commit, and a temporary mutation for each new assertion. This found the one test (the equal-bound guard) that passes on main by design. It is written down in the implement prompt.
- Porting v3-1 to v3-2 with `git diff | sed 's#v3-1#v3-2#' | git apply --check` instead of editing the near-copies by hand. It fails loudly on drift. Record it in `deno/core/parse/` CLAUDE.md next to the near-copy note.

## 4. Deferred

- `deno/core/parse/v3-{1,2}/_merge-all-of/merge-union.ts` `collapseNullOnlyUnion` keeps a wrapper's `type`, so `{ type: 'string', oneOf: [{ type: 'null' }] }` becomes a nullable string, not null-only. Met by any schema that writes this shape. Belongs with #279. Source: https://github.com/skmtc/skmtc/pull/307#issuecomment-6545161447
- `merge-union.ts` `withGroupSiblings` merges type-specific siblings (`minLength`) into members of another type, so `allOf [oneOf[string, number], {type: [string, number], minLength}]` logs "Unexpected property 'minLength' in 'schema:number'". Main already logs the same for a top-level multi-type schema. Met by any 3.1 multi-type schema with string, array or object keywords. Change: merge only the keywords that apply to the member's type. Source: same comment, and the self-review proposal (1).
- `deno/core/parse/v3-*/_merge-all-of/check-number-constraints-conflicts.ts` ignores exclusivity, so `> 5` with `≤ 5` merges silently into an empty range. Met by contradictory bounds in an `allOf`. Self-review proposal (2), which the reviewer dropped.
- `deno/core/parse/v3-0/_merge-all-of/merge-union.ts` still drops the sibling keys of a group wrapper (for example `minLength` beside a `oneOf`) in 3.0 documents. The ticket scoped item 1 to 3.1/3.2. Self-review finding.
- Repeated normalization in `collapseNullOnlyUnion`/`isNullableOnly` on every cross-product pair. The cost was not measured; it shows up in an `allOf` over large `oneOf` groups. Self-review finding.
- `allOf [string, oneOf[number, oneOf[null]]]` still fails with '"oneOf" array is empty': string and number really conflict. Core semantics might read it as null-only; it is undecided. Found while implementing.
