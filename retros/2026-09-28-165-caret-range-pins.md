# Retro: #165 — publish @skmtc/* dependencies as caret ranges

Run `2026-09-28-6cpl5h` of `implement-ticket-dg`, 2026-09-28.

## 1. Objective and summary

**Asked.** Every published `@skmtc` package pinned its `@skmtc/*`
dependencies to exact versions. Two packages released a patch apart
therefore loaded two copies of core, and generation wrote empty files (#153).
The ticket asked for four things:

- Published packages declare `@skmtc/*` dependencies as caret ranges.
- The cascade and `deno task bump` write those ranges and still move the
  lower bound forward.
- The project `deno.json` that the CLI writes keeps an exact core pin, "so
  the project decides the one version".
- Before switching, confirm `deno bundle` and an existing `deno.lock` with a
  test, and stop if either gives two copies with overlapping ranges.

**Delivered.** PR #166, squash-merged as `d562437f` and released as
`convert@0.1.18`, `lang-typescript@0.12.23`, `worker@0.3.57`, `server@0.3.6`
and `cli@0.9.51`, with the skills plugin at 0.1.9.

- `rewriteDepVersion` in `.scripts/release.ts` writes `^<new version>`.
  Workspace pins are now ranges.
- The CLI's pin readers are one `readCliLowerBound`. It returns the lower
  bound of the CLI's own range, so project pins stay exact.
- The generated `worker.ts` and `server.ts` now `import '@skmtc/core'`. This
  was added in `address`; without it the project pin never enters the graph
  (see 2.1).
- doctor's `install-lockfile` check reads the resolved version through
  `toLockedVersion`.
- The skmtc-model skeleton pins ranges. skmtc-generator, skmtc-architecture
  and skmtc-debug Scenario H describe the range rule.

**Verified.**
- The pre-switch check ran in a scratch test against the fake registry, on
  Deno 2.9.5: `deno bundle` gives one core with and without an existing lock.
  With a lock, Deno moves the locked `^0.x.0` entry up rather than adding a
  copy.
- Eight fake-registry bundle tests. A mutation check shows three of them fail
  without the core import.
- `deno task check`: 3340 passed.
- After the merge, `jsr:@skmtc/cli@0.9.51` ran end to end with
  `gen-typescript` and `gen-zod` 0.2.7. The project got exact pins,
  `bundle.js` held one core, both generators wrote output, and doctor was ok.

**Cost.** 50m 00s wall clock, 336 uncached input and 122,046 output tokens,
about $2.44 at reference prices. Real cost is higher, because cached input is
excluded. This is about 60% of the #153 run's cost and 30% of its wall clock.
There were no gates and no CI loop.

## 2. What was surprising, unexpected or problematic

1. **`implement` had evidence that contradicted the ticket's premise, and
   wrote docs asserting the premise anyway.** In my first scratch run, case
   A2 pinned the project root to core 0.29.0 next to a generator on
   `^0.29.1`. The bundle ran 0.29.1, so the root pin was ignored: `worker.ts`
   never imports `@skmtc/core`.
   - I recorded this as a "finding" in the implementation summary and the
     PR body.
   - In the same commit I wrote "the project decides which core runs" into
     the comments in `release.ts` and `readCliCorePin` and into the
     skmtc-architecture skill.
   - The review raised it as two HIGH findings. One was the false claim.
     The other was its consequence: a ranged worker next to an exact-pinned
     stock generator gives two cores once a newer core patch exists, which
     is a regression that `skmtc bundle` would refuse.
   - The fix was one line in each template (`import '@skmtc/core'`). This is
     the third run in a row (#149, #153, #165) where the first
     implementation passed every check and review found a HIGH defect.
2. **Where the ticket's evidence table came from.** The table in #165 shows
   "root pin 0.29.0 → resolved 0.29.0". That only holds when root code
   imports core, which the author's scratch evidently did and a CLI project
   did not. The ticket stated "an exact pin in the root `deno.json` decides
   which one" as a Deno fact rather than as a property of that scratch
   setup.
3. **My first lockfile scratch tested nothing.** The fake registry already
   served core 0.29.1 when the first bundle ran, so the "locked 0.29.0"
   state was never created: every lock read `0.29 → 0.29.1`. Reading the
   printed lock `specifiers` exposed it. The fix was a staged registry that
   publishes 0.29.1 and the newer generator between the two bundles, which
   is what the committed lockfile test does.
4. **Review finding 4 conflicted with the ticket, and a policy tension is
   still open.** The reviewer suggested rewriting a dependent's range only
   when the new version falls outside it. The ticket says to "still move the
   lower bound forward", so I declined, and the checker agreed. But with the
   core import in place, the ratchet has a cost:
   - Every generator released after a core patch needs `^0.29.N`.
   - A project whose pin is older is refused at `bundle` until someone
     raises the pin by hand.
   - `ensureWorkerDeps` never moves an existing pin, and `install` doesn't
     either.

   This is no worse than before (exact pins gave two copies in the same
   case), but it is friction that ranges could have removed.
5. **The skmtc-generators follow-up doesn't exist yet.** The ticket says
   "separate ticket there", and the PR, the review, the merge summary and
   the ticket comment all repeat it. No issue exists in
   `skmtc/skmtc-generators`.
   - This matters for sequencing. When core 0.29.1 releases, the cascade
     moves the CLI's lower bound to 0.29.1.
   - New projects then pin 0.29.1, while `gen-zod`/`gen-typescript` 0.2.7
     still pin core 0.29.0 exactly, which gives two copies.
   - The stock generators need ranges before, or together with, the next
     core patch.
6. **Repeated tooling friction, all of it already listed in the #153
   retro:**
   - **oxfmt:** it reflowed three unrelated pre-existing lines in
     `doctor-headless.ts` twice (in `implement` and `address`), plus two in
     `doctor-headless.test.ts`. I reverted them by hand each time.
     `oxfmt --check deno/cli/lib/*.ts` lists nine files that aren't
     oxfmt-clean on `main`.
   - **bump-plugin:** the skills plugin went 0.1.6 → 0.1.7 (implement) →
     0.1.8 (address) → 0.1.9 (check), so one PR used up three versions.
   - **`skmtc install`:** it takes one comma-separated argument.
     `install @skmtc/gen-typescript @skmtc/gen-zod api` failed with "Too many
     arguments" for the third run running.
   - **zsh:** `S="deno run …"; $S …` failed because zsh doesn't word-split.
     I needed an array.
   - **Dependency-age gate:** the skeleton test and the published-CLI run
     both needed `--minimum-dependency-age=0`, because the packages were
     minutes old. The skeleton's first `deno test` failed with "Could not
     find version … '^0.29.0'" before I remembered the gate.
7. **`@std/semver` 1.0.8 has no `rangeMin`.** The reviewer suggested
   `parseRange` + `rangeMin`, but it isn't exported. `canParse` on the
   caret-stripped value was the substitute.
8. **The live check couldn't reach the ticket's case.** jsr.io has only core
   0.29.0 in the 0.29 line, so "released a patch apart" can only be observed
   against the fake registry until the next core patch ships.

## 3. Prevention and mitigation

| Problem | Who | Mitigation |
| --- | --- | --- |
| Shipped a claim my own scratch disproved (2.1) | Agents (implement) | When a scratch result contradicts the ticket's premise, stop and resolve it before writing any docs or comments that restate the premise. Either make the premise true, as the one-line import did, or report `blocked`. "Worth noting" in a summary is not resolution. |
| Third run with a HIGH in review (2.1) | Workflow | Add to the `implement` prompt: "List every claim your comments and docs make about runtime behavior, and point each to a test that proves it." The claim here had no test until `address`. |
| Ticket evidence from an unstated setup (2.2) | Ticket author | Attach the scratch (or its `worker.ts`) to evidence tables, or say what the root code imports. |
| Lock scratch that locked nothing (2.3) | Agents | For lockfile scenarios, print the lock `specifiers` after the first step and assert the locked version before changing anything. Stage the registry so newer versions appear only after the first resolve. |
| Ratchet vs anchor tension (2.4) | Ticket author | Decide whether the cascade should skip in-range patches, or whether `install` should raise the project core pin when a generator needs more. Either removes the manual pin edit. |
| Missing skmtc-generators ticket (2.5) | Ticket author / workflow | Open it now, and land it before the next core patch. The workflow's `close_ticket` step could check that "separate ticket" references resolve to a real issue. |
| oxfmt churn, again (2.6) | Repo | Run oxfmt repo-wide in its own PR, as proposed in the #153 retro. It cost hand reverts in two steps this run. |
| Plugin skipped two versions (2.6) | Repo | Make `bump-plugin` re-record the digest without bumping when the recorded version is unpublished (also from the #153 retro). |
| `install` multi-argument slip (2.6) | Repo / agents | Accept space-separated generators, or name the comma syntax in the "Too many arguments" error. The skmtc-cli skill could show the comma form. |
| Age gate on fresh packages (2.6) | Agents | Pass `--minimum-dependency-age=0` from the start when verifying packages published by this run. `deno/CLAUDE.md` already documents the gate. |

## 4. What worked well

- **Reusing the #158 fake JSR registry.**
  `cli/tests/mocks/jsr-registry-server.mock.ts` needed only a new
  `toPatchApartRegistry()` factory and a looser `generatorVersion` type. The
  whole pre-switch confirmation, and every new bundle test, ran real
  `deno bundle` offline in under a second each. Building that mock in #153
  paid off within a day.
- **Confirming before switching, as the ticket required.** Seven scenarios
  (A–F plus a baseline) in one scratch test showed the baseline two-copy case
  and the one-copy cases in about a minute. The staged-registry version
  answered the lockfile question.
- **Mutation checks by both author and reviewer.**
  - Replacing the mock's ranges with exact pins made both original bundle
    tests fail.
  - Removing `import '@skmtc/core'` made three of the revised tests fail.
  - The checker repeated the second check independently.
- **Reproducing before posting in review.** The reviewer confirmed both HIGH
  findings with throwaway bundles, then named the fix (the core import) in
  the comment. `address` applied it directly. Review cost $0.06.
- **Declining a review suggestion with the ticket's own words.** Thread 4's
  reply quoted the Expected and Acceptance lines. The checker accepted it
  without another round trip.
- **Verifying the published artifact from outside the repo.** `follow_on`
  read the published `deno.json` and `_meta.json` module graphs from jsr.io,
  then ran `jsr:@skmtc/cli@0.9.51` in a temp project with generators that
  are still exact-pinned. That is the real mixed case, and it showed one
  core.
- **Testing the skeleton in a temp copy** before changing its pins: 6 passed
  on `^0.29.0` / `^0.12.22`. Plain `^0.28.3` would never have matched a
  project pinned to 0.29.

## 5. Where the effort went

- **`implement`: 8m 49s, 43,460 output tokens, $0.87 (36%).** About half
  went on the two scratch runs, and the rest on cascade tests, pin
  conversion, the bump and docs. Worth it, except for the unresolved A2
  finding (2.1), which produced most of `address`.
- **`address`: 10m 35s, 38,602 output tokens, $0.77 (32%).** Two HIGH
  findings led to a design change (the core import), three rewritten and
  three new bundle tests, `toLockedVersion`, `toLowerBound`, the skeleton
  test and the Scenario H rewrite. Three graph-check expectations moved
  because `worker.ts` now shows as an importer. Roughly half of this was
  avoidable if `implement` had acted on A2. The remaining findings (lock
  display, reader duplication, typing) were cheap.
- **`check`: 9m 45s, $0.43.** The checker re-ran the mutation check and
  fixed three stale comments plus the generator-skill wording. That is
  worthwhile for a design change made after review.
- **`review`: 12m 02s, $0.06.** The highest value per dollar in the run.
- **`ci_main` (4m 15s, $0.03), `follow_on` (1m 20s, $0.13), `open_pr`,
  `merge` and `close_ticket` (about 3 minutes combined):** proportionate.
  CI and Publish were green on the first run.
