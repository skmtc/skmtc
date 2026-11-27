# Retro: #472 generate --json prints log lines before the JSON

## 1. Summary

#472 asked that `skmtc generate --json` print only JSON on stdout when the schema has parse warnings, with a reproduction first. It was delivered as core 0.55.1, with CLI 0.12.6 in the cascade (PR #480, squash `66a9206c`). Core's logger now uses a `ConsoleHandler` subclass that writes with `console.error`. Two CLI smoke tests reproduce the bug and pass after the fix, and the generate reference page says where warnings go.

follow_on ran the published CLI 0.12.6. The fix holds in a project with no generators, but not after `install jsr:@skmtc/gen-zod`: that stack pins core 0.54.0, so stdout is still not JSON. Stock-generator users get the fix only after skmtc-generators#145.

The run took 59m (45m of agent time), with 19.3k input, 23.0M cached and 90k output tokens, for about $10.35. implement cost the most ($4.96, 14m). That was worth it: it reproduced the bug before the fix, ran removal checks, and passed `deno task check` once.

## 2. Findings

| What happened | Cost | Kind | The change that prevents it | Issue |
| --- | --- | --- | --- | --- |
| follow_on found that the fix does not reach users of the stock generators: gen-zod 0.6.1 pins core 0.54.0, and moving the project's pin to 0.55.1 fails the one-copy-of-core check. The ticket's done-when items only proved the fix in-repo. | Ticket's user goal unmet; needs_you | ticket | A core fix ticket's "Release" section names the skmtc-generators republish its users need, or links a follow-up ticket for it, before the run starts (orbital-ticket-prep skill). | https://github.com/skmtc/skmtc-generators/issues/145 |
| #475 merged core 0.55.0 while #480 was in review, so #480's cascade bump conflicted in 11 version files. The second address round re-bumped and re-ran the full check, and the pre-push hook ran it again. | ~12m address + ~8m check, 1 extra round | workflow | implement-ticket-dg: before the review round, re-check that main has not taken the bump version. dmitrigrabov/orbital-workflows#105 covers the check before merge. | triage |
| The reviewer caught that the new generate.md text promised "stdout holds only the JSON" while a generator's `console.log` still lands on stdout. The author had seen the false sentence in the-worker-runtime.md and left it as out of scope. | 1 review round (~6m address) | review-rule | Author prompt: when the PR's own docs sentence depends on a page it calls wrong, fix that page in the PR. Out of scope applies to failing checks, not to docs the PR relies on. | triage |
| The squash title on main says "core 0.54.2", but the release is core 0.55.1. The merge step used the PR title from before the re-bump. #438's retro saw the same thing. | Misleading history; 0 min | workflow | implement-ticket-dg merge step: rewrite the squash title from the bumped `deno.json` versions, or have address update the PR title after a re-bump. | triage |
| A dangling schema `$ref`, which the ticket suggested for the reproduction, is error-level and makes `generate` exit 1. A second fixture iteration was needed to find a warning-level issue (`UNEXPECTED_PROPERTY`). | ~2m, 1 extra smoke run | ticket | Ticket prep: name a fixture whose issue level has been checked (for example an unknown schema property) when the ticket asks for a "warning" reproduction. | none: small, ticket-specific |
| follow_on's run of the just-published CLI hit Deno's 24-hour dependency age gate, macOS's missing `timeout`, and a missing `--unstable-worker-options`. | 3 wasted calls | information | follow_on prompt: give the exemption config for named `@skmtc` packages and the `deno run` flags the CLI needs. | triage |

## 3. Keep

- Reproduce with the real CLI before the fix (a failing `JSON.parse(stdout)`), then show removal checks fail: this caught a weak stderr-only stub in self-review. It is already in the implement prompt.
- follow_on testing the published package inside a stock-generator stack, not only a bare project. Write it into the follow_on prompt for core fixes: "also try a project with `install jsr:@skmtc/gen-zod`".

## 4. Deferred

- `deno/core/context/StderrConsoleHandler.ts`: every level is written with `console.error`, so hosts that set severity from the console method (Workers or Deploy logs for `@skmtc/server`) show INFO and DEBUG lines as errors. Server operators would meet it at `logLevel` INFO. Source: https://github.com/skmtc/skmtc/pull/480#issuecomment-7226403389
- `deno/core/context/CoreContext.ts` `#setupLogger`: ANSI colours stay on stderr when it is redirected to a file or CI log. follow_on saw this in the published run. Source: same comment.
- `deno/core/context/CoreContext.ts` `#setupLogger`: colours are applied twice (`useColors: true` on top of `skmtcFormatter`'s colours), so the whole message, not only the tag, is coloured. This was there before this change; the self-review found it.
- `deno/docs/reference/cli/generate.md` "Where warnings go": it does not say the behaviour needs core 0.55.1 or later in the project. A user on stock generators pinned to core 0.54 reads the page and still gets mixed stdout (follow_on).
- `deno/cli/tests/cli-graphql-smoke.test.ts`: the file is named for GraphQL but now also holds the OpenAPI stream tests (reviewer nit, not fixed).
