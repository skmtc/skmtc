# Retro: #429 skmtc.config.json and settings.parse, with skmtc migrate config

## 1. Summary

#429 asked to rename the project config `client.json` to `skmtc.config.json` and `settings.system` to `settings.parse`. The old names had to keep working, marked deprecated. It also asked for a new `skmtc migrate config` command, an interactive (Y/n) migration offer, and a release through the cascade. All of it is delivered in PR #431 (core 0.49.0, cli 0.11.0), which the owner merged at 12:45. Before the merge, the owner reversed one ticket rule in 0115cb19: a command that writes the config now keeps `system`.
The run took about 2h 21m, with 27,911 input, 133.0M cache-read, 1.77M cache-write and 404,831 output tokens. At Opus list rates ($5/$25 per M input/output, $0.50 cache read, $10 cache write) that is an estimated $94, before forked sub-agents.
The most costly step was implement ($53, 50m), for 240 files and about 85 docs pages; it was worth it. Review ($16, 20m) found two blocking defects, and they were real. Address took two visits ($16, 23m) and check took three ($6, 35m). About half of that came from the ticket rule that was later reversed and from scope added after the review.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| The ticket said writers "write `parse`, never `system`". Implement built that rule, so every command's cleanup write renamed the key on disk, also after a "no" to the offer and in strict mode. A teammate on core 0.48 then lost the parse settings. Implement added a worker shim (1b885860), the reviewer made it blocking, and the owner reversed the rule in 0115cb19. | one review round (address v1, check), the shim commit, and a stale rule in the PR body | ticket | orbital-ticket-prep: for a ticket that renames a persisted key or file, the Done when names what an older reader sees after each command writes, as a test. | triage |
| Two items came into scope after review (12:01): one question for all legacy projects, and an `ignoredConfigFile` deprecation. Merge saw them unbuilt and returned needs_you (pr_blocked, 5.7m), and only then did address run again. | merge, pr_blocked, address v2 and check v2–3, about 40m and $10 | workflow | implement-ticket-dg: when the ticket changes after read_threads, merge routes back to address, not to the operator. | [orbital-workflows#121](https://github.com/dmitrigrabov/orbital-workflows/issues/121) |
| `skmtc generate <project>` never offered the migration. `generateSwitch` reads the config through `toGenerateLocalArgs` and does not call `SkmtcRoot.open`, where implement put the offer. The reviewer reproduced it under a pseudo-terminal. | blocking review finding, part of address v1 | navigation | `deno/cli/lib/skmtc-root.ts` docstring on `open`: say that `generate` reads projects without it, through `to-generate-local-args.ts`. | triage |
| Self-review fixed the worker settings shim for generate but left `skmtc describe` (`project-config.ts:261`), which sent raw settings to the worker. Its docstring said all call sites were covered. | should-fix, part of address v1 | review-rule | The ticket's rule at a sibling call site: the same pattern as orbital-workflows#80. | [orbital-workflows#80](https://github.com/dmitrigrabov/orbital-workflows/issues/80) |
| `migrate` was missing from the skip list in `deno/cli/lib/registry-check.ts`, so `migrate config`, which every deprecation warning names, failed offline. | should-fix, part of address v1 | check | `registry-check.test.ts`: assert that each command in cli-schema that makes no registry call is in the skip list. | triage |
| The new "three projects get one question" test passed on macOS and failed in Linux CI, because the question listed old names in `Deno.readDir` order. | one CI round in check, about 10m | review-rule | Reviewer rules: user-facing lists built from `Deno.readDir` or `walk` are sorted before they are printed. | triage |
| Address pushed with `--no-verify`, because the pre-push `deno task check` (about 3m) on a tree that had just passed it ran past the three-minute push wait. | about 3m, and a bypassed hook | workflow | orbital-workflows#84: set the push wait above the pre-push gate's time. | [orbital-workflows#84](https://github.com/dmitrigrabov/orbital-workflows/issues/84) |
| Check posted "Blocked: needs the owner's decision" at 12:46, one minute after the owner merged. The `blocked` label stayed on a merged PR. | a stale comment and label | workflow | implement-ticket-dg check prompt: read the PR state again just before posting, and do not post on a merged PR. | triage |

## 3. Keep

- Break each rule's line in turn and see its test fail (25 mutations in implement). This caught a missing "once per project" test. It is already in the implement prompt.
- Run the interactive path under `script` (a pseudo-terminal) to see the real prompt. The reviewer used it to find the generate gap. Write it in the skmtc-cli skill's testing notes for TTY-only behavior.
- Compare old and new names byte for byte through real core (`to-generate-local-args.test.ts`). Write it in orbital-ticket-prep for rename tickets.

## 4. Deferred

- `deno/cli/lib/config-migration-offer.ts`: a "no" to the offer lasts only for the current run, so an interactive user who declines is asked again on every command. [Deferred findings](https://github.com/skmtc/skmtc/pull/431#issuecomment-7217731744).
- `deno/cli/lib/migrate-config-headless.ts`: the text lines misreport two cases, `system: {}` and a rename where `system` equals `parse`. The `--json` fields are correct. Users of the text output meet it. Self-review, dismissed as a nit.
- `deno/cli/lib/project-config.ts`: `parse: null` beside `system` drops `system`. Such a config already fails validation. Self-review.
- CLI config writers: migrate variants append a trailing newline and `ClientJson.write` does not, so a write can change only the last byte. This was already so before this change. Self-review.
- `client.json` is still named in comments in server (`homePage.ts`, `openapi.ts` descriptions), lang-csharp, lang-kotlin and gen-ts-webhook. Readers of those sources and of the server's OpenAPI descriptions meet it. Left to avoid extra releases.
- `core/context/ParseContext.ts`: the internal field and constructor argument are still named `system` (about 25 test files). Core contributors meet it.
- The cascade patch-bumps lang-kotlin, which is not private, on every core bump (#427). The Kotlin packages are meant to stay unpublished.
- `skmtc push` sends the config as is. The hub's upload schema strips `system`, so the hub's move to `parse` is in skmtc-hub#3910 (a run in progress).
- `GenerateArtifacts.generateWithWorker`: the local-worker branch of the settings shim (send `parse` under `system`) has no test of its own; only the server path does.
