# Retro: #299 drop operations that require a broken or undefined security scheme

Run `2026-10-31-5dt12u` of `implement-ticket-dg`, PR https://github.com/skmtc/skmtc/pull/309 (merged as `747c4d93`, core 0.35.3).

## 1. Summary

The ticket asked core to drop an operation or webhook whose effective security names a failed or undefined scheme, and to stop a root `security` that is not a list from failing the whole run. Delivered and verified on main. Shared helpers are in `deno/core/parse/securityRequirements.ts`, with 90+ table-driven tests across 3.0/3.1/3.2 and a `toArtifacts` test. The run took 1h 19m (18m 29s of it queued), with 61,674 input, 36.4M cached and 191,550 output tokens, at about $16.26. Review was the most costly step: 18m 37s, $6.45. It was worth it. It found one blocking defect and three should-fix defects that self-review missed: a version clash, a `mutualTLS` regression, a root case with no record, and a wrong docs heading level.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The core bump collided twice. #307 took 0.35.1 after open_pr, and #308 took 0.35.2 during address. CI's version check had passed at push, so only the reviewer and the delivery lead caught it. | 1 blocking review round, 2 merges plus 2 re-bumps in address (~5 of 11 min) | check | Re-run `deno task version-check` against the current main at merge time (merge queue, or a required check that re-runs when main moves). | https://github.com/skmtc/skmtc/issues/311 |
| The new "failed to parse means drop" rule sat on top of an older parser gap. `type: mutualTLS` (valid in 3.1/3.2) throws in `toSecuritySchemeV3`, so valid APIs lost every operation. Neither the ticket nor self-review checked which scheme types core parses. | 1 should-fix round; a stopgap guard instead of real parsing | ticket | ticket-prep skill: when a ticket drops consumers of "items that failed to parse", list the spec-valid inputs that the parser rejects today. | triage |
| A root `security` that names an undefined or broken scheme left no record at the root and stayed on `document.security`. The ticket's "record why" rule covered it, but no done-when item named it, and self-review did not derive it. | 1 should-fix round, ~4 min | ticket | ticket-prep skill: write a done-when item for each shape × level (root, operation, webhook) the rule touches, not just the general principle. | triage |
| `error-codes.md` heading said `INVALID_OPERATION — error` after the change added a warning-level use. The #308 merge also brought in a link to the old anchor, which the check step fixed in `b6da1f86`. | 1 should-fix round plus a check-step fix | check | verify-docs: compare each heading's levels with the `level:` values logged for that type in core, and fail on an in-page anchor that has no matching heading. | triage |
| In implement, `git checkout -- file` (used to undo a mutation proof) also wiped an uncommitted review fix. It had to be redone. | ~3 min | workflow | implement prompt: "commit before mutation proofs, then restore with git checkout". | triage |
| The ticket's Outside facts said security requirement names are "the same in 3.0.3 and 3.2.0". 3.2 also allows URI names, so valid 3.2 operations get a false "not defined" message. | none this run; deferred | ticket | ticket-prep skill: quote each spec version's sentence instead of asserting "same in X and Y". | triage |

## 3. Keep

- Make each mutation proof a temporary `Math.random() > 2` guard plus a test run, and report the failing test names. It made the author's evidence checkable by the reviewer (already in the implement prompt).
- Reviewer scans of the 2,149-document catalog corpus put numbers on the impact (645 inheriting operations, 675 OR alternatives). Write this into the review skill as the default for parse-rule changes.
- The delivery lead's operator message on the version clash arrived before merge and named the exact steps. Keep it as practice while #311 is open.

## 4. Deferred

- **OR alternatives.** `deno/core/parse/securityRequirements.ts` `toSchemeProblems`: one unusable alternative drops the operation even when another alternative resolves or is `{}`. In the corpus, 675 operations in 24 documents (for example `docs-bugbug-io.json`) generate nothing after this release. This follows the ticket's Decided section. https://github.com/skmtc/skmtc/pull/309#issuecomment-6545398965 item 1.
- **URI requirement names.** OAS 3.2 URI-named security requirements are reported as "not defined in components.securitySchemes", and `OasSecurityRequirement.toSecurityScheme()` cannot resolve them. Authors of 3.2 documents meet this; the corpus has no case today. Same comment, item 2.
- **mutualTLS parsing.** `toSecuritySchemeV3` (v3-1, v3-2) has no `mutualTLS` case. The stopgap `unmodeledSchemeTypes` keeps the operations, but they still log a false `INVALID_SECURITY_SCHEME`. Real support needs a new `OasSecurityScheme` union member and a minor release. Same comment, item 3.
- **`$ref` aliases.** A `$ref` scheme that points to a broken scheme counts as defined (Decided: out of scope). Its operations render without auth. Raised in self-review.
- **`security: null`.** It now counts as malformed at every level (before, it was read as absent); the corpus has 0 hits. Recorded as a judgement call in the implement summary.
