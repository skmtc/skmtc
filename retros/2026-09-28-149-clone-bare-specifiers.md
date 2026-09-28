# Retro: #149 — clone rewrites versioned imports to bare specifiers

Run `2026-09-28-gn7g1o` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** `skmtc clone` wrote a generator's source as JSR serves it, and JSR
rewrites every bare import to a versioned specifier on publish
(`from 'jsr:@skmtc/core@0.29.0'`). A cloned generator therefore ignored the
pins in `deno.json`. Moving it to a new core meant rewriting every import by
hand, and a project on a different core ended up with two copies in the
bundle.

**Delivered.** PR #155, squash-merged as `2d5fb9c2` and released as
`@skmtc/cli` 0.9.49:

- `toBareSpecifiers` (`deno/cli/lib/to-bare-specifiers.ts`) finds import
  positions with `@deno/graph`, the analyzer JSR itself uses on publish. It
  rewrites versioned `jsr:` and `npm:` specifiers back to the imports-map key
  or bare name, and leaves conflicting versions versioned.
- The clone's `deno.json` drops every name the project's root `deno.json`
  pins, so the project decides the version.
- Clone writes nothing to the root except the clone itself.
- Docs are updated (`reference/cli/clone.md`, two friction entries resolved).
  Follow-up #156 was opened for the freshness check.

**Verified.** Tests, green CI on `main`, then the ticket's repro run against
the published `jsr:@skmtc/cli@0.9.49`. It left 0 files with versioned imports
(down from 11 files / 19 lines), `deno check` and the rebundle passed, and
the root core pin reached the cloned source.

**Cost.** 50m 43s wall clock, 282 uncached input / 122,611 output tokens,
about $2.45 at reference prices (real cost higher; cached input is excluded).

## 2. What was surprising, unexpected or problematic

1. **The first implementation passed every check and was still wrong.**
   `implement` (11m, $0.44) shipped a regex rewriter and 677 green tests. The
   review then posted 14 comments, four of them HIGH:
   - The ticket's core goal wasn't met. Published pins won in the clone's
     `deno.json`, and Deno gives a workspace member's `imports` precedence
     over the root's, so the project's core pin never reached the clone.
   - The regex rewrote `jsr:` text inside template literals, which silently
     changed generator output.
   - Once imports were bare, a previously dead root-add loop in
     `Generator.clone` came alive. It activated peer generators nobody
     installed (`toGeneratorIds()` counts every `gen-*` root key) and pulled
     in test-only deps.
   - The maintainer asked for `npm:` coverage in the same PR.

   My own test encoded the precedence bug: root gen-zod 0.2.5, clone 0.2.7,
   and it asserted that as correct.
2. **The ticket's suggested fix pointed at the wrong layer.** It said to
   "make sure each bare name is mapped in the clone's `deno.json#imports`".
   I followed that literally, and that is exactly what produced two copies of
   core. The real requirement, one version that the project decides, needs
   the clone to *not* pin names the root pins.
3. **`@deno/graph`'s `parseModule` collapses repeated specifiers.** It
   reports only the first value import and the first type import of each
   specifier. A file importing `jsr:@skmtc/core@0.29.0` three times got one
   position. JSR's `moduleGraph2` lists every occurrence, but it leaves out
   files outside the export graph (tests). I found this through a failing
   unit test, then handled it by re-parsing after each pass.
4. **`@deno/graph` columns are code points, not UTF-16 units.** I caught
   this in a scratch run with `é😀` before a specifier. Each replacement now
   checks the quoted text at the span before writing.
5. **`@deno/graph` instantiates its wasm at import time.** A static import
   in a module that `generator.ts` pulls in would have loaded wasm for every
   CLI command. It is dynamically imported inside the clone path instead.
6. **Poll-loop bug in `ci_main`.** My first background poll's completion
   test (`grep -qv " completed "`) exited while Test Coverage was still
   `in_progress`. I noticed only because the job list came back empty and
   re-polled with `gh run view --json status`.
7. **Verification side effects.** Running `jsr:@skmtc/cli@0.9.49` from the
   worktree added 92 lines to the repo-root `deno.lock`. I caught it at
   `close_ticket` and reverted it. Separately, `deno run -P` (the config's
   `permissions.default`) failed with `NotCapable` on reads, because its
   `read: ["*"]` resolves relative to the config directory. The e2e run had
   to use the scoped flags from `cli/CLAUDE.md` instead.
