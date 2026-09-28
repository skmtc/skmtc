# Retro: #153 — detect two copies of @skmtc/core

Run `2026-09-28-nzxuiz` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** When a project's bundle held two copies of `@skmtc/core`,
`generate` wrote 0-byte files, marked every manifest item `success` and
exited 0, and `skmtc doctor` said ok. The engine's `instanceof` checks fail
across the copies. The ticket reproduced this on the quickstart path with CLI
0.9.47: core 0.28.7 through `@skmtc/worker@0.3.55`, and core 0.29.0 through
gen-typescript and gen-zod 0.2.7. It asked for two things. `bundle` and/or
`generate` should fail, naming the versions and the packages that bring them
in. `doctor` should check the core that the generators, `lang-*` and the
worker resolve.

**Delivered.** PR #158, squash-merged as `03c46666` and released as
`@skmtc/cli` 0.9.50 (skills plugin 0.1.6):

- `bundle` resolves the `worker.ts` graph with `deno info --json` before
  building. On two copies of core or a `lang-*` package it exits 1, names
  each copy and its importers, and restores the previous `worker.ts`.
- `generate` reads the copies from the `bundle.js` it is about to run, using
  the `// deno:<url>` module markers. `generate --debug` checks the graph.
- `doctor` gains `project-package-copies/<project>`, which reads both
  sources. The graph comes from `deno info --frozen`, bounded at 20s;
  `--offline` reads only `bundle.js`; `serverUrl` projects are skipped.
- A copy is identified from any registry host, npm, or a local directory
  with a named manifest.
- Follow-up #159 covers an engine-side check.

**Verified.**
- `deno task check`: 3327 passed.
- The end-to-end tests run real `deno info` and `deno bundle` against a fake
  JSR registry on localhost.
- After the merge, the ticket's repro ran against the published
  `jsr:@skmtc/cli@0.9.50`, covering the one-core, two-core, stale two-core
  bundle and pins-fixed cases.

**Cost.** 2h 48m wall clock, 508 uncached input / 207,378 output tokens,
about $4.15 at reference prices (real cost higher; cached input is
excluded). 55 minutes of the wall clock were a post-merge gate waiting on a
Coveralls outage (see 2.3).

## 2. What was surprising, unexpected or problematic

1. **Second run in a row where the first implementation passed every check
   and was still wrong.** `implement` (41m, $1.41) shipped with 3310 green
   tests and a verified repro. The review then posted 15 comments, five of
   them HIGH:
   - **`generate` checked the wrong thing.** It checked the current graph,
     not the `bundle.js` it was about to run. A stale two-core bundle passed
     once the pins were fixed, and a good bundle was refused after an
     unbundled pin edit.
   - **One unresolvable import hid everything.** The schema required
     `specifier` on each dependency, but an unresolvable import gives
     `{ error }` instead. The whole parse failed and duplicates went
     unseen.
   - **Only `${JSR_URL}` copies were seen.** Copies from `file:`, `npm:` or
     another host were invisible.
   - **`deno info` could hang, even offline.** It had no timeout, yet ran
     inside `generate` and `doctor`, and `doctor --offline` still ran it.
     The reviewer measured a hang of more than 45s.
   - **A refusal left a rewritten `worker.ts`.** The freshness gate then
     reported the old bundle as fresh and silently dropped the new
     generator.

   Several medium findings had the same root: a diagnostic that changed
   state (`deno info` wrote `deno.lock`), `import type` edges counted as
   copies, and "no core found" reported as ok. I tested the happy path and
   the ticket's exact repro. I did not test the environments a diagnostic
   has to survive: offline, cold cache, broken imports, stale artifacts.
2. **The ticket's wording steered the design.** "Detect more than one
   `@skmtc/core` … in the module graph" made the graph the thing to check
   everywhere. For `generate`, the question is what the artifact about to
   run contains. The graph describes what the *next* bundle would contain.
   I followed the letter of the ticket rather than the invariant behind it.
