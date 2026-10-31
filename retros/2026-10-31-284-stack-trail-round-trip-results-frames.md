# Retro: #284 + #283 stack trail round-trip, one results level per frame

## 1. Summary

#284 asked for `StackTrail.toString`/`fromString` to round-trip (escape `%` as `%25`) and for `manifest.results` to nest by stored frames, not by splitting the key on `:`. The folded #283 asked Generate to push one frame per part (`[path, method]`, `['webhook', name, method]`, `[rootKind, fieldName]`, `refName`, then `['variant', v]`). Both were delivered in PR #290 (squash f7b80c9f) with release core 0.34.0. Publish and Test Coverage are green on main.
Run `2026-10-31-scwkr7`: 1h 16m (5m 56s waiting on the operator); 20.4k input, 45.2M cached and 212k output tokens; est. $19.19.
The costliest steps were implement ($6.96) and review ($6.82). The review was worth it: it found a real regression (prototype-named frames dropped and written onto `Object.prototype.toString`), two wrong doc examples and two stale pages. Address and check ($4.62 together) went mostly on making the release commit again after main moved twice.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Main released core twice while this PR was open (#287/#289 → 0.32.3, then #296 → 0.33.0). Each time the PR conflicted in the release files, and I had to merge main, take main's side and redo bump, api-surface, the skill pins and bump-plugin (0.33.0 became 0.34.0). | 2 address rounds + 2 check visits (~15m, ~$3.5) | workflow | implement-ticket-dg: make the release commit in the merge step, right after merging main, not in implement. A feature PR then never carries release files that go stale. | [#293](https://github.com/skmtc/skmtc/issues/293) (comment) |
| The ticket's Decided "lodash `set` stays" did not consider document names as keys. `set` drops `constructor`/`__proto__`, walks into `toString`/`valueOf` and writes onto the built-in, and makes arrays that lose named siblings. My self-review saw only part of this and deferred to the decision; the reviewer reproduced it end to end. | 1 review round (should-fix), ~6m fix | ticket | `orbital-ticket-prep` skill: when a fix makes user-controlled names into object keys, the Context must name how the keys are written (own-property, not a path library). | triage |
| `docs/reference/cli/generate.md` and `skip-or-include-operations.md` gave `@skmtc/gen-zod` (a model generator) as the example of a failed operation. | 2 should-fix threads | navigation | `docs/skills/skmtc-cli/reference.md`: add a table of the stock generators and their entry kind (model / operation / webhook), so an example can be checked. | triage |
| Two pages outside the ticket's doc list still described the old results shape (`explanation/error-handling-philosophy.md`, `skills/skmtc-architecture/SKILL.md`). Ticket prep and my self-review missed them; the reviewer found them. | 1 should-fix thread | check | `.scripts/verify-docs`: add a check that fails on old results-key tokens (`%3A` in a results example, `query_<name>` keys, `identifier →`) in `deno/docs/**`. | triage |
| The `defineProperty`-versus-assignment guard in `toTree` cannot be shown in Deno, which has no `__proto__` accessor. The npm build (dnt) runs on Node, where plain assignment would set the prototype. | ~3m; one mutation that cannot fail | check | core: run `helpers/ResultsLog.test.ts` under Node in the dnt build (`deno task build` test step), so prototype behavior is tested where it ships. | triage |
| The worktree root path ends in `/deno` and holds a `deno/` subdirectory. My first `cd ..` left the repo, `git` failed, and cwd-relative `oxfmt` once matched no files. | ~2m | navigation | implement-ticket-dg prompt: state the repository root and that packages live under `deno/`. | none: minor, prompt-only |

## 3. Keep

- The remove-the-line proof by swapping in `git show HEAD:<file>`, running the new tests, then restoring. It is already noted in retro #181; it should go into the implement prompt.
- Assert the whole `manifest.results` tree through `toArtifacts` (`run/toArtifacts.results.test.ts`), not helper-parsed captures. Worth adding to `docs/skills/skmtc-debug` as the way to pin results shape.
- When main moves, take main's side of every file of the old release commit (`git show --name-only <release> | xargs git checkout origin/main --`), then rerun the tasks. This belongs in the root `CLAUDE.md` "Releasing" section.

## 4. Deferred

- `deno/core/context/StackTrail.ts` `trace`/`traceAsync`: they pop frames from a clone that is then thrown away, so anyone who keeps the `st` from inside the callback sees a cut-down trail. Met by a generator author who stores the trail. Source: https://github.com/skmtc/skmtc/pull/290#issuecomment-6544394359
- `deno/docs/reference/manifest-format.md:214-229` says `results.SKIPPED` means "no matches", but `ResultsHandler.ts:116` records every logged warning or error there. Met by anyone who reads `--json` `errors` (an extra `["SKIPPED"]` entry). #274 is the natural place to decide it. Same source.
- `apps/vscode/src/results/toResultsNodes.ts:75` joins node IDs with an unescaped `:`, and frames can now contain `:`. A collision needs a method containing `:`, so the risk is low. The ticket puts this reader out of scope.
- `ResultsLog.toTree` leaves out a result captured at the empty trail (`[]`). On main it was recorded under `''`. Real trails always carry trace and span frames, so nobody meets it today.
- `ResultsLog` stores frames next to the `toString()` key, which the reviewer and self-review called redundant now that `fromString` exists. The ticket decided `{frames, result}`, so it is kept.
- Nit left: `console as unknown as Logger` cast in `core/context/ParseContext.test.ts` (new `log` test). It follows the file's existing pattern.
- Follow-ups the ticket names: skmtc/skmtc-hub#2380 (subject counts under `generate[gen][*]`) and skmtc/skmtc-generators#84 (gen-effect-schema assertions after its core pin moves past 0.31).