8. **A wrong `install` invocation during follow-on surfaced a real edge
   case.** I passed two generators positionally, which failed with "Too many
   arguments". Cloning straight after `init`, with no core pin in the root
   yet, leaves the clone pinning core itself, so a later root-only pin
   change won't reach it. It isn't in the ticket's flow, but it is a
   plausible user flow.

## 3. Prevention and mitigation

| Problem | Who | Mitigation |
| --- | --- | --- |
| Precedence bug shipped with green tests | Agents (implement) | Before asserting a resolution rule in a test, prove it with a two-level workspace scratch (`deno info` on the member). The reviewer did exactly this; the author should have. The ticket's "Expected" said "changing a pin there then changes what the clone runs on", which is directly testable end to end and would have exposed the bug in minutes. |
| Ticket prescribed the mechanism, not just the outcome | Ticket | State the invariant ("one core version, decided by the project") and leave the mechanism open, or flag suggested fixes as hints. |
| Dead code revived by the change | Agents | When a change makes a previously never-matching branch reachable (the root-add loop), re-read that branch's consequences. The implement step even noted the loop "never matched" and still kept it. |
| Regex over source text | Agents / repo | Default to the analyzer (`@deno/graph`) for anything about import positions. Consider a note in `cli/CLAUDE.md`: "don't regex TypeScript imports". |
| `npm:` scope found at review | Ticket / agents | The implement step noted `npm:` was baked the same way and deferred it as "out of scope". When the same defect has an obvious sibling, ask or include it rather than defer. |
| Poll loop exit condition | Agents / workflow | Poll on explicit `status == completed` per run, never on negated greps. The workflow prompt could suggest `gh run watch` or a status query. |
| Lockfile churn from verification | Agents / workflow | Run registry-published CLIs from a temp directory outside the worktree (`cd` into the temp project first), or pass `--no-lock`. |
| `-P` permission set unusable from another cwd | Repo | Document in `cli/CLAUDE.md` that `permissions.default` paths are config-relative, or drop the `-P` pretence in favor of the scoped flag list. |
| init→clone edge case | Repo (follow-up) | Pin the CLI's core and worker in the root before clone filters its imports. This is small and could be a follow-up issue. |

## 4. What worked well

- **The review step earned its cost.** For $0.13 and 11 minutes it
  reproduced every HIGH finding with a scratch run (a local two-level
  workspace for precedence, template-literal inputs, a `toGeneratorIds()`
  check). It also pointed at the root-cause alternative (`moduleGraph2`)
  instead of patching the regex. Keep the "reproduce before posting" bar.
- **Scratch experiments before committing to a design.** Short `deno run`
  scratches established each fact before any code was written: span units,
  the `parseModule` collapse, `@ts-types` resolving through the imports map,
  and wasm loading without `--allow-ffi`. Each took under a minute and
  changed the design.
- **Verifying the shipped artifact, not the source.** `follow_on` ran the
  published `jsr:@skmtc/cli@0.9.49` with the scoped permissions. That tests
  what users get, including the wasm dependency under restricted
  permissions.
- **Proving the test fails without the fix.** In `implement` I reverted
  `generator.ts`, ran the new test and watched it fail. It's cheap and it
  catches vacuous tests. It didn't catch a test that asserted the wrong
  behavior, though (see 2.1).
- **Deleting instead of adding.** The address step removed
  `extractImportPaths` and the root-add loop rather than guarding them. That
  fixed three review findings at once.

## 5. Where the effort went

- **`address` was the most expensive step:** 13m 29s, 55,801 output tokens,
  $1.12, 46% of the run's cost. It was effectively a second implementation:
  a new analyzer, a new pin policy, npm support, docs, and 14 thread
  replies. It was worth it, because the first version didn't meet the
  ticket. But most of it was avoidable. An end-to-end check of the ticket's
  own "changing a pin changes what the clone runs on" in `implement` would
  have moved the redesign into the first pass. The same work would then
  have cost around $0.5 there instead of $0.44 + $1.12, and skipped a review
  round.
- **`implement` (11m 20s, $0.44) and `review` (10m 49s, $0.13)** were
  proportionate for their roles.
- **`check` (3m 22s, $0.33)** re-verified edge cases independently. That is
  worthwhile given how badly the first pass missed.
- **`ci_main` (6m 01s)** was mostly waiting on GitHub Actions. The token
  cost was trivial.
- **`follow_on` (2m 05s, $0.19)** was high value for its cost: it found the
  init→clone edge case.
- **Workflow gates added only seconds.** No step waited on a person.