3. **Post-merge CI loop on an external outage.**
   - Coveralls returned HTTP 500 for every upload on every commit, although
     its status page said operational. Test Coverage on `main` was red for
     that reason alone.
   - `ci_main` could only return `needs_you`, which routes through
     `post_merge_needs_you` back to `ci_main`. Each resume re-ran the same
     check against the same outage.
   - `ci_main` ran 4 times and the gate waited 54m 44s. That is a third of
     the run's wall clock, for zero information after the first visit.
   - The operator had to ask "where do I read it?". The summaries weren't
     where they looked, because the links weren't at the top.
   - The loop only broke when the operator asked for the retro and I
     reported `green` with the Coveralls-only failure spelled out. That was
     the right call on the operator's standing instruction, but it bends the
     meaning of `green`.
4. **I misread "do retro".** Mid-`ci_main`, the operator asked for a retro.
   I loaded the `skmtc-retro` skill, a friction-log format, before the
   operator said "not skmtc-retro" and "the retro step". The workflow's own
   `retro` step was meant, and it was unreachable because of 2.3.
5. **Deno behavior discovered by testing, not docs:**
   - `deno info` exits 0 when modules fail to load. The errors sit inside
     the JSON.
   - An unresolvable import appears as `code: { error }` with no
     `specifier`.
   - `import type` edges appear only under `type`.
   - `--frozen` never writes the lock, and exits non-zero when the lock is
     out of date or missing.
   - `deno bundle` output keeps a `// deno:<url>` marker per module.
   - Deno resolves `jsr:@skmtc/core@X` to a local package with the same
     name and version, so a local checkout at the same version is really
     one copy. The end-to-end test had to use a different version to get
     two.
6. **Tooling friction:**
   - oxfmt reformatted unrelated lines in `doctor-headless.ts`, its test and
     `doctor.ts`, because those files weren't oxfmt-clean. I reverted those
     hunks by hand, twice.
   - `deno task bump-plugin` in the address step would have moved the
     plugin to 0.1.7, skipping the unreleased 0.1.6. I reset the three
     plugin files to `main` and re-ran it.
