# Retro: #194 — normalize 3.1 merge members as they enter the `allOf`/`oneOf`/`anyOf` merge

Run `2026-10-31-4jvck3` of `implement-ticket-dg`. PR https://github.com/skmtc/skmtc/pull/287, merged as 7a403310.

## 1. Summary

The ticket asked the v3-1 and v3-2 parsers to normalize each `allOf`/`oneOf`/`anyOf` member with the existing 3.1 rules as it enters the merge (option A, single pass). It also covered the `['array','null']`-without-`items` and null-only member gaps, and release through the cascade. All of it was delivered, merged and published (core 0.32.2), and CI is green. On `openrouter.yaml`, 55 `Cannot merge` issues and 57 errors became 0 errors, with 958 schemas instead of 941 and 151 operations instead of 143. The run took 53m 19s and an estimated $16.67: 24k input tokens, 36.6M cached and 208k output. `implement` cost the most (24m 54s, $10.34). Its biggest single cost was mirroring every edit into the v3-2 tree, plus about 150 test call sites, through individual Edit calls. `review_standard` ($3.11) found a blocking regression and a should-fix, which cost one address round (7m, $1.75) and one check (4.5m, $0.49).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| `implement` had to mirror each change into v3-2 and add an argument at about 150 test call sites. The step prompt forbids scripted edits ("never with `sed -i`, a Python or Perl script, or a shell heredoc"), while `~/.claude-two/CLAUDE.md` allows a checked script for repetitive code changes. That meant about 100 Edit/Read calls. | ~10m of implement's 25m; a large share of 22.6M cached tokens | steering | Workflow implement and address prompts: allow the user rule's exception, a fail-loud script for repetitive code-only changes checked with `git diff`, or point to that rule instead of restating a stricter one. | triage |
| A null-only member of a union nested inside a merge (`allOf [{$ref: anyOf[T, null]}, {description}]`) became an `OasUnknown` member, and only the reviewer caught it as blocking. The OpenRouter test asserted only "no `Cannot merge` issue", so a silent IR regression passed it. | 1 review round (address 7m + check 4.5m, $2.24) | check | Add an IR snapshot or a count of `OasUnknown` and nullable nodes for `_schemas/openrouter.yaml` in `deno/core/parse/v3-1/schema/`, so a parse change that widens types shows up as a diff. | triage |
| `checkArrayItemTypeConflicts` read raw `items.type` before normalization. The ticket's Context listed the merge's read points (`merge.ts`, `merge-properties.ts`, `merge-union.ts`) but not the `check-*` pre-checks, and the reviewer flagged it as should-fix. | part of the same round | ticket | `orbital-ticket-prep` skill: when a fix must cover "every place X is read", grep the reads (`\.items`, `\.properties`) and list each one in Context. | triage |
| The new document-level tests at first went into the `toSchemasV3.test.ts` pattern. I then found that `v3-2/schema/toSchemasV3.test.ts` is a byte copy of v3-1's and builds its context with `openapi: '3.1.0'`, so a document parse there runs the v3-1 tree. | ~2m; a silent gap for any v3-2 document test written there | check | `v3-2/schema/toSchemasV3.test.ts`: set `realContext` to `3.2.0`, or add a test that each tree's tests parse with that tree's label. | triage |
| The worktree folder `.../EwLmTUafzH/deno` is the repo root and holds a `deno/` folder. `cd` failed at the first git command, and `follow_on` hit it again. The #189 retro recorded the same thing. | ~4 commands across 2 steps | workflow | Orbital worktree naming: don't name the worktree folder after a top-level folder of the repo, or state the repo root in the step prompt. | triage |
| The self-review (`/review high`) found the `['null']` union-member gap. That gap came from the same partitioning that the blocking review finding was about, one level up. Neither the self-review nor the author asked "where else does a null member reach the cross product?" | part of the review round | review-rule | Reviewer and self-review rules: for every normalization rule a merge applies, check it at each nesting level (top-level dispatch, an `allOf` member, a `$ref` target, a nested union). | triage |

## 3. Keep

- Remove-the-line checks per guarding line, including breaking only the v3-2 copy, showed that the v3-2 tests exercise the v3-2 tree. This is already in the implement prompt; keep it.
- Reproducing on the named fixture before and after, with the issue, schema and operation counts, made the outcome verifiable in one line. Keep it as a done-when habit in `orbital-ticket-prep`.
- Leaving out a normalize call that no test needed (it repeated the entry normalization) kept the rule in one place.

## 4. Deferred

- `deno/core/parse/v3-{1,2}/_merge-all-of/merge-union.ts` `mergeCrossProduct`: drops a multi-type member's sibling keys (`nullable`, `minLength`). Anyone with `type: ['string','number']` plus constraints inside a union merge meets it. https://github.com/skmtc/skmtc/pull/287#issuecomment-6544038468
- `merge-number-constraints.ts` (v3-1/v3-2): merging an exclusive minimum with a larger inclusive minimum makes the larger bound exclusive (the same holds for maximum). This also happens for 3.0 members. Same comment.
- `v3-{1,2}/array/toArray.ts`: a 3.1 array with no `items` (standalone `['array','null']` or merged) logs the 3.0 "no items" warning, although `items` is optional in 3.1. Adds noise to the manifest issues of valid documents. From the self-review and the same comment.
- `merge-union.ts`: a nested `oneOf` whose only member is `{type:'null'}` errors with "Empty oneOf". The base fails on it too. The check step noted it as rare.
- `allOf` combines `nullable` with OR, and `allOf [string, {type:'null'}]` becomes a nullable string instead of an impossible schema: both are #279.
- #282 (OpenRouter `ReasoningConfig` empty `anyOf`) had the same root cause and is fixed by this change; it can be closed after checking.
- skmtc-hub: once core 0.32.2 is on jsr.io, delete `apps/main/src/lib/oas-type-arrays.ts` (from skmtc/skmtc-hub#1410). This needs a hub ticket.
