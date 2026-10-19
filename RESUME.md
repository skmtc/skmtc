# RESUME — OpenAPI 3.2 release (paused 2026-10-19, 22:00 UTC)

Pickup notes for the next session. The OpenAPI 3.2 work is merged. The core release is
still publishing to JSR in the background, and the stock generators move to core 0.30
after it.

## Done

| Work | Ticket | PR |
| --- | --- | --- |
| Accept OpenAPI 3.2 documents (v3-2 parser tree) | #190 | #201 |
| Document-level 3.2 metadata into the IR | #191 | #203 |
| Security scheme fields, `itemSchema`, `components.mediaTypes` | #192 | #204 |
| QUERY method, `additionalOperations`, `querystring`, cookie style | #193 | #206 |
| Reader docs: 3.2 support, 3.1 parsed natively | #207 | #210 |
| Skills reread against core 0.30 (`skmtc-operation`) | — | #213 |
| CLI smoke tests resolve `@skmtc/*` from the workspace | #216 | #217 |
| Release bump to core 0.30.0 with the cascade | #212 | #215 |
| Re-bump to core 0.30.1 to get past a stuck JSR publish | #212 | #220 |

## In progress: the release

JSR is slow for `@skmtc` publishes, taking about an hour per package. Core 0.30.0
stayed stuck in JSR's "processing" state for an hour, and every retry waited on it
(compare jsr-io/jsr#1572), so #220 re-bumped to 0.30.1 with the same code.

| Package | On JSR at 22:00 UTC | Target |
| --- | --- | --- |
| core | 0.30.1 | 0.30.1 |
| convert | 0.1.19 | 0.1.19 |
| lang-kotlin | 0.11.5 | 0.11.5 |
| lang-typescript | 0.12.24 | 0.12.26 |
| worker | 0.3.57 | 0.3.59 |
| server | 0.3.6 | 0.3.9 |
| cli | 0.9.53 | 0.9.56 |

- **Publish run:** 39316760502 (workflow_dispatch on main) was publishing the rest.
- **If a run fails** (for example a JSR `503` on the status check), run Publish again on
  main. The release script skips every version already on JSR.
- **Check the versions:** `curl -s https://jsr.io/@skmtc/<pkg>/meta.json` and read `latest`.

## Next steps

1. **Finish #212.** When all seven packages are on JSR, close #212. Orbital run
   `2026-10-19-p94fap` waits at `post_merge_needs_you`: read its reason, then resume or
   archive it. Run the `skmtc-model` skeleton's `deno test` against 0.30.x and refresh its
   `deno.lock` in a small follow-up PR.
2. **skmtc/skmtc-generators#72.** Start it when lang-typescript 0.12.26 is on JSR. It
   moves every generator's pins to core 0.30.1, lang-typescript 0.12.26 and lang-kotlin
   0.11.5. It adds `query` gates in express, supabase-hono, msw and kotlin-spring, reads
   msw `dataValue`, and releases the 16 published generators. Until it ships, CLI 0.9.56
   refuses to build **new** projects that use stock generators, because they get two
   copies of core. Existing projects keep working.
3. **Then:** skmtc/skmtc-generators#74 (Kotlin `defaultMapping`, private, no release) and
   #73 (gen-md-docs 3.2 rendering, after #72).

## Follow-ups worth a ticket

- **Publish timeout:** the Publish workflow has no `timeout-minutes`, so a JSR hang runs
  until someone cancels it.
- **Release CI:** the CLI smoke-test fix (#217) means release PRs no longer fail on an
  unpublished core.

## Elsewhere this session

- **Precisely in the catalog:** https://skmtc.dev/precisely now has 18 APIs, imported
  with skmtc/skmtc-catalog-seed#265. The data PR, skmtc/skmtc-catalog-seed#266, is open
  for merge.
- **Seed checkout stash:** the `skmtc-catalog-seed` checkout holds a stash with older
  uncommitted seed data from 2026-10-12/13. Drop it or restore it.
- **Empty import runs:** three earlier import runs failed before importing anything,
  because their tokens were not system users. `import-cleanup.ts` can tidy them.
- **Catalog imports need a `skmtc-seed` token:** create it on control.skmtc.dev → System
  users → `skmtc-seed`. A personal token is refused.
