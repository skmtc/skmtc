# Retro: #450 an entry declares its projections (file plan 1 of 6)

Run `2026-11-27-lko9lx` of `implement-ticket-dg`, PR https://github.com/skmtc/skmtc/pull/459.

## 1. Summary

The ticket asked for an optional `projections` list on the four entry factories, a `DeclaredProjection` type, four tests, a reference-page entry and `notes/file-plan.md`, applied from its own patch, and a core minor.
The delivery was the patch, core 0.53.0 with its cascade, the API surface, the skill `describes`, plugin 0.1.73, and one wording change (the JSDoc says "Optional." instead of "runs as before").
It merged as 5200295e, CI is green, and follow_on confirmed the published 0.53.0 on JSR.
The run took 35m 16s, with 15,397 input, 12.9M cached and 59,225 output tokens, an estimated $7.11.
The costliest steps were implement ($3.08, 18m) and review_standard ($2.93, 6m).
Neither found a defect in the patch itself. For a ticket that carries a reviewed patch, the review at high was more depth than it needed.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| A ticket with a pre-written, owner-agreed patch got a high self-review and a high reviewer pass, each about $3, and neither found a code defect. | ~$3, 6m | workflow | orbital-ticket-prep: a ticket whose Reference code is applied unchanged gets review depth `light`. | triage |
| `verify-docs` asked for `bump-plugin` only after the `describes` edit, so it ran twice. The ticket's Traps and Release named `bump`, `describes` and `record-api-surface` but not `bump-plugin`. This is the third run with this miss (#430, #436). | ~1m, one extra run | check | deno/.scripts verify-docs: the api-surface failure message lists `deno task bump-plugin` among its steps. | triage |
| The ticket's patch had JSDoc that said "an entry that declares none runs as before". That breaks the memory rule against history in comments, and the self-review caught it, which made a wording change from the ticket. | one fix commit | ticket | `handoff.py ticket`: check the comment text in a Reference-code patch against the history-lesson rule before filing. | triage |
| The worktree root is `0Z2mZpG1YG/deno` and holds a `deno/` folder, so the first git call (from the parent) failed. follow_on hit the same. | 2 failed calls | navigation | Orbital worktree prompt: name the repository root path, not only the primary working directory. | triage |
| A full `deno test` run (~3m) piped to `grep '^ok \|'` printed nothing because of ANSI colors, so it was rerun with `NO_COLOR=1`. | ~3m | tool-cost | deno/CLAUDE.md: say to run summary greps with `NO_COLOR=1`. | triage |
| The four tests the ticket names do not cover the webhook and GQL entries keeping the list. follow_on proved it with a scratch consumer, but there is no test in the repository. | follow_on scratch | ticket | The Done-when for an all-kinds field names one test per kind. | triage |

## 3. Keep

- Removed-line proofs for a compile-time trap (method form vs function property): the TS2322 is the evidence. This is already in the implement prompt.
- follow_on type-checks a scratch consumer against the published JSR versions. That is worth writing into the follow_on prompt for core-minor tickets.

## 4. Deferred

- `deno/core/dsl/DeclaredProjection.ts:24,32,40,48`: with the method form, `toExportPath` takes `unknown` options, so an option-taking projection called through the declared type without options throws at runtime. Ticket 3 (the file plan) meets this when it calls these statics. Source: https://github.com/skmtc/skmtc/pull/459#issuecomment-7222618410
- `deno/docs/reference/api/entry-factories.md`: the entry-shape section omits `WebhookEntry` and the `'webhook'` discriminator. This was already true before the change. A reader of the reference meets it.
- `deno/core/dsl/DeclaredProjection.test.ts`: there is no repository test that webhook and GQL entries keep `projections`. Ticket 3 should add one before it reads the list.
- The reference page and the entry JSDoc say that core reads the list, but nothing reads it until ticket 3. A generator author who declares projections meets that now and sees no effect.
- Skill and skeleton do not teach `projections`; per the ticket, ticket 5 adds it.
