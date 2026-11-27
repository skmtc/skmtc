# Retro: #426 core and lang-typescript skip work that changes no output

Run `2026-11-27-w47ctt` of `implement-ticket-dg`, PR https://github.com/skmtc/skmtc/pull/435, merged as 90eb0116.

## 1. Summary

- **Ticket:** apply a reference patch of seven speed-only changes, with tests and two `work.json` counts, and release core and lang-typescript with one bump call.
- **Delivered:** the patch applied cleanly. Core is 0.49.1 and lang-typescript 0.15.5 on JSR.
- **Release incomplete:** a JSR HTTP 500 stopped Publish at `@skmtc/worker@0.3.92`. server 0.3.45, cli 0.11.1 and npm core 0.49.1 still wait for a manual `workflow_dispatch`.
- **Figures:** 1h 05m wall clock and 45m 47s of agent time. 50,174 input, 12,164,405 cached and 74,295 output tokens, estimated at $7.25.
- **Most costly step:** implement ($2.18). The review steps, light_check (13m 35s, $1.35) and check (14m 14s, $1.29), cost the most time. Both were worth it: light_check found two blocking test gaps that the self-review had passed.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket said the existing `ResultsLog.test.ts` test fails without the `__proto__` guard, and that its toCyclicRefs tests cover the walk. Neither held: Deno deletes the `__proto__` accessor, and no ref sat inside a list. Implement found the first gap and called it unprovable; light_check found both and gave tests. | 1 review round (address 5m, about half of check's 14m) | ticket | orbital-ticket-prep skill: a "done when" that claims "test X fails without line Y" is checked by removing Y before the ticket is filed | triage |
| Publish failed at `@skmtc/worker@0.3.92` on a JSR 500. The cascade left server, cli and npm core unpublished, with no retry, and worker went up without provenance. | release incomplete; follow_on returned `needs_you`, 11m waiting on the operator | check | `.github/workflows/publish.yml`: retry a publish step that fails on a registry 5xx before failing the run | https://github.com/skmtc/skmtc/issues/442 |
| Test Coverage on main failed because `cli/components/InstallGeneratorView.test.tsx` reached the live JSR registry during the same outage. | 1 red main run, about 2m of ci_triage | check | stub the registry in every test of the file (as #441 says) | https://github.com/skmtc/skmtc/issues/441 |
| The cascade from `bump core lang-typescript` gave lang-kotlin 0.11.38, which #433 had already published, so the PR's version check failed after main moved. Check had to merge main and bump lang-kotlin again. | part of check's 14m | workflow | implement-ticket-dg `check` prompt: before merging, rerun `deno task version-check --base origin/main` and rebump on a failure, as a named step | triage |
| open_pr waited 3m 39s on the pre-push hook, which ran `deno task check` again on a tree that implement had just checked. Address ran it once more. | about 7m of push waits | tool-cost | implement-ticket-dg push prompts: when the pushed tree equals the checked tree, push with `--no-verify` and name the checked commit | triage |
| The worktree root is the repository's `deno/` folder, which holds another `deno/`. The first git command, run in the parent folder, failed. | 1 call | navigation | Orbital worktree note: give the repository root and the package root as separate paths | none, trivial one call |

## 3. Keep

- Removing a guarded line to show which test fails caught the `__proto__` gap in implement, and the reviewer used the same practice to supply the fix. It is already in the implement prompt; keep it there.
- Applying a ticket's reference diff with `git apply --check` first fails loudly on drift and keeps code edits mechanical. Write it down in the orbital-ticket-prep skill, beside "Reference code".

## 4. Deferred

- `deno/lang-typescript/src/identifiers.ts` `escapable`: it assumes each key of `escapedCharacters` is one code unit, and only a comment says so. Whoever adds a two-unit key to the map would lose its escape silently. Seen in implement's self-review, PR #435.
- `deno/core/helpers/refFns.ts` `toRefPathBucket`: no test can show the fast-path guards (no `/`, no `~`), because `isBucket` gives the same result either way. Only the comment says so, and the guards could be removed with CI green. https://github.com/skmtc/skmtc/pull/435#discussion_r4719767125
- `.github/workflows/publish.yml`: a package whose publish step errored can still appear on JSR without provenance (worker 0.3.92), and a rerun skips it. Seen in follow_on.
- Release of #426 is unfinished: run `gh workflow run publish.yml --repo skmtc/skmtc --ref main`, then `gh run rerun 46007405332 --repo skmtc/skmtc --failed`. For the operator, now.
- The npm (Node) build's `__proto__` behaviour is not tested on Node. The new `ResultsLog.proto.test.ts` emulates the accessor under Deno.
