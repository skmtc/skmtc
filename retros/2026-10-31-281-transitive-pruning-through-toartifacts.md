# Retro: #281 + #280 pruning through toArtifacts, component removal, transitive pruning

Run `2026-10-31-53qen2` of `implement-ticket-dg`, PR #313 (squash-merged as 40637730, core 0.36.0).

## 1. Summary

#281 asked for ref-error pruning to work through `toArtifacts` and the CLI/worker trail prefix. Before, `toStackRef()` saw `[trace, span, parse, …]` and pruned nothing. #280 (owner option B) asked that a component with any parse error be removed, with pruning that follows refs to any depth.
Delivered: root-frame stripping in `ParseContext`, bucket-aware `removeItem`, a transitive worklist, and root-cause messages. Docs and skills were updated, and one review round fixed one blocking and five should-fix findings.
The run took 1h 31m (1h 03m agent time, 22m queued), with 22.2k input, 60.5M cached and 279k output tokens, about $24.55. That excludes the untracked docs fork (~230k tokens) and the `/review` forks.
`implement` cost the most ($10.45, 21m). It was worth it: it shipped every done-when except the OpenRouter numbers, which could not be reproduced.
`review` ($8.04) was second, and also worth it. It caught three real defects that `implement`'s own `/review high` missed: a GraphQL root-field collision, interface-union members never pruned, and a conflict with #300's rule.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The #281 Context said the run "shares nothing with the open runs except the release files". But #300, running alongside, decided the path-level-parameter rule the opposite way. `implement` built "remove every operation on the path". The review then had to reconcile it after a main merge, which also forced a re-bump. | 1 review round, ~12m address + ~5m merge/re-bump | ticket | orbital-ticket-prep skill: in "Depends on", list each open run's decided rules that touch the same behavior (here, path-level parameters), not just shared files. | triage |
| `implement` tested the bucket dispatch on 3 of 8 `componentsKeys`, although the done-when said "each bucket". The reviewer flagged this as blocking. | blocking finding, part of the round | review-rule | Implement prompt or reviewer rules: when a done-when says "each X", the test must iterate the source list (`componentsKeys`), not a sample. | triage |
| Turning on GraphQL pruning made two dormant `GqlDocument.removeItem` bugs reachable. Root fields were matched by `fieldName` only, and interface-union members were traced under the interface name. Self-review caught only the third, the union index splice. | 2 should-fix findings, ~5m | review-rule | Reviewer rules: when a change makes a previously dead code path run in production, review every branch of that path, not just the diff. | triage |
| The #281 done-when asked for OpenRouter's before/after counts (19 `INVALID_DEPENDENCY_REF`). Today's document and the repo fixture have 0 error-level issues on main and at the ticket base, so the evidence could not be reproduced. | ~6m measuring 2 docs × 2 trees | ticket | orbital-ticket-prep: re-measure named evidence against the current document before the run starts, and pin the document (commit a fixture) when it is used as evidence. | triage |
| The git root is the worktree's `deno/` folder, and the Deno project is at `deno/deno`. `cd` and path mix-ups failed several commands in `implement`, in `address` (a `git add` pathspec) and in `follow_on`. | ~3 attempts per step, ~5m total | navigation | Orbital worktree note, or the root CLAUDE.md: "repo root = worktree/deno; Deno workspace = deno/deno; run git from the root". | triage |
| The STE hook flags "component" (the OpenAPI term) on every docs edit, so each edit's output was noise to read past. | ~10 hook blocks, small | check | ste100 config: allowlist `component` (OpenAPI Components Object) for this repo's docs. | triage |

## 3. Keep

- Mutation-checking each guard: removing the line, watching its test fail, then restoring it. This caught nothing wrong here, but it proved every review fix had a test. It is already in the implement prompt.
- Forking the docs sweep (14 pages) while measuring and running mutations in parallel kept the main context lean. Record this in the implement prompt as the pattern for doc-wide terminology changes.
- Taking main's release files on conflict, then re-running `bump --minor`, `record-api-surface` and `bump-plugin`, resolved a cascade conflict cleanly. This is already in the CLAUDE.md releasing section.

## 4. Deferred

- `core/gql/document/GqlDocument.ts` removeItem union case: a union emptied by removals stays registered, and fields typed by it are kept. A GraphQL user whose union members all fail meets it, and gets `type U = ` or `z.union([])`. Source: https://github.com/skmtc/skmtc/pull/313#issuecomment-6545718869 (1).
- `core/context/ParseContext.ts` `#toDocumentTrail` vs `core/context/documentTrail.ts` `toDocumentFrames`: two rules for the document part of a trail. They disagree on an unprefixed trail with a phase-named frame, such as a schema named `parse`. The next caller that reads a walk trail as a document address meets it. Source: same comment (2).
- `StackTrail.toStackRef` builds unescaped ref keys, while `$ref` strings are JSON-Pointer escaped (`~1`). A component name containing `/` or `~` never matches its consumers. Only non-conformant specs meet it, since OpenAPI names are `[a-zA-Z0-9.\-_]+`. Source: implement self-review.
- `core/run/toArtifacts.pruning.test.ts` `toDanglingRefs`: it walks raw input and counts only schema refs as kept, so it cannot check path-level parameters. The override test checks the parsed path item instead. Source: reviewer nit, https://github.com/skmtc/skmtc/pull/313#issuecomment-6545718611.
- `OasComponents.removeSchema` has no callers left in core, and still throws when `schemas` is undefined (the new `removeEntry` returns undefined). Only external callers would meet it. Source: implement self-review.
- The #194 OpenRouter figure (19 `INVALID_DEPENDENCY_REF`, 8 operations lost) is not reproducible on today's document. If skmtc-hub still shows "ChatRequest (unresolved $ref)", it comes from another document or core version. Source: implement measurement.
