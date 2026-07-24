# 2026-07-24 — Running gen-md-docs across the catalog, and publishing it to a second hub

Continuation of `2026-07-22-md-docs-extractor-bundle.md`: the hub's deep-search
index now runs `@skmtc/gen-md-docs` through a deployed `@skmtc/server` bundle over
real scraped specs, at volume. This session did the first graduated backfills
(1 → 10 → 100 → 50 APIs locally, 113 on staging) and published the extractor stack
to a second hub. Volume is what produced the signal: observations that a
single-spec run cannot surface.

## Knowledge acquired

Operating a published stack as a *service* — invoked per-spec by a host, over a
corpus of third-party specs of wildly varying quality.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **An error-level parse issue does NOT mean the artifacts are unusable.** Over 10 real specs, 3 carried error-severity issues in the manifest; one of those (a 371 KB OpenAPI 3 doc) still produced 7 complete, correct markdown docs. A host that reads "error issues > 0" as "the generate failed" silently discards good output — on a scraped corpus that is ~30% of it. | The meaning of manifest issue *severity* needs stating explicitly: what `error` guarantees about the artifacts, and what it does not. Currently a consumer has to infer a policy |
| K2 | `skmtc publish` accepts `--token` and `--origin` (defaulting to `$SKMTC_HUB_TOKEN` / `$SKMTC_API_ORIGIN`), so publishing the same project to a **second hub** needs no re-login and no config edit: `SKMTC_HUB_TOKEN=… skmtc publish <project> --origin https://api.example.net`. I had concluded — and told the user — that this was blocked on an interactive `skmtc login`, because `~/.skmtc/auth.json` holds exactly one `{ host, token }` pair. It wasn't. | skmtc-cli skill: the publish card should show the multi-hub invocation, and say that auth.json's single-host shape does not constrain it |
| K3 | Stack identity is **per hub**, so the same `deno.json#version` publishes cleanly to a second hub even though it already exists on the first. No version bump is needed to promote a stack into another environment. | One line on the publish card; the "re-publishing an existing version is rejected" wording currently reads as global |
| K4 | The 38 MB-spec isolate crash (`2026-07-22-md-docs-extractor-bundle.md#2`) reproduces **inside a Cloudflare Worker Loader**, not just under Deno — so it is the parse step, not the host. Confirmed the practical mitigation is a pre-parse *character* ceiling; 20M chars passes every spec that has ever produced docs (largest working: ~11 MB) and rejects the crasher. | Adds an environment data point to that entry; the number is only useful if the docs state a supported input ceiling |
| K5 | On this corpus the extractor is **not** the slow part: a 2 MB spec generates 200+ docs in ~400 ms server-side, against ~0.27 s *per chunk* of downstream embedding. Generator throughput was never the constraint at catalog scale. | None — but useful counter-evidence for anyone tempted to optimise generate time for bulk workloads |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | The runtime `/artifacts` response has no outcome field, so every host invents its own severity policy | friction | open |
| 2 | Multi-hub publishing looks blocked by the single-host `auth.json` until you find `--origin` | polish | open |

---

### 1. The runtime `/artifacts` response has no outcome field, so every host invents its own severity policy [friction]

Observed while indexing 10 real catalog specs through a deployed `@skmtc/server`
bundle, then again across 150 more.

**What happened:** A host calling `POST /artifacts` gets back `{ artifacts,
manifest }`. To decide whether the generate is usable it must walk the manifest,
count issues by severity, and pick a rule. The hub picked `errorIssueCount > 0 ⇒
the run failed` — a reading that looks obviously correct — and it was wrong:
3 of the first 10 specs tripped it, and one had produced 7 complete docs that
were consequently thrown away, retried six times through a queue, and re-enqueued
hourly. The corrected rule is "only a thrown failure means failure; otherwise
index the artifacts and report the issue count" — but nothing in the response
shape suggests which of the two readings is intended.

The reverse case is real too: two 395-byte specs produced *zero* artifacts and
also carried error issues. So `errorIssueCount > 0` genuinely spans "produced
nothing" and "produced a complete, correct corpus", and only the artifact map
distinguishes them.

**What was expected:** that an error-severity issue meant the output for that
subject could not be trusted — the ordinary reading of "error" — and therefore
that a run reporting errors should be discarded and retried.

**Why it matters:** this is the seam between the engine and every host that
embeds it, and the failure mode is silent. A host that gets the policy wrong does
not see an exception or a bad artifact; it sees a plausible "extraction failed"
for specs that generated perfectly, and the loss scales with how low-quality the
corpus is — precisely the corpus where a generator is most valuable. Each host
(hub runner, CI wrapper, preview container) re-derives this judgement
independently, so the engine's intent is expressed nowhere and agreed nowhere.
Prior session data supports the point: a spec that generated 202 good docs
carried **642** parse issues.

**Possible fixes:** unresolved. Candidates: an explicit outcome/severity summary
on the `/artifacts` response so hosts read one field rather than a policy; or a
documented statement of what each severity guarantees about artifacts, so the
derived policies at least agree; or per-subject severity in the manifest so a
host can drop the affected subjects rather than the whole run.

**Version anchor:** `@skmtc/core@0.28.2`, `@skmtc/server@0.2.62`,
`@skmtc/gen-md-docs@0.1.1`, CLI `0.9.38`

**Status:** open

---

### 2. Multi-hub publishing looks blocked by the single-host `auth.json` until you find `--origin` [polish]

Publishing the extractor stack to a second hub (a staging deployment) while the
CLI was logged into a local one.

**What happened:** `~/.skmtc/auth.json` holds a single `{ host, token }` pair. On
finding it pointed at `http://localhost:4812`, I concluded that publishing to
`https://api.skmtc.net` required an interactive re-login, reported that to the
user as a blocker needing a human, and moved on. It is not a blocker: `skmtc
publish` takes `--token` and `--origin`, and the one-line invocation works with a
token supplied out of band, leaving the stored login untouched.

**What was expected:** that the stored login was the only credential path, since
it is the only one visible without reading `--help`.

**Why it matters:** the visible artifact (a single-host auth file) implies a
constraint the CLI does not actually have, and the cost is asymmetric — an agent
or a CI author who believes it stops and asks a human, which is exactly the
outcome the flags exist to avoid. Promoting a stack from local → staging → prod
is a normal lifecycle step, so the multi-hub case is not exotic.

**Possible fixes:** unresolved. Candidates: show the `--origin`/`--token` form in
the publish documentation as the environment-promotion recipe; or have `auth.json`
hold a map of hosts so the visible shape stops implying "one hub at a time"; or
have publish mention the flags when the target origin differs from the stored
login's host.

**Version anchor:** CLI `0.9.38`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — no outcome field on `/artifacts` | Every embedding host derives its own severity policy from the manifest, the obvious derivation is wrong, and the failure is silent — measured at ~30% of a real sample | SKMTC code (response shape) or an explicit severity contract in the engine docs |
| 2 | K1 — what `error` severity guarantees | Same root cause as #1, but fixable purely in docs: state what an error-level issue implies about the artifacts, and hosts stop guessing | API reference / engine docs |
| 3 | K2 + #2 — multi-hub publish | An unrecognised capability turned a routine environment promotion into a reported blocker; one recipe line prevents it | skmtc-cli skill, publish card |
