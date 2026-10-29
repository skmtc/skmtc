# Retro: #238 `project create` reports `schemaStep`

## 1. Summary

The ticket asked `skmtc project create` to say what it did with `client.json#source`, so that a URL source the CLI did not upload is no longer silent. Delivered in PR #250 (merged as 7d23d982): a new `schemaStep` field on the result (`registered` / `revision-added` / `unchanged` / `url-not-uploaded` / `no-source`), one `  schema:` text line, docs, and CLI 0.10.1. CI on main is green, and the light review raised no findings.
Run `2026-10-29-4cupb2`: 1h 33m wall clock, of which 1h 11m was queued for a slot and 17m 14s was agent time. Tokens: 20,588 input, 6.04M cached, 40,175 output; about $4.22, not counting the forked `/code-review`.
`implement` cost the most ($2.71, 8m 55s). That was worth it: it included the full `deno task check` twice and the mutation proofs, so review and check found nothing to fix.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The git root is the outer worktree directory `deno`, and the Deno workspace is `deno/deno`. My first `cat`/`grep` of `cli/...` failed, and `follow_on` lost two commands the same way. This is the third retro to record it (216, 240). | ~2 min across two steps | navigation | Add a root `CLAUDE.md` line: "the git root holds `deno/`; run every `deno` command from `deno/` (or `deno/<package>`)". | triage (recurring: third retro) |
| `/code-review high` returned 10 findings. 7 restated what the ticket's "Decided" section had already settled: `revision-added` fallback, keep `apiRegistered`, patch bump, refetch rejected, test location. I had to triage each one by hand. | unrecorded fork tokens + ~1 min | workflow | The `implement-ticket-dg` implement prompt should pass the ticket's Decided/Traps to `/review` as args, so it does not re-raise decided scope. | triage |
| In the new URL-source test, `SkmtcRoot.open` fetched the URL before the fetch stub was installed, so the test hit real DNS. The ticket's Traps covered `makeFixture` but not this. | 1 failed test run, ~1 min | ticket | `orbital-ticket-prep` traps for `project-headless.test.ts`: say that opening a project fetches a URL source, so `withFixture` must stub fetch before `SkmtcRoot.open` (now fixed in the file). | none: fixed in code |
| In light_check, removing `schemaStep` from the returned object made no test report FAILED, because the type error aborts the suite. So the JSON-printer item was never shown to fail on its own. | 0 rounds; unproven assertion | review-rule | Reviewer and author mutation rule: run the break with `deno test --no-check` when the break is a type error, so individual tests show. | triage |
| The ticket named "0.9.62 -> 0.9.63", but main was already at 0.10.0 after #240's minor bump. `deno task bump` handled it, but the ticket text was stale. | ~0 | ticket | Ticket-prep: name the bump command, not the version numbers. | none: harmless, bump correct |
| `oxfmt --check` failed on two of my files before the first commit. No edit-time hook formats `.ts`, and `pnpm format:check` cannot gate because main has ~72 unformatted files. | ~1 min | check | Format main once and wire `pnpm format:check` into `deno task check` (skmtc#69). | none: tracked in skmtc#69 |
| I ran a no-op `python3 - <<'EOF'` edit draft against the user rule (edits go through Edit/Write). It changed nothing, but no hook stopped it. | ~0 | check | A PreToolUse Bash hook in `~/.claude-two/settings.json` that rejects `python3 -`/`perl -e` heredocs writing files under the worktree. | triage |

## 3. Keep

- Mutation proofs at two levels: break the assignment, then break the fix's own guard (TS2454, line order), and name each in the summary. The light check reused them and found nothing. Already in the implement prompt.
- Declare a step variable unassigned and set it in every branch, so a missed branch is a compile error rather than a silent default. Worth a line in `deno/cli/CLAUDE.md`.

## 4. Deferred

- `deno/cli/lib/project-headless.ts` `createHeadless` step 3 pins `apiPin: { mode: 'latest' }`. A local file that matches an older revision reports `unchanged` while the project binds the newer one, and a publish between upload and create does the same. A user who reverts their schema meets this on their next `project create`. Fix: pin the revision from the 201 body. Source: self-review on PR #250.
- The same function, URL sources: the CLI never asks the hub to refetch, so `url-not-uploaded` can bind a stale revision. Option 2 of #238, blocked on skmtc-hub#2135.
- `deno/cli/lib/project-headless.test.ts` `makeFixture` repeats the `isUrlSource` regex, because the predicate is not exported. It can drift if the predicate changes. Self-review finding, dismissed in the ticket's scope.
- `printCreateResult` JSON test: no test fails on its own when `schemaStep` is dropped from the result; only the type check catches it. Source: light_check summary.
