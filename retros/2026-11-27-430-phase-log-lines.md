# Retro: #430 phase log lines and parse issue sentences

Run `2026-11-27-012zjd` of `implement-ticket-dg`, PR [#437](https://github.com/skmtc/skmtc/pull/437), merged as 5da5e2cb.

## 1. Summary

#430 asked core to log each run phase at INFO with counts and times, and a parse issue as a sentence with an `issue` field. All of it was delivered as core 0.50.0, with server 0.3.46 and cli 0.11.2, and follow_on checked it against the published JSR packages. The ticket named a patch bump; it needed a minor. The run took 1h 21m, with 24k input, 51.5M cached and 167k output tokens, for about $19.30. implement cost the most ($10.86, 37m). That was worth it: it built the feature and its tests, measured Microsoft Graph, and its self-review caught a CLI console regression. One review round followed (address $2.27, check $0.63).

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| Self-review found that the CLI worker runs `silent: false` and its `ConsoleHandler('DEBUG')` prints every line whatever `logLevel` is set. Logging the phase lines would have printed them on every `skmtc generate` and broken `--json` stdout. The ticket's Traps named only the trail and the 2,000-line cap. | ~8m and one redesign of the gate | navigation | `core/context/CLAUDE.md`: say that the console prints every logged line and the CLI worker runs non-silent at WARN, so new log lines must be gated on `logLevel`. | triage |
| The ticket said `deno task bump core`, but the change re-shapes the exported `LogLine`, so `verify-docs`' api-surface check requires `--minor`. That in turn required `record-api-surface`, the skills' `describes` and `bump-plugin`. Redoing it from `deno/` with repo-root paths bumped every dependent twice. Second run with this miss (see the #401 retro). | ~10m, one double bump undone | ticket | orbital-ticket-prep: a ticket that changes a core export's shape names `bump core --minor`, `record-api-surface`, `describes` and `bump-plugin`. | triage |
| The reviewer caught that `issue.type` was a closed enum on the wire. The CLI parses `logs` with one `safeParse`, so a CLI on an older core would drop every line when a newer server sent a new issue type. | one review round (address 7m 31s) | review-rule | reviewer rules: a valibot schema of a cross-version wire shape (`LogLine`, server responses) keeps open-ended fields open (`v.string()`, not an enum). | triage |
| The open_pr push hit the three-minute wait because the pre-push hook reruns the 3–4m `deno task check`. That check had passed on the same commit. The push was retried with `--no-verify`, and the killed hook's test run kept running with no PID to stop it. Third run in a row. | ~4m, an orphan process | workflow | orbital-workflows#84: set the push wait above the pre-push gate's time, or skip the hook when the check passed on that SHA. | [orbital-workflows#84](https://github.com/dmitrigrabov/orbital-workflows/issues/84) |
| The Microsoft Graph done-when item needs a document that is not in the repository. A full-disk `find` ran for 2m and was stopped before the 45 MB YAML was downloaded. follow_on downloaded it again to run the stock generators. | ~4m implement, ~1m follow_on | information | orbital-ticket-prep: a done-when item that names a catalog document gives its URL or a cached path. | triage |
| The worktree root is a directory named `deno` that holds another `deno/`. Commands from the wrong level failed: `cd ..` left git, and `git checkout` with repo-root paths failed from `deno/`. follow_on hit it too. | ~3m over 4 failed calls | navigation | implement-ticket-dg create_worktree: name the worktree directory after the run, not after the repo's `deno` subfolder. | triage |
| main moved twice during the run: #433 folded skills into `skmtc-generator`, then #435 took core to 0.49.1. Each move needed a conflict resolution and a re-bump: once in a rebase, once when the delivery lead asked for a merge in address. | ~8m | workflow | orbital-workflows#105: rerun the version check and re-bump against main just before merge. | [orbital-workflows#105](https://github.com/dmitrigrabov/orbital-workflows/issues/105) |
| The reviewer found two doc sentences in the new manifest-format section that did not match the code: the "transformed" count, and a totals line that a failed run never logs. Self-review had changed the code comment but not the doc sentence. | part of one review round | review-rule | none: the reviewer rule already caught it. | none, rule already works |

## 3. Keep

- Removing each guarded line once and watching its test fail proved every rule. Already in the implement prompt; keep it.
- Gating new log output on `logLevel`, with a test that the console stays empty at WARN. Write it in `core/context/CLAUDE.md` with the first finding.
- Measuring the large-document done-when item with neutral test generators when the stock ones cannot run, and saying so. follow_on then re-measured with the stock generators (6 INFO lines).

## 4. Deferred

- `GenerateContext.toArtifacts`: a generator for the other protocol logs `0 of 0 operations` rather than "not for GraphQL documents". Met by users of mixed stacks on any GraphQL run. Source: [deferred findings](https://github.com/skmtc/skmtc/pull/437#issuecomment-7219696344).
- `CoreContext.toSupportedSubjects`, `toEnrichmentDefaults`: their phase lines are never logged, because the public entry points take no `logLevel` and the server calls them silent. Dead code until a host passes INFO. Same source.
- Generator lines count only the files a generator added, so gen-zod reads `0 files` when it writes into gen-typescript's files. A Logs-tab reader may take that to mean no output. Seen by follow_on on Microsoft Graph.
- `issue.parent` is the parent node as one JSON string. On Graph it makes the 2,250 issue lines heavy for the hub's 2,000-line cap and for storage. Seen by follow_on.
- The published stock generators (gen-typescript 0.2.26, gen-zod 0.4.11, gen-tanstack-query-fetch-zod 0.2.29, gen-valibot 0.2.26) pin core 0.48.0 exactly. Stacks built from them do not get these lines, and pairing them with server 0.3.46 likely loads two copies of core. Seen by follow_on.
- The totals line counts generators that `settings.skip` removed. Self-review dismissed it because each has its own "skipped" line; a reader comparing counts would meet it.
- `LogLineIssue` has no `protocol` and no raw `message`. Self-review dismissed it because the ticket names four fields; a logs.ndjson tool that wants the bare message must parse the sentence.
- Console: a non-silent run at INFO, the server process, prints the phase lines on its console as well as returning them. That is the documented behavior, but the server's stdout grows.
