# Retro: #161 — generate rebuilds bundle.js on every run

Run `2026-09-28-dyfsb1` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** `bundle.js` was saved in the project and reused by later
commands, so `generate` could run a bundle built from older pins or older
generator code. That caused two problems. #158's two-core check read the
`// <module path>` comments inside `bundle.js`, an undocumented Deno output
format. The freshness check (#156) compared only generator ids, so a pin
change left the old bundle in use. The ticket's decision:

- `generate` rebuilds the bundle on every run, with no cache.
- Remove the comment reader, the freshness check and doctor's `bundle.js`
  source.
- Decide, for each other place that runs a saved bundle, whether it should
  build first or no longer needs one.
- Stop the docs and skills telling readers to run `skmtc bundle` after pin
  or source edits.

**Delivered.** PR #168, squash-merged as `4d0c6c75` and released as
`@skmtc/cli` 0.9.53. `@skmtc/vite` 0.9.2 and skills plugin 0.1.10 went out
with it. #161 and #156 are closed.

- **In-place builds** (`generate`, `dev`, `bundle`, `clone`, `install`):
  `deno bundle` writes to `.settings/bundle-<uuid>.js`, which is renamed
  over `bundle.js` only when the build succeeds. Each command runs the path
  its own build returns.
- **The graph check refuses** two copies of `@skmtc/core` or of a
  `@skmtc/lang-*` package, and also a graph it can't read.
- **Read-only builds** (`describe`, `status`, `clean`): the new
  `createReadOnlyBundle` builds in a temporary directory with
  `deno bundle --frozen` and a 20s limit, and writes nothing to the
  project.
- **Removed:** the `bundle.js` comment reader, `bundle-freshness.ts`, and
  doctor's `project-bundle` check.
- **Docs:** about 35 docs pages and the skmtc-cli and skmtc-debug skills
  were updated.

**Verified.**
- CI on the merge commit passed: coverage, and tests-windows at 3349/3349.
- After the merge, the published `jsr:@skmtc/cli@0.9.53` was run against
  real jsr.io packages in a scratch project. It checked each acceptance item:
  - a saved `bundle.js` that throws is never run;
  - a gen-typescript pin change from 0.2.9 to 0.2.8 applies with no
    `skmtc bundle`;
  - `@skmtc/worker@0.3.55`, which brings core 0.28.7, exits 1 with the #158
    message;
  - an edited cloned `toExportPath` shows up in the next generate;
  - `status` and `describe` leave every project file's hash unchanged.

**Cost.** 3h 07m wall clock, 786 uncached input and 287,870 output tokens,
about $5.76 at reference prices. Real cost is higher because cached input is
excluded. Two hours of that were `check` (1h 11m, $2.08) and the
`pr_blocked` gate (1h 00m, waiting on a person).

## 2. What was surprising, unexpected or problematic

1. **Third run in a row where the first implementation passed every check
   and was still wrong.** `implement` (16m, $1.76) finished with 3322 green
   tests. Review then posted 14 findings, two of them HIGH:
   - **`generate` crashed when it had a valid schema.** It called
     `Project.open`, which also loads `client.json#source`. A missing or
     unreachable source crashed `generate` even with a working schema on
     the command line (`Uncaught NotFound at project.ts:343`). The reviewer
     reproduced it. It worked before the PR.
   - **Concurrent commands raced on shared files.** `generate`, `describe`,
     `status` and `clean` all deleted and rewrote the shared `bundle.js`,
     `worker.ts` and `deno.lock` in place. The Vite preview plugin
     (`packages/vite/src/plugin.ts`) runs `describe` outside its generate
     queue, so one command could delete or half-write the bundle another
     was loading.
2. **I changed documented contracts instead of keeping them.** `status`,
   `clean` and `describe` were documented as read-only and never contacting
   JSR. The first implementation made them rebuild `bundle.js` in place.
   I raised this in the implementation summary as "for review", then chose
   the option that broke the contract. Four more findings followed from
   that one choice:
   - `clean --dry-run` wrote files;
   - no timeout on a cold cache;
   - the Vite describe cache cleared itself;
   - stale "read-only" claims across the docs, `cli-schema.ts` and
     `mod.ts`.

   The eventual fix, a read-only build in a temporary directory, took one
   scratch test to prove. It could have been the first design.
3. **The review fix caused a regression.** To close "nothing checks the
   bundle when the graph is unreadable", `address` made `toGraphRefusal`
   refuse an `unavailable` graph. I didn't re-read its callers. `commands/debug.ts`
   calls it before any `worker.ts` exists, and `worker.ts` is gitignored,
   so `skmtc generate --debug` failed on every fresh checkout. The reviewer
   found it, fixed it in `3c19b1c8` with a harness-shaped temporary entry,
   and kept the thread open until then.
4. **Windows broke the new read-only build, and only CI could see it.**
   `createReadOnlyBundle` passed absolute entry paths to `deno info` and
   `deno bundle`. On Windows, `deno info` then found no `@skmtc/core`, so
   every build was refused: 30 failures in tests-windows. The reviewer fixed
   it in `375b1262` by running from the entry's directory with a relative
   name, as main already did. The pre-push hook runs on macOS and can't
   catch this.
5. **Version bumps collided with main three times.** `check` spent part of
   its 71 minutes merging main twice (#166, #169, #172, then #174), across
   seven conflicts. It also re-bumped:
   - `@skmtc/cli`: 0.9.51 → 0.9.52 → 0.9.53;
   - skills plugin: 0.1.7 → 0.1.8 → 0.1.10.

   Every PR that changes a published skill or the CLI bumps the same lines,
   so parallel runs always conflict.
6. **The PR description went stale and nobody was allowed to fix it.** After
   `address` changed the design, the description still said "`createBundle`
   deletes `bundle.js` first" and "status and clean rebuild `bundle.js`".
   Three steps (`address`, `check`, `merge`) each flagged it, and none was
   allowed to edit it. It merged stale. The squash commit uses the commit
   list, so the damage is limited to the PR page.
7. **Small tooling friction.**
   - The worktree root is named `deno` and contains `deno/`, which cost a
     few failed `cd cli` commands at the start.
   - The worktree has no `node_modules`, so oxfmt came from the main
     checkout. That version wanted to reformat untouched lines in four
     files, which I reverted by hand.
   - zsh doesn't split an unquoted `$FILES`, so
     `oxfmt --check $FILES` reported "no target files" twice before I
     switched to `xargs`.

## 3. How each could have been prevented, and by whom

- **Contract changes (2.2): the agent.** When a ticket says "decide
  whether it builds first", and the command's docs promise read-only
  behavior, the default should be to keep the promise and find the design
  that does. "Change the contract and flag it for review" should not be the
  default. A scratch run of `deno bundle --frozen --config <project>
  -o <tmp> <tmp>/worker.ts` took 0.8s and settled it.
- **The ticket** could have said "commands documented as read-only stay
  read-only". Its list of call sites to check was accurate, but it named
  files, not contracts.
- **Concurrency (2.1): the agent.** Before changing when a shared artifact
  is written, search for every consumer, not only the CLI. `grep -rn
  bundle.js packages/` would have found the Vite plugin's watcher and its
  unqueued `describe`.
- **The regression (2.3): the agent.** After changing a shared function's
  behavior (`toGraphRefusal` going from permissive to refusing), list its
  callers (`grep -rn toGraphRefusal`) and ask what each one passes. Three
  callers; one of them broke.
- **Windows (2.4): the repository.** Add one line to `deno/cli/CLAUDE.md`:
  "Pass `deno info` / `deno bundle` a relative entry and set `cwd`;
  absolute Windows paths lose `@skmtc/core` in `deno info`." The pattern
  already existed in main, and the new code didn't follow it.
- **Bump collisions (2.5): the workflow.** Bumping the CLI and the plugin in
  the PR means every parallel run conflicts on the same three files. Other
  options:
  - bump in a merge-time step (the `merge` agent already re-checks main);
  - let the Publish workflow compute the next patch for a package whose
    source changed.

  Until then, `check` should expect to re-bump and not count it as a
  defect.
- **Stale PR description (2.6): the workflow.** Authorize `address` (or
  `check`) to update the PR body when the design changes. Three agents
  saw the problem, and the cost of fixing it was one `gh pr edit`.

## 4. What worked well and should become regular practice

- **The fake JSR registry**
  (`cli/tests/mocks/jsr-registry-server.mock.ts`, from #158) made every
  acceptance item an end-to-end test that runs real `deno info` and
  `deno bundle` offline:
  - two cores are refused;
  - an older CLI's two-core bundle is never run;
  - a same-id pin change (gen-a 0.1.0 → 0.1.1) is picked up;
  - edited clone source runs;
  - a read-only build leaves the project's file snapshot unchanged.

  This time I extended the registry per test (a `patchRegistry` with
  gen-a 0.1.1) and didn't mutate the shared fixture.
- **A scratch experiment before a design change.** One throwaway test proved
  that `--frozen --config` with an out-of-tree entry resolves workspace
  members and leaves `deno.lock` byte-identical, before any code changed.
  The whole read-only design rests on that.
- **Replies that give evidence.** Every thread got the commit and the test
  name that covers it. That let `check` resolve 13 threads quickly and focus
  on the one that wasn't settled.
- **Post-merge verification against the published package.** Running
  `jsr:@skmtc/cli@0.9.53` against real jsr.io, with a stale bundle, a pin
  change, a two-core worker pin and an edited clone, checked what users
  actually install, not the source tree.
- **The reviewer fixed small regressions directly** (debug entry, Windows
  path, merges) instead of sending them back. That saved at least one full
  address round.

## 5. Where the effort went, and whether it was worth it

| Step | Time | Output tokens | Cost | Worth it? |
| --- | ---: | ---: | ---: | --- |
| implement | 16m | 88k | $1.76 | Mostly. About 40% went on the docs sweep (~35 pages, two skills), which verify-docs requires. The code design was the weak part. |
| address | 17m | 73k | $1.47 | Yes, but it paid for the design in 2.2. A read-only build in the first pass would have removed about six of the 14 findings. |
| check | 1h 11m | 104k | $2.08 | Partly. The debug and Windows fixes were real work. The two merges from main and three re-bumps were overhead from the bump model (2.5). |
| pr_blocked | 1h 00m | – | – | Waiting on a person across two visits. The largest single block of wall clock. |
| review | 12m | 4k | $0.08 | Very high value per token: 14 findings, one reproduced, and both HIGH findings real. |

The run cost about 1.4× the #153 run ($4.15). Most of the extra went to
rework caused by decisions, not by missing knowledge: the contract change,
the unchecked callers, and the absolute paths. Each of these has a
checklist-sized fix in section 3.
