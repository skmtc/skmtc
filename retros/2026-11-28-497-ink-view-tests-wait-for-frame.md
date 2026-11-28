# Retro: #497 Ink view tests wait for the frame instead of sleeping

## 1. Summary

#497 asked for the random `tests-windows` failures in the Ink view tests to be found and fixed, then for 20 green runs on main. PR #499 (merged as 6d7a0b83) replaced every fixed sleep in GenerateView, InstallGeneratorView, CreateProjectView and CreateProjectTask with a shared `waitFor` (`deno/cli/test/wait-for.ts`). It also added `workflow_dispatch` to Test Coverage. follow_on then ran 20 dispatched `tests-windows` jobs on main, and all of them passed (21 in a row, counting the merge push). The run took 2h 37m, of which 1h 29m was waiting on the operator and 59m was agent time. It used 22.6k input tokens, 22.4M cached tokens and 106k output tokens, for an estimated $11.04. implement cost the most, at $5.32 and 18m. It was worth it: it found the second cause, lost key presses. Its first fix was still timing-dependent, and review caught that.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| In implement I waited one `setTimeout(0)` turn so React's `setImmediate` effects would run first. I based this on one `deno eval` on an idle loop. review_standard showed that a due timer fires before the queued immediates, so the wait could still lose a key on a slow runner. | 1 review round: address 7m, $1.37, plus about 3m of review | review-rule | Reviewer rules: when a test helper claims an event-loop ordering, reproduce it with a stall (busy-wait) between scheduling and the next turn before accepting it. | triage |
| #497 duplicated the older open issue #385, the same flake in CreateProjectView and GenerateView. Nobody linked the two, so #385 stays open after the fix. | ticket hygiene, about 0 min | ticket | orbital-ticket-prep: search open issues for the failing test names before writing a ticket. | [#385 comment](https://github.com/skmtc/skmtc/issues/385) |
| My self-review fix for the "exactly once" spy checks shrank their window from 300 ms to one turn. review_standard asked for a 300 ms settle before the check that nothing more happens. | part of the same review round | review-rule | Reviewer rules: a change from "sleep then assert" to `waitFor` must keep the window of every check that something did not happen. | triage |
| Eleven CLI test files sleep a fixed time before they assert (`await new Promise(resolve => setTimeout(resolve, N))`). No check flags a new one. | each flaky file costs a ticket and a run (this one cost $11) | check | Add a lint rule to `deno/lint-plugin`, or a grep step in `deno task check`, that bans `setTimeout(resolve` in `deno/cli/**/*.test.tsx` and points to `@/test/wait-for.ts`. | triage |
| In implement a `find /` for Ink's sources hung until the 120 s tool timeout. I had to stop it, then found the sources in the Deno npm cache. | about 2 min | navigation | `deno/cli/CLAUDE.md`: note that npm sources live in `~/Library/Caches/deno/npm/registry.npmjs.org/<pkg>/<version>`. | none: small one-off cost |
| The "20 runs in a row" done-when item cost 20 dispatches of the whole Test Coverage workflow, including the ubuntu coverage job and the Coveralls upload. | follow_on 18m, plus 20× the runner minutes | workflow | `coverage.yml`: give `workflow_dispatch` an input that runs only `tests-windows`. | triage |

## 3. Keep

- Read the CI failure logs (`gh run view --job <id> --log`) across many failed runs, main and PR branches, to find every flaky file before fixing any. This is worth writing into orbital-ticket-prep for flake tickets.
- Prove each new check by breaking the code it protects (remove the line, or inject a duplicate call), watching the test fail, then restoring. The author prompt already asks for this; it caught a test that passed on the old code.
- For a "repeat N times on main" item, follow_on does the dispatches after the merge. Keep that split.

## 4. Deferred

- `deno/cli/components/{AddGeneratorView,ListGeneratorsView,ProjectView,CloneGeneratorView,RemoveGeneratorView,BundleView,DeployView}.test.tsx`, `cli/tasks/BooleanTask.test.tsx`, `cli/lib/{manager,hub-token}.test.ts` still sleep for a fixed time before they assert. A slow Windows runner could fail any of them the same way.
- `deno/cli/components/useShortcut.test.tsx` has its own local `waitFor` that returns quietly on timeout. A slow runner turns that into a misleading assertion message ([nit](https://github.com/skmtc/skmtc/pull/499#issuecomment-7239773200)).
- `deno/cli/test/wait-for.ts:23`: `check: () => void` accepts an async function, whose rejection is ignored. The first author to pass an async check would meet it. `() => undefined` rejects expression-bodied checks, so the fix is `() => void | Promise<void>`, awaited.
- `deno lint` reports 13 unused `using` bindings (`fetchStub`, `projectCreateStub`) in InstallGeneratorView, CreateProjectView and CreateProjectTask tests. Anyone who runs lint on those files sees them.
- `alias-root`/`renderInit` failed once on tests-windows in run 46044754786 (feat/first-run), and `tokenizer-load` failed once in run 46062196419. Neither was investigated, and either may be a further Windows flake.
- Issue #385 duplicates #497 and is still open (commented, not closed).
