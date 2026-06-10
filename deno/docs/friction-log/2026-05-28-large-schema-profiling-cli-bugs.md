# 2026-05-28 — Large-schema profiling surfaces CLI bugs

While profiling SKMTC's memory/time footprint against a 10 MB Cloudflare
OpenAPI schema (for a comparison against an oasdiff WASM/Deno port), the
setup hit three distinct CLI defects and produced an architecturally
significant memory data point. The profiling itself succeeded; the
findings below are byproducts of getting it to run.

## Knowledge acquired

Operating the CLI (`init` → `install` → `generate`) against an unusually
large schema, on `@skmtc/core@0.6.7`.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **There is no "JSR-published bundle.js" — that premise is a category error.** JSR hosts generator *source* only (`install` adds a `jsr:@skmtc/gen-x` import — `install-headless.ts:45`, `project.ts:132`). Compiled bundles live in the **SKMTC hub's R2**, uploaded only via `skmtc deploy` (`source-upload.ts:1-22`, `deploy-headless.ts`). The `install-headless.ts:24` comment ("installed JSR generators run their published `bundle.js` so no local bundle is needed") and the `install` command's `detail` string are both **wrong/unimplemented**. | skmtc-cli §8 + §"clone-vs-install" — remove the "JSR bundle.js reused" claim; skmtc-architecture — document the JSR-source vs hub-R2-bundle split |
| K1b | The CLI overloads "remote" across **two unrelated axes** the docs conflate: (1) *remote generators* = `jsr:` source imports — the project still runs **locally** and needs a **locally-built** `bundle.js` (`generate.tsx:79` unconditionally resolves `toBundlePath` → `file://<project>/bundle.js`; nothing downloads a bundle); (2) *remote generation* = `RemoteProject.fromKey` when the arg is a project **key** (`generate.tsx:30`), which runs server-side on the hub where the deployed bundle lives. install-only → local generate is broken because (1) needs a bundle nobody builds. | skmtc-cli / skmtc-architecture — name and separate the two "remote" axes explicitly |
| K2 | `skmtc clone <project> -g <gen>` is the only reliable way to obtain a runnable **local** bundle for a non-deployed generator: it rewrites the import to `./gen-x/mod.ts`, regenerates `worker.ts`, and runs `deno bundle` to produce `bundle.js`. This is what unblocked generation here. (The other runnable paths are `bundle`/`dev` for already-local generators, or hosted `RemoteProject` generation by project key.) | Already partially in skmtc-cli; add an explicit "if local generate fails with missing bundle.js, clone — install alone never builds one" note |
| K3 | `gen-typescript` on a single 10 MB schema → **517 MB peak RSS** (`/usr/bin/time -l`), 868 ms internal (`stats.totalTimeMs`) / 2.09 s wall, 5,999 files, 23,356 lines. **⚠️ CORRECTED (see K3b):** peak RSS is NOT required memory — it's dominated by GC slack/churn an uncapped process never reclaims. Do not infer isolate-fit from native peak RSS. | skmtc-architecture — teach "peak RSS ≠ live set; a memory-capped V8 isolate GCs to the live set" |
| K3b | **⚠️ CORRECTED AGAIN — it does NOT genuinely fit 128 MB.** A deployed CF Worker *completes* the 10 MB generation (`outcome: ok`, cpuTime 1.97–3.76 s, 5,999 artifacts), AND 8 and 30 concurrent requests all returned 200. BUT measuring actual V8 heap (same engine, in Node) shows: post-GC live set **125 MB**, post-generation heapUsed **211 MB**, and **`node --max-old-space-size=128` OOMs** ("JavaScript heap out of memory") — also OOMs at 112/96/80. So the transient working set genuinely exceeds 128 MB. Production success is **CF's documented leniency**: *"when an isolate exceeds 128 MB, the runtime lets in-flight requests complete and creates a new isolate for subsequent requests"* (+ fan-out across isolates under concurrency). This is **outside the supported envelope**, not a true fit. `outcome: ok` ≠ "stayed under 128 MB". | skmtc-architecture — (1) measure JS **heap** (capped-V8 OOM test), never RSS; (2) `outcome: ok` does not certify memory fit; (3) the 128 MB limit is per-isolate & lenient to in-flight requests but the docs warn of cancellation under high load |
| K3c | Method note that generated the trap: peak **RSS** (517 MB) ≫ required heap; the honest test is `node --max-old-space-size=<N>` (or capped V8) — if it OOMs, it doesn't fit, regardless of what a single edge request returns. Cross-project: WASM is still worse here (Go-WASM linear memory ratcheted to 735 MB and never reclaims), but the corrected SKMTC result means a JS impl *also* exceeds 128 MB for a 10 MB schema — it merely survives via CF leniency. Neither is safely in-envelope for schemas this large; production needs a smaller working set (streaming/chunking) or a real-memory runtime (Containers). | none (cross-project note for the oasdiff port decision — earlier "favours native-Deno over WASM" was over-optimistic) |
| K4 | Error-level `parseIssues` set process exit code to **1 even when generation fully succeeds** (5,999 files written). The CF schema produced 1,428 error-level issues (`INVALID_RESPONSE` allOf enum-intersection `true` vs `false`; `INVALID_FORMAT` `uint64`) yet all artifacts landed on disk. | skmtc-debug — clarify exit-code semantics: exit 1 ≠ "no output produced" |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Remote-only `install`→`generate` fails: missing `bundle.js`, no JSR fallback | friction | open |
| 2 | `--json` output is invalid JSON when parseIssues are present | friction | open |
| 3 | `doctor` greenlights a remote-only project that cannot generate | friction | open |
| 4 | Error-level parseIssues force exit 1 despite successful generation | polish | open |

