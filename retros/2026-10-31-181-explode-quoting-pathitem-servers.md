# Retro: #181 explode default, with #182 key quoting and #180 path-item servers

## 1. Summary

#181 asked that a query or cookie parameter with no `style` parse as `explode: true` in all three parser trees. #182 asked that `handleKey` and `handlePropertyName` escape quoted names. #180 asked that path-item `servers` be parsed onto `OasPathItem`. A release commit followed (core 0.32.0, cascade only). All three were delivered in PR #269 (squash 74ab7827); Publish and Test Coverage are green on main.
Run `2026-10-31-89wmms`: 35m 55s; 19.7k input, 19.25M cached and 93.5k output tokens; est. $9.27.
`implement` cost the most (13m, $5.36): three tickets, a release, and a self-review with remove-the-line proofs. Worth it, because review found one should-fix and no blocking defect.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Review found that `sanitizePropertyName` (lang-typescript/src/sanitizePropertyName.ts:16) had the same unescaped `'${name}'` quoting as #182. The author had seen it in self-review but left it as "not in the ticket", because #181's Context said #182 had no other consumers. | 1 review round: address + check ≈ 8m, ~$0.84 | ticket | orbital-ticket-prep skill: for a "fix this pattern" ticket, grep the package for the same pattern (here `` `'${` ``) and list every hit in Where to work. | triage |
| In `implement`, the Edit tool wrote the ` `/` ` escapes as raw line-separator characters. This broke a regex literal in identifiers.ts (SyntaxError) and put invisible characters into test strings, and the edit had to be redone from git with `String.fromCharCode`. | ~4m of implement | check | Enable deno lint `no-irregular-whitespace` on `deno/**` and add `deno lint` to `deno task check`; today `check` runs no lint. | triage |
| The first `cd` went to the worktree's parent (`OKRtnGk0M4/`) and git failed, because the worktree root is itself named `deno` and contains `deno/`. | ~1m | navigation | Orbital worktree naming: name the checkout after the repo (`skmtc`), not after the start directory. | triage |
| `echo ======` failed under zsh (`=` expansion) and hid a diff result. | <1m | tool-cost | None needed beyond a note in the agent's shell habits; too small for a change. | none: negligible, one-off |

## 3. Keep

- The ticket's Context "Traps" named the non-array `servers` crash; testing it first turned a full-parse abort into a `tryParseAt` fix before review. Already in the orbital-ticket-prep practice.
- Remove-the-line proofs: `git checkout HEAD~1 -- <src>`, run the new tests, restore. This is cheap and needs no stash; worth naming in the implement prompt as the default method.
- The release recipe in Context ("Decided": bump --minor, record-api-surface, skill pins, bump-plugin) ran first time with no conflicts.

## 4. Deferred

- `deno/lang-typescript/src/FunctionParameter.ts:520` `toDestructured` passes non-identifier keys unquoted (`{ user-id: userId }`). A generator that destructures a hyphenated property meets it at generate time. Source: https://github.com/skmtc/skmtc/pull/269#issuecomment-6542635804
- `deno/core/parse/v3-*/operation/toOperationsV3.ts` and the document-level `servers`: a non-array `servers` still throws (`servers.map is not a function`), which drops the operation or aborts the parse. Any malformed document meets it at parse time. Already on main; noted in self-review and follow_on.
- `deno/lang-typescript/src/identifiers.ts` `toQuotedString`: the reviewer's nit to use a single `replace`, which would avoid an array per call. Declined because the regex needs raw U+2028/2029 (see finding 2). https://github.com/skmtc/skmtc/pull/269#issuecomment-6542636140
- `toQuotedString` does not escape lone UTF-16 surrogates. Outside the #182 escape list; dropped by the reviewer.
- skmtc-hub: drop `pathItemServer` (`apps/main/src/lib/operation-request.ts`) once core 0.32 is pinned. #180 names this as a follow-up outside the run; it has not been filed.
