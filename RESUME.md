# RESUME: CLI 0.9.58, the @skmtc/server pin (paused 2026-10-28)

Pickup notes for the next session. CLI device sign-in shipped in 0.9.57. A user
(eeko) then hit a 500 when deploying a stack on skmtc.dev. The cause is
skmtc/skmtc-hub#2131: the CLI publishes without the `@skmtc/server` pin. The CLI
fix is skmtc/skmtc#235, merged 2026-10-28 as `079022b0`.

## Done

| Work | PR |
| --- | --- |
| CLI device sign-in, review fixes (lock, refresh, 429, env) | skmtc/skmtc#233, released as 0.9.57 |
| Hub device page states, consent trigger fix | skmtc/skmtc-hub#2130, deployed to production |
| Leftover sign-in docs, plugin 0.1.18 | skmtc/skmtc#234 |
| OpenAPI 3.2 release (#212, generators#72) | closed; core 0.30.1, server 0.3.9 on JSR |

## Released: CLI 0.9.58

`skmtc publish` now adds or repins `@skmtc/server` to the CLI's version, runs
`deno install` and uploads the pinned `deno.json` and `deno.lock`. The PR body
of skmtc/skmtc#235 has the details.

0.9.58 is on JSR (Publish run 40782221055 passed). The dependency age gate
hides it from `deno install` until about 23:00 UTC on 2026-10-29.

1. After that time, install 0.9.58 and publish a test stack without the pin, to
   confirm the hub can deploy it.
2. skmtc/skmtc-hub#2131 has a comment that the CLI part is fixed. eeko's
   steps: after the gate opens, upgrade with
   `curl -fsSL https://skmtc.dev/install | sh`, then publish a new version.
   Before then, on 0.9.57, add
   `"@skmtc/server": "jsr:@skmtc/server@<cli's pin>"` to `deno.json`, run
   `deno install` and publish again.

## Next

- **skmtc/skmtc-hub#2131, hub part:** map `ServerSynthesisError` to 422, not 500,
  and stop `ensureStackServerDeployed` leaving the server row in `deploying` on a
  non-`DenoDeployError`. Code is in `apps/service/src/lib/stack-app/`.
- **skmtc/skmtc-hub#2132** (deploy status for agents through the API, MCP, the
  CLI and MCP events) and **#2133** (feedback operation). Filed, not prepped.
- **skmtc/skmtc-generators#74** (Kotlin `defaultMapping`) and **#73**
  (gen-md-docs 3.2 rendering). Still open from the 3.2 work.

## Older notes, not rechecked since 2026-10-19

- The Publish workflow has no `timeout-minutes`, so a JSR hang runs until
  someone cancels it.
- The `skmtc-catalog-seed` checkout holds a stash of seed data from
  2026-10-12/13. Drop it or restore it.
- Catalog imports need a `skmtc-seed` system user token from control.skmtc.dev.
  A personal token is refused.

## Suggested skills

- `orbital-delivery-lead` and `orbital-ticket-prep` before any run on #2131,
  #2132 or #2133.
- `skmtc-cli` for publish behavior; `docs-writing` and `ste100` for doc edits
  (the STE hook checks `docs/`).