---

### 1. Remote-only `install`→`generate` fails: missing `bundle.js`, no JSR fallback [friction]

Observed setting up a fresh project to profile `gen-typescript` against a
large schema, following the documented happy path (`init` → `install` →
`generate`).

**What happened:** `skmtc install @skmtc/gen-typescript cf-profile --json`
succeeded and reported `bundle.kind: "noop", reason: "remote-only"`. The
subsequent `skmtc generate cf-profile --json` exited 1 in 0.27 s with:

```
error: Uncaught (in worker "") Module not found
  "file:///…/.skmtc/cf-profile/bundle.js".
```

`skmtc doctor --json` reported the project healthy throughout
(`project-bundle/cf-profile: ok` — "remote-only; bundle.js is not
needed"). Cloning the generator (`skmtc clone cf-profile -g
@skmtc/gen-typescript`) built a local `bundle.js` and generation then
ran. Every other working project on this machine also has a local
`bundle.js` on disk — suggesting the remote-only generate path is rarely
(or never) exercised successfully.

**What was expected:** per skmtc-cli §8 and the `install` output's own
`detail` field ("the published JSR `bundle.js` will be used by `skmtc
generate`"), a remote-only project should generate without any local
bundle by fetching the JSR-published bundle at generate time.

**Verified mechanism (this premise is false — see K1/K1b):** JSR hosts
generator *source*, not a bundle; compiled bundles live in the hub's R2
(uploaded via `deploy`). Local `generate` (`generate.tsx:79`)
unconditionally resolves `toBundlePath` → `file://<project>/bundle.js`
and nothing in the local path downloads a bundle from anywhere. So
"remote-only install→generate uses the published JSR bundle" cannot
work as described — there is no such artifact, and no fetch.

**Why it matters:** this is the *primary documented onboarding path* —
the "Setting up SKMTC in a project" task card ends with `install` then
`generate`, no `clone`. If that path is dead, every new user following
the docs hits a `Module not found` with no signpost to the fix. The
workaround (`clone`) silently changes the project from remote to local
(vendored source), which is a different operational mode with different
update semantics — not an equivalent substitute.

**Possible fixes:** unresolved — but NOT "wire up the JSR bundle fetch"
(no such artifact exists). The real options: (a) make `install`/`bundle`
build a local `bundle.js` from the JSR *source* for remote generators
(what `clone` does, minus vendoring the source into the project tree);
(b) have `generate-local` bundle-on-the-fly from the `jsr:` source when
no `bundle.js` is present; or (c) accept that local generation requires
`clone`/`bundle` and that install-only projects are meant for hosted
`RemoteProject` generation — then fix the docs, the `install` `detail`
string, the `install-headless.ts:24` comment, and `doctor` to say so
instead of implying install→generate works locally.

**Version anchor:** `@skmtc/core@0.6.7`, `@skmtc/gen-typescript@0.0.64`,
`@skmtc/worker@0.3.6`

**Status:** open

### 2. `--json` output is invalid JSON when parseIssues are present [friction]

Observed parsing the `generate --json` result programmatically to extract
`stats`.

**What happened:** `JSON.parse` of stdout threw `Expected ',' or '}'
after property value`. The cause: a `parseIssue` object's `parent` field
contains a **raw, unescaped JSON string** (the offending schema fragment),
e.g.:

```
"parent":"{"content":{"application/json":{"schema":{"allOf":[…]}}}…}"
```

The inner double-quotes are not escaped, so the outer document is
malformed. Extracting `stats` required a regex fallback
(`/"stats"\s*:\s*\{[^}]*\}/`) rather than a real parse.

**What was expected:** `--json` mode (which "implies `--no-input`" and is
documented as emitting "a single JSON object on stdout") to always emit
parseable JSON — that is the entire contract agents and CI drive on.

**Why it matters:** the skmtc-cli skill explicitly tells agents to "add
`--json` to every command" and to "drive on these shapes." A schema with
any allOf-merge or similar issue (common in real-world specs) silently
corrupts the output, so the failure surfaces only on messy schemas — the
exact ones where the `errors`/`parseIssues` arrays are most needed.

**Possible fixes:** unresolved — the `parent` field should be a properly
escaped JSON string, or a structured object, or omitted from the
machine-readable output. Likely a serialization site that string-concats
rather than `JSON.stringify`-ing the nested value.

**Version anchor:** `@skmtc/core@0.6.7`, `@skmtc/gen-typescript@0.0.64`

**Status:** open

### 3. `doctor` greenlights a remote-only project that cannot generate [friction]

Observed cross-checking `doctor` against the actual generate failure in
#1.

**What happened:** with cf-profile in the broken state from #1,
`skmtc doctor --json` returned `summary: "warning"` (only an unrelated
core-pin warning) and specifically `project-bundle/cf-profile: ok` —
"remote-only; bundle.js is not needed." The project provably could not
generate.

**What was expected:** a diagnostic that catches the conditions that
actually block `generate`.

**Why it matters:** `doctor` is positioned (skmtc-cli §5) as the
first-step diagnostic an agent runs to "check for known frictions." A
green `doctor` on a project that can't run defeats that purpose and sends
the agent looking in the wrong place. The bug in #1 and this blind spot
compound: nothing in the tooling points at the real problem.

**Possible fixes:** unresolved — once #1's intended behaviour is decided,
`doctor`'s `project-bundle` check should verify that *whatever generate
needs* (a local bundle, or a resolvable JSR bundle) is actually present
for remote-only projects, not assume "remote-only ⇒ fine."

**Version anchor:** `@skmtc/core@0.6.7`

**Status:** open

### 4. Error-level parseIssues force exit 1 despite successful generation [polish]

Observed when the profiling run exited non-zero even though all output
was produced.

**What happened:** generating against the CF schema produced 1,428
error-level parseIssues (e.g. `INVALID_RESPONSE`: "Cannot merge schemas:
enum values have no intersection. First: true, Second: false";
`INVALID_FORMAT`: "Invalid format: uint64") and exited 1 — yet 5,999
files (24 MB) were written to disk and `stats` reported a complete run.

**What was expected:** unclear at the outset whether exit 1 meant "no
output" or "output produced, but some items had issues." It was the
latter.

**Why it matters:** the skmtc-cli exit-code table maps `1` to "fatal
parseIssue … generated files stay on disk," which is technically
consistent — but the volume here (1,428 "errors" that are really
upstream-schema defects, not generator failures) makes exit 1 a poor
signal. A CI gate keyed on exit code would reject a perfectly usable
6,000-file generation because the *input* schema has allOf conflicts the
generator handled gracefully. The line between "schema is malformed" and
"generation failed" is blurred.

**Possible fixes:** unresolved — possibly distinguish "schema-content
errors" from "generation errors" with separate exit codes or a
`--tolerate-parse-errors` flag; or downgrade allOf-merge conflicts on
response schemas to warnings. Needs a product decision, not just a code
tweak.

**Version anchor:** `@skmtc/core@0.6.7`, `@skmtc/gen-typescript@0.0.64`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — remote-only install→generate fails (false JSR-bundle premise, K1/K1b) | The primary documented onboarding path is dead end-to-end; new users hit `Module not found` with no signpost, `doctor` (#3) hides it, and the stated cause ("JSR bundle.js reused") doesn't exist. | SKMTC code + docs — decide whether `install` builds a local bundle from JSR source or install-only routes to hosted `RemoteProject` generation; then correct the `install` `detail` string, `install-headless.ts:24`, `doctor`, and skmtc-cli §8 |
| 2 | #2 — `--json` emits invalid JSON on parseIssues | Breaks the machine-readable contract agents/CI are told to depend on, precisely on the messy schemas where it matters most. | SKMTC code — escape/stringify the `parent` field in parseIssue serialization |
| 3 | K3 — 10 MB schema ⇒ 517 MB peak RSS | Sets a hard size ceiling for any "run SKMTC in a Worker isolate" plan; the data-model expansion (not language) is the wall, and the same holds for the oasdiff port. | skmtc-architecture / deployment-constraints explanation doc |
