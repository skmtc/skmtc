# Retro: #438 generate skips the bundle build when nothing it is built from changed

## 1. Summary

#438 asked `skmtc generate` to skip `deno bundle` and the `deno info` graph check when the bundle on disk was built from the inputs the project has now. The owner had decided the design: a fingerprint of the inputs and a record beside the bundle. It was delivered as cli 0.12.4 (PR #466, squash `1d780a13`). follow_on ran the released CLI in a scratch project: a skipped run took about 0.55 s and a building run about 1.0 s, and every trigger built once and then skipped. The run took 1h 20m, with 21.7k input, 41.3M cached and 248k output tokens, for about $19.59. review cost the most ($7.06, 21m, at xhigh because the depth was `deep`), and it was worth it. It found two blocking defects and three should-fix defects that the author's own `/code-review high` missed. One of them was a silent stale-bundle case, which is the bug class #168 ended. implement cost $6.69 (23m), and address $3.39 (13m).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The decided design stored the record in `.settings/`, which the documented `.gitignore` (and skmtc-hub's and tradespring's) keeps tracked, while `bundle.js` is ignored. So a checkout or a pull paired a record with another bundle, and `generate` silently ran stale code. The reviewer reproduced it; the author's self-review did not see it. | 1 blocking review round (part of address's 13m) | ticket | orbital-ticket-prep: a ticket that adds a file under `.skmtc/**` states whether git tracks it, and checks that against the `.gitignore` in `docs/concepts/projects-and-workspaces.md`. | triage |
| implement bumped cli to 0.12.2 from a main where #464 had already taken 0.12.2. During address, #465 then took 0.12.3, so there were two merges and two re-bumps, and the reviewer had to flag the collision as blocking. | 1 blocking finding, ~6m in address | workflow | orbital-workflows#105: rerun `deno task version-check --base origin/main` and re-bump just before the push and before the merge. | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| implement widened the ticket's lock rule (the project's `deno.json`) to the workspace members' `deno.json` files as well. Stock generators publish test-only ranges (`@std/assert`, `@std/log`) that never enter the lock, so every project with a clone built on every run. The reviewer found it by probing 72 real projects. | 1 should-fix, ~4m | check | `cli/lib/bundle-inputs.test.ts`: add a fixture whose clone `deno.json` is copied from a published `@skmtc/gen-zod`, and assert that the second run skips. | triage |
| The self-review dismissed relative imports outside the walked folders as "needs `deno info`", although `toGraphRefusal` already runs `deno info` on every build. The reviewer pointed it out, and the fix reused that graph. | 1 should-fix, ~5m | review-rule | implement-ticket-dg author prompt: a scope item dismissed as "needs X" must say whether X already runs on that path. | triage |
| The phrases "before every run" and "on every run" survived two rounds in `the-worker-runtime.md` and `reference/cli/bundle.md`, because the docs rule in `deno/CLAUDE.md` asks to grep identifiers, not claims about behavior. | 1 should-fix, ~3m | steering | `deno/CLAUDE.md` "Update the docs": also grep the old behavior's wording ("every run", "before each") when a behavior changes. | triage |
| The pre-push hook (`deno task check`) takes 3.5–4 minutes, longer than the workflow's three-minute push wait. The author stopped one of their own pushes, and polled the others across tool timeouts. | ~6m over open_pr and address | workflow | implement-ticket-dg push prompts: allow 6 minutes for `git push` when `.githooks/pre-push` runs the full check. | triage |
| The ticket's hyperfine command has no `--minimum-dependency-age=0`, so on release day `jsr:@skmtc/cli@<release>` is refused (follow_on met this). | 1 failed call; the delivery lead's check will fail the same way | ticket | orbital-ticket-prep: every `jsr:@skmtc/*` command a ticket prints carries `--minimum-dependency-age=0`, built by `dependency-age.ts`. | triage |
| The ASD-STE100 hook rejected about eight doc edits in a row for sentence and paragraph length. | ~8 extra Edit calls | tool-cost | none: the hook works as meant | none — hook is intended |

## 3. Keep

- An xhigh review that reproduces each finding (a scratch test, a probe of the real projects on the machine) before it posts. This is already in the review prompt at depth `deep`.
- Counting `deno` subprocesses with a `Deno.Command` subclass, swapped in and restored with `Object.defineProperty`. It needs no `as` cast, and it can inject an edit mid-build. Write it down in `deno/cli/tests/mocks/` as a shared helper.
- follow_on ran the released CLI against a PATH shim that logs each `deno` subprocess. That is the cheapest end-to-end proof for any "skips a subprocess" ticket.

## 4. Deferred

- `deno/cli/lib/bundle-inputs.ts` `toCurrentVersions`: the Deno version input is the CLI's runtime, not the `deno` on PATH that runs the build. A user of a compiled `skmtc` who upgrades the system Deno keeps the old bundle until another input changes. Source: https://github.com/skmtc/skmtc/pull/466#issuecomment-7224913949
- `deno/cli/lib/create-bundle.ts`: the reason a project gets no fingerprint is never shown (`generate --json`, `doctor`). Anyone who expects the skip and times `generate` will meet it. Source: same comment.
- `bundle-inputs.ts` `toDigest`: it copies every byte into one buffer, so peak memory doubles on large local packages. The nits comment: https://github.com/skmtc/skmtc/pull/466#issuecomment-7224913604
- `bundle-inputs.ts`: npm dependencies in a member's `package.json` are not checked against the lock. A member that pins npm ranges there could skip with a newer resolution.
- `bundle-inputs.ts`: the project's own unused `jsr:` pins (older projects carry `@std/assert`, `@skmtc/worker`) still force a build every time. Dropping that check narrows a decided rule, which is the owner's call (review thread 3).
- `create-bundle.ts`: the pre-build inputs are read after `deno info`, so an edit in the milliseconds between the two reads could record a stale `graphFiles` list. The check step noted this race.
- `duplicate-packages.ts`: a missing imported module is reported as "Could not check that project … resolves one copy of @skmtc/core". That leads with the wrong concern; the wording predates this change (follow_on).
- The squash title on main says "cli 0.12.2", but the release is 0.12.4. This is cosmetic (follow_on).
- `CONTRIBUTING.md` still tells contributors to run `deno fmt`, which the project forbids in favor of oxfmt. Every new contributor will meet it (follow_on).
