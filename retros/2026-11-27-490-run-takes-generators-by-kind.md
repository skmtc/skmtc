# Retro: #490 a run takes the generators by kind (PR #492)

## 1. Summary

#490 asked core to sort the generators of a run without `onArtifact` by kind (models, operations, webhooks), so that an operation-first config gives the same bytes in both run modes. The ticket included a reference patch. Delivered in PR #492, squash-merged as 812813b9 and released as core 0.57.0. Follow-on checked the published release on 35 stack and document pairs: 0 differing files, where the 0.56.1 control differed. Run `2026-11-27-qyjhkp`: 53m 16s wall clock, 44m 58s agent time, 22,078 input / 21.8M cached / 128,748 output tokens, about $11.87. The costliest step was review ($5.50, 13m), and it was worth it: it found both should-fix defects that the self-review missed. One was a vacuous test assertion copied from the ticket.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket's reference test asserted `indexOf('route__ping') < indexOf('hook_pinged')`, but the identifier is `route_ping`. The assertion could not fail. The author copied it, the done-when "3 tests fail without the sort" passed through another assertion, and only the reviewer caught it. | 1 review round: address 4m 38s + check 7m 17s, about $1 | ticket | In the orbital-ticket-prep skill: before a ticket ships reference tests, mutate the code each assertion names and see that assertion fail. | triage |
| `docs/explanation/how-idempotency-works.md` "Order B" described an operation generator running before gen-zod, which the sort makes impossible. The ticket's "Why" cited the page as evidence but did not list it for editing, and the self-review grep (`order of the config`, `in order`) missed its wording. | Same review round as above | ticket | In orbital-ticket-prep: every doc page the ticket cites as evidence for a behavior it changes goes in the ticket's file list, marked as reread. | triage |
| The ticket's prescribed sentence "each run takes the model generators first" is false for the run with `onArtifact`: `#runBySubject` gives an operation that reaches no model before the first model. The self-review (`/code-review high`) caught it, and five places were reworded. | About 4m and one fix commit | ticket | In orbital-ticket-prep: check each sentence of prescribed doc text against both code paths it names before the ticket ships. | triage |
| `deno task version-check --base origin/main` passed with the change uncommitted, because it reads commits only. A first reading suggested no bump was needed. | About 1m | check | In `deno/.scripts/version-check.ts`: warn when the working tree has uncommitted changes in a publishable package. | triage |
| After `describes` changed, verify-docs required `deno task bump-plugin`. Neither the ticket's release steps nor deno/CLAUDE.md "Releasing" name that step. | About 1m, one extra verify-docs run | steering | deno/CLAUDE.md "Releasing": add "a change to a published skill also needs `deno task bump-plugin`; commit its three files". | triage |
| The worktree root is itself named `deno` and contains `deno/`, so the follow-on step's first command ran one level too high and failed. | 1 call | navigation | Orbital worktree path for skmtc: name the worktree root after the repo, not after the package directory. | triage |

## 3. Keep

- Removing the one line that makes the rule hold, then running the named test file, proved that "3 fail, 11 pass" exactly. This is already in the implement prompt.
- The follow-on step compared the published release against the previous version as a control. This showed that the comparison does detect the problem. Write it into the follow-on prompt of implement-ticket-dg for behavior-changing core releases.

## 4. Deferred

- `deno/core/context/GenerateContext.ts` `toKindRank`: no test pins the `gqlOperation` rank, so changing it breaks no test. A GraphQL stack author would meet this when the rank is edited. Source: https://github.com/skmtc/skmtc/pull/492#issuecomment-7229097838
- `GenerateContext.#runByGenerator`: `toKindRank` throws inside the sort, before the whole-generator `settings.skip` check. An untyped JS config with an invalid `type` that `skip` names now fails the run instead of being skipped. A JS-config user would meet it on 0.57.0. Fix if wanted: drop skipped generators before sorting. Source: self-review, in the PR description.
- Two generators of one kind still run in config order, and their shared-file definition order follows it. The skmtc-architecture sentence "identical regardless of generator order" is unchanged, as the ticket says.
- `core/_schemas/cloudflare.json` unmodified fails to generate on both 0.56.1 and 0.57.0 with "Registered definition mismatch" and a case-only file-name clash: `stream_liveInput` and `stream_live_input` map to one identifier. Anyone who generates from the real Cloudflare document meets it. Source: follow_on summary.
- The local skmtc-generators checkout pins core 0.48.0, so measurements need `git archive` of a named revision. Source: follow_on summary.