7. **Same CLI slip as #149.** Passing two generators to one `skmtc
   install` fails with "Too many arguments". It happened in follow-on
   verification exactly as it did in the #149 run.
8. **A leaked process.** Early in `implement` I started a scratch
   fake-registry server with `(deno run … &)` and didn't record its PID. It
   is still listening on `127.0.0.1:8765`, and the no-pattern-kill rule
   means I can't stop it.

## 3. Prevention and mitigation

| Problem | Who | Mitigation |
| --- | --- | --- |
| First pass wrong despite green tests (2.1) | Agents (implement) | For any check that gates or diagnoses, run the adversarial matrix before calling it done: offline / cold cache, an unresolvable import, a stale artifact, a type-only edge, a non-registry copy, and "does it mutate state". The reviewer found five of these in 16 minutes with scratch runs; the author can too. |
| Same pattern two runs running | Workflow | Add to the `implement` prompt: "Before committing, list how the reviewer would break this, and test the top three." |
| Ticket named a mechanism ("in the module graph") (2.2) | Ticket / agents | Phrase the invariant, e.g. "never run a bundle with two copies", and let the author choose the source. Agents: ask "what artifact actually runs?" for every gate. |
| CI loop on an external outage (2.3) | Workflow | Give `ci_main` an outcome such as `external` / `waived`: red only on a step outside the change, confirmed failing before the merge too. Let it continue with the caveat attached. `post_merge_needs_you` should also offer "proceed" as well as "retry `ci_main`". |
| CI loop on an external outage (2.3) | Repo | `fail-on-error: false` on the Coveralls step in `.github/workflows/coverage.yml`, so a coverage-service outage never turns `main` red. |
| Operator couldn't find the summary (2.3) | Workflow / agents | Put the run links (Actions run URLs, `gh run view … --log-failed`) in the first lines of `ci_summary`, not in the body. |
| "Do retro" misread (2.4) | Agents | During a workflow run, "retro" means the workflow's `retro` step; check the workflow graph before reaching for a skill. |
| oxfmt churn in untouched lines (2.6) | Repo | Run `oxfmt` once repo-wide in its own PR, so later diffs only touch what they mean to. |
| bump-plugin double bump (2.6) | Repo | Have `bump-plugin` detect that the recorded version isn't published yet and re-record the digest without bumping. |
| Repeated `install` slip (2.7) | Repo / agents | Either accept several generators in `skmtc install`, or name "one generator per call" in the error. |
| Leaked scratch server (2.8) | Agents | Start long-running scratch processes with the tool's background mode or `& echo $!`, record the PID, and stop them before the step ends. |

## 4. What worked well

- **A fake JSR registry for offline end-to-end tests.**
  `cli/tests/mocks/jsr-registry-server.mock.ts` serves `meta.json`,
  `<version>_meta.json` with sha256 checksums, and module files on a random
  localhost port. `JSR_URL` and `DENO_DIR` point at temp locations. The
  real `deno info` and `deno bundle` then resolve fake two-core graphs in
  about 50ms. The address step reused it for the stale-bundle, frozen-lock,
  timeout, local-checkout and restore-`worker.ts` tests, and it would suit
  any future CLI test that needs registry behavior.
- **Reproducing against the real registry before designing.** Running
  `deno info` on the ticket's exact pins first showed the attribution the
  message needed (`0.28.7 ← @skmtc/worker@0.3.55`). The same scratch later
  showed that `deno bundle` keeps per-module URL markers, which made the
  artifact-based `generate` check possible.
- **Proving each test fails without the fix.** The `worker.ts` restore test
  was run with the restore disabled and failed as expected.
- **The review step, again.** It cost 16 minutes and $0.07, and it
  reproduced four findings against Deno 2.9.5 before posting. It also named
  the design flaw (checking the graph, not the artifact) rather than
  symptoms. Keep the "reproduce before posting" bar.
- **Verifying the published artifact.** `follow_on` ran
  `jsr:@skmtc/cli@0.9.50` from a temp directory outside the repo, so no
  lockfile changed. It measured exit codes directly after I noticed a grep
  pipeline had masked one (`exit 0` from `grep`, not the CLI).
- **Opening the engine follow-up instead of widening the PR.** #159 records
  the remaining gaps (remote stack servers, a local copy inside an old
  bundle, engine hosts without the CLI) with file and line references.

## 5. Where the effort went

- **`post_merge_needs_you`: 54m 44s, 4 visits, $0.** Pure waiting, and the
  largest wall-clock item. It produced no information after the first visit.
  This is the cheapest fix available: a workflow outcome for external CI
  failures, plus `fail-on-error: false` on Coveralls.
- **`implement`: 40m 53s, 70,670 output tokens, $1.41.** Most of it went on
  the fake registry and scratch experiments with `deno info` output. That
  was worth it, because both were reused. The design flaw it shipped was
  not worth it.
- **`address`: 17m 54s, 74,206 output tokens, $1.48 (36% of cost).** It was
  effectively a second implementation:
  - a new identity model (hosts, npm, local manifests);
  - the `bundle.js` marker check;
  - the `worker.ts` restore;
  - `--frozen`, the timeout and `--offline` in doctor;
  - docs and 15 thread replies.

  As in #149, most of this was avoidable. The adversarial matrix in §3,
  run during `implement`, would have caught at least four of the five HIGH
  findings. The address step produced more output than `implement` did, on
  a shorter clock.
- **`check`: 27m 13s, $0.64.** The reviewer independently re-verified all
  15 fixes, corrected a stale docs row (`5b4fdf48`), and opened #159. That
  is worthwhile given how much changed between review and merge.
- **`review` (15m 59s, $0.07), `merge` (59s), `follow_on` (2m 27s, $0.13),
  `close_ticket` (33s):** proportionate.
- **`ci_main`: 4 visits, 6m 13s, $0.23.** Three of the four visits were
  repeats caused by the loop.
