# Retro: #171 — `skmtc install` with two generators failed with "Too many arguments"

Run `2026-09-28-9nq715` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** Three delivery retros (#149 §2.8, #153 §2.7, #165 §2.6) hit
"Too many arguments" when passing two generators to one `skmtc install`,
although the command's usage text, its recipe example and `init`'s
`Next:` hint all show `skmtc install <generators...> <project>`. The
ticket asked for the cause to be found first by reproducing with the
published CLI. Then the usage text, `init`'s hint and the command's
behavior had to agree, with a test.

**Cause.** `deno/cli/mod.ts` registered
`[generators:string[]] [project:string]`. Cliffy's `string[]` type is
*one* comma-separated argument, so only `a,b my-api` parsed. I reproduced
this on the published `@skmtc/cli@0.9.51` (and a cached 0.9.47) in text,
`--json` and `--no-input` modes within the first few minutes.

**Delivered.** PR #174, squash-merged as `01969dab` and released as
`@skmtc/cli@0.9.52`.

- `install` takes every positional as one variadic
  (`[generators-and-project...:string]`). `toInstallArguments` in
  `lib/install-arguments.ts` splits the values by shape: a JSR specifier
  (`@scope/name`, optionally `jsr:`-prefixed) is a generator, and the one
  other value is the project. The comma form still works.
- A missing project gives the `<project>` recipe error in strict mode and
  the picker in interactive mode. An unknown project gives
  `project "…" not found` (exit 2) or the picker. More than one project
  candidate exits 2 and names them.
- `install -h` usage comes from the `cli-schema` descriptor, so it
  matches `agent-context`. The strict-mode usage and example are one
  constant.
- Interactive install no longer turns `jsr:@x/y` into `jsr:jsr:@x/y`
  (`toJsrModuleName`, shared with the headless path).
- `toInstallCommand(action)` in `commands/install-command.ts` builds the
  command that `mod.ts` registers, so tests parse through the real thing.
- `reference/cli/install.md` states the split rule. The 2026-05-20
  friction-log entry is marked `resolved 2026-09-28 (PR #174)`.

**Verified.**
- Full CLI suite: 723 passed.
- Mutation checks: the parse tests fail with "Too many arguments: my-api"
  against the old spec. The new Ink view test fails with
  `Invariant failed: Project is required` without the view fix.
- `deno task verify-docs` passes, and the pre-push `deno task check`
  passed twice.
- After release, the published `jsr:@skmtc/cli@0.9.52` in a fresh
  workspace: the ticket's command installs both generators and rebundles.
  `--json` and the comma form work. All four misuse cases exit 2 with a
  recipe message, and the help text agrees with `agent-context`.

**Cost.** 1h 20m wall clock, 290 uncached input and 78,515 output tokens,
about $1.57 at reference prices (real cost higher; cached input
excluded). Cheaper than #165 ($2.44) but longer (80 minutes against 50).
Most of `check`'s 22 minutes was waiting for a CI runner, not work.

## 2. What was surprising, unexpected or problematic

1. **The first implementation passed every check, and review found two
   HIGH defects.** This is the fourth run in a row (#149, #153, #165,
   #171) where that happened.
   - I split the positionals by *position*: the last one is the project,
     and a single one is the generator list. I tested the happy path, the
     flags and the comma form, and ran one end-to-end install.
   - I never ran the obvious misuse: generators with the project
     forgotten. The reviewer did.
     `install @skmtc/gen-zod @skmtc/gen-typescript --no-input` took
     `@skmtc/gen-typescript` as the project and crashed with an uncaught
     invariant and stack trace. The same misparse crashed the interactive
     view during render.
   - Before the PR, three space-separated generators at least failed
     *cleanly* with "Too many arguments". My change turned a clean
     failure into a crash for that input.
   - I had even noted in the implementation summary that a reversed call
     (`install my-api @skmtc/gen-zod`) ends in the invariant error. I
     deferred it as "not in scope" instead of recognizing the same class
     of bug.
2. **The bug was diagnosed four months earlier and stayed open.**
   `docs/friction-log/2026-05-20-clone-generator-version-skew.md` entry 1
   described this exact failure, cause ("parses `install` as exactly two
   positionals") and fix options against `@skmtc/cli@0.3.4`, with status
   `open`. Three retros on 2026-09-28 then hit it again, one of them
   ("for the third run running") before a ticket was filed. The
   friction-to-ticket loop did not fire on a precisely diagnosed,
   small fix.
3. **I introduced a second source of truth for usage text.**
   `cli-schema.ts` calls itself the "Single source of truth for the SKMTC
   CLI's command surface". I still added a hand-written
   `INSTALL_USAGE = '<generators...> <project> [options]'`, which marked
   both arguments required while the descriptor and the reference page
   said optional. The ticket was about text and behavior disagreeing, and
   my first pass added a new disagreement.
4. **Cliffy constraints I had to discover by experiment.**
   - A variadic must be the last argument ("An argument cannot follow an
     variadic argument").
   - `.usage()` only changes `install -h`. The root `skmtc -h` listing
     prints the raw `.arguments()` definition, which is why the first
     version showed `install [arguments...]`.
   - The final name `[generators-and-project...]` is the best available,
     and a little awkward.
5. **`mod.ts` makes commands hard to test.** It builds every Cliffy
   command inline inside `run()` and calls `run()` on import, so a test
   cannot import the real command. My first tests built their own
   `Command` with a copied argument spec, and review flagged it. The CLI's
   `CLAUDE.md` describes a "`to<Command>Command()` returns Cliffy Command"
   pattern, but `mod.ts` does not follow it. `install` is now the only
   command that does.
6. **Dependency-age gate, as documented.** `deno run jsr:@skmtc/cli`
   (unpinned) silently ran a cached 0.9.47. Pinning 0.9.51 hit the 24-hour
   gate and needed `--minimum-dependency-age=0`. This is known in
   `deno/CLAUDE.md` and cost a couple of minutes. It is still a trap every
   time a repro runs against the newest release.
7. **Pre-existing noise on `main`.** `oxfmt --check` flags `mod.ts` for an
   unrelated `create` option. `deno lint` flags an unused `command`
   parameter in `formatMissingArgError`. Both appeared in my checks and
   had to be ruled out as mine each time.
8. **My own slip: an interactive git command in a non-interactive
   shell.** While reverting a scratch mutation I ran `git checkout -p --`,
   which is interactive. It printed the first hunk prompt and exited on
   empty stdin, so nothing was discarded. I confirmed with
   `git status` / `git diff --stat`. Reverting with `sed` or a file copy,
   as I did next, is the safe pattern.
9. **The user asked "are you stuck?" during `ci_main`.** I had started
   `gh run watch` in the background with a 30-minute fallback, and said
   so. But nothing showed progress for minutes, and the previous Test
   Coverage run had taken 31 minutes because of runner queueing. This
   run's took about 3.5 minutes.

## 3. Prevention and mitigation

| Problem | Who | Mitigation |
| --- | --- | --- |
| Misuse cases not run before handoff (2.1) | Agents (implement) | For any change to argument parsing, list and *run* the misuse matrix before handing off: each required argument missing, arguments reordered, one extra, an empty-string argument. Every result must be a recipe error, never a stack trace. The reviewer's four runs took minutes. |
| "Not in scope" deferral of a same-class crash (2.1) | Agents | If the new code can still end in an uncaught invariant for some input, it is in scope. Only defer bugs of a *different* class. |
| Friction entry open for four months (2.2) | Repo / retro-review | `skmtc-retro-review` should flag `open` friction entries whose "Possible fixes" name a small, precise change, and file a ticket. Retros that cite a known friction entry should link it, so repeats are counted. |
| Second usage source (2.3) | Agents / repo | When a file declares itself the single source of truth, derive from it. A test that asserts `getUsage()` equals the descriptor now exists for `install`. Extending that assertion to every command would catch drift repo-wide. |
| Cliffy help quirks (2.4) | Repo | A two-line note in `cli/CLAUDE.md`: variadics must be last, and the root help prints the raw `.arguments()` string, not `.usage()`. |
| Untestable inline commands (2.5) | Repo | Move each command to a `to<Command>Command(action?)` factory like `commands/install-command.ts`, as `cli/CLAUDE.md` already claims. Then parse tests go through the registered command. |
| Dependency-age trap in repros (2.6) | Workflow prompts | When a step reproduces with "the published CLI", the prompt could say: pin the exact version and pass `--minimum-dependency-age=0`, then confirm with `--version`. |
| Noise on `main` (2.7) | Repo | Format `mod.ts` with oxfmt, and drop or underscore the unused `command` parameter. Each is one small PR. |
| Visible progress while waiting on CI (2.9) | Agents | When starting a long wait, state the expected duration from the previous run and the in-progress step, not just that a watch is running. |

## 4. What worked well

- **Repro-first with the published artifact.** The ticket insisted on it,
  and it found the cause in minutes. It also settled the ticket's
  either/or: "Either the command takes only one generator, or the retros
  used a different shape". The retros had used the documented shape.
- **Mutation checks for every new test.** Flipping the argument spec back
  with `sed` made the parse tests fail with the original error. Removing
  the view fix made the new Ink test fail with the reviewer's exact
  invariant. This proves the tests pin the behavior rather than just
  passing.
- **A reviewer that runs commands.** Four of the 12 findings (1, 3, 4, 6)
  came with a command and its output. Those were the two HIGHs and the
  two most concrete MEDIUMs. Replies could then quote the same command's
  new output. Keep this.
- **One address commit for all 11 threads, each reply naming the commit
  and the proving test.** `check` could resolve every thread by
  re-running the quoted commands, and the second round had no findings.
- **Classifying by shape rather than position.** It fixed the two HIGHs
  and finding 4 (a lone project read as a generator) with one rule, and
  made argument order irrelevant. Project names are directory entries and
  cannot contain `/`, so they cannot collide with `@scope/name`.
- **Post-release verification on the real artifact.** The published
  0.9.52 was checked with the ticket's own command, not the local source.

## 5. Where the effort went

| Step | Time | Output tokens | Est. cost | Worth it? |
| --- | ---: | ---: | ---: | --- |
| implement | 34m 53s | 17,514 | $0.35 | Partly. The repro and root cause were fast and right. The positional split was the wrong design and caused the rework. |
| address | 7m 57s | 30,257 | $0.61 | Yes, but it was the most expensive step: 39% of the run's cost to redo the core rule, the interactive view, help text, tests and docs. An upfront misuse matrix would have moved most of this into `implement` at lower cost. |
| check | 21m 44s | 12,774 | $0.26 | The work was worth it: it re-ran every reviewer scenario and resolved all threads. Most of the wall clock was waiting for a Blacksmith runner for `coverage`. |
| review | 8m 26s | 3,637 | $0.07 | Very high value for the cost: two HIGHs found by running commands. |
| ci_main | 3m 41s | 2,792 | $0.06 | Routine. Publish and Test Coverage both passed. |
| everything else | ~4m | ~11,500 | ~$0.22 | Routine. |

The rework pattern is now consistent across four runs: `implement` hands
off a change that passes its own tests, and `review` finds a HIGH defect
by running an input the author did not try. Adding an explicit
"run the misuse cases" instruction to the `implement` prompt is the
highest-leverage change this retro suggests.
