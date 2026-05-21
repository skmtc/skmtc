# 2026-05-21 — Debugging `skmtc bundle` failure in the Generator Lab sandbox

Multi-step debugging of why the SKMTC Generator Lab's ephemeral sandbox
could not `skmtc bundle` an agent-authored local generator. The chase
went through four layered causes; this retro captures the SKMTC-CLI
observations (the lab-side fixes are out of scope).

## Knowledge acquired

Operated against the SKMTC CLI's `bundle` path — `@skmtc/cli@0.3.4`
driving `deno bundle` over an agent-authored local generator.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `@skmtc/cli@0.3.4`'s `createBundle` (`cli/tasks/GenerateBundleTask.tsx`) shells out to `deno bundle -o bundle.js worker.ts`. The esbuild-based `deno bundle` that accepts `-o` exists only in **Deno ≥ 2.4.0** — `deno bundle` was removed in 1.31 and re-introduced in 2.4. The CLI therefore has an undocumented hard Deno ≥ 2.4 floor. | CLI reference / install docs — state the minimum Deno version; consider a runtime check |
| K2 | On a bundle failure `createBundle` throws only a generic `Error('Failed to create bundle')` and writes the real `deno bundle` stdout/stderr to `<project>/.settings/logs.txt` and `<project>/.settings/error-logs.txt`. The actual cause is in neither the thrown error nor the `--json` result. | `skmtc-debug` skill — "bundle failed → read `.settings/error-logs.txt`" |
| K3 | The re-introduced `deno bundle` is experimental (prints `⚠️ deno bundle is experimental`) and resolves esbuild (`@esbuild/<platform>` from npm) plus every dep over the network at bundle time. `skmtc bundle` of a local generator is not offline-capable unless `DENO_DIR` is warmed with esbuild + `@skmtc/worker` + `@std/*`, not just `@skmtc/core`. | CLI reference — CI/offline note: warm the full bundle dependency set |
| K4 | `@skmtc/core@0.6.2` exports no `ContentBase` (no such symbol anywhere in core 0.6.2). The model-generator DSL surface is `toModelEntry`, `ModelProjectionBase` / `toModelProjectionBase`, `Definition`, `Identifier`, `ContentSettings`, `SnippetBase`. An LLM authoring a generator readily hallucinates a `ContentBase` base class. | skmtc-generator skill — already covers the DSL; a one-glance "minimal model→file generator imports" example would harden against the `ContentBase` hallucination |
| K5 | `@skmtc/cli@0.3.4` threads `bundlePath` as a `file://` URL *string* (from `toBundlePath`), not a filesystem path — and that string is also the public `BundleHeadlessResult.bundlePath`. `@std/fs`'s `exists`, like Deno's fs APIs, resolves `file://` only from a `URL` *object*; a `file://` *string* is treated as a literal, non-existent path. So `bundleHeadless`'s own existence check always false-negatives and `skmtc bundle` fails 100% for any local-generator project. | SKMTC CLI code fix (see #4); plus an API-reference note that `BundleHeadlessResult.bundlePath` is a `file://` URL string, not a path |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc bundle` failure is opaque — real error hidden in `.settings/error-logs.txt` | friction | open |
| 2 | `@skmtc/cli@0.3.4` silently requires Deno ≥ 2.4 (`deno bundle -o`) | friction | open |
| 3 | `bundle`'s `remote-only` no-op message misleads when a local generator exists but isn't discovered | polish | open |
| 4 | `bundleHeadless` existence check false-negatives on a `file://` URL string | blocker | open |

---

### 1. `skmtc bundle` failure is opaque — real error hidden in `.settings/error-logs.txt` [friction]

Debugging why `skmtc bundle <project> --json` failed for an
agent-authored local generator.

**What happened:** The `--json` invocation surfaced only
`error: Uncaught (in promise) Error: Failed to create bundle` with a
stack ending at `createBundle` (`cli/tasks/GenerateBundleTask.tsx:95`).
`createBundle` runs `deno bundle` with `stdout`/`stderr` piped, writes
stdout to `<project>/.settings/logs.txt` and stderr to
`<project>/.settings/error-logs.txt`, then — on `!success` — throws a
bare `new Error('Failed to create bundle')`. The captured stderr (the
real cause) is in neither the thrown error nor the strict-mode JSON
result. I had to read the CLI source to discover the log files existed,
then read `error-logs.txt`, before *any* bundle failure had a
diagnosable cause.

**What was expected:** a `--json` bundle failure to carry the
underlying tool's error, or at least name the log file that has it.

**Why it matters:** `bundle` is one of the two core pipeline commands;
when it fails, the CLI's own output is a dead end. Every distinct
bundle failure — wrong Deno, missing export, bad import specifier —
collapses to the same opaque `Failed to create bundle`. Diagnosis is
impossible without out-of-band knowledge of `.settings/error-logs.txt`.

**Possible fixes:** `createBundle` could read back the captured stderr
and include it in the thrown `Error` / the strict-mode JSON `detail`;
or the bundle command's error output could name `.settings/error-logs.txt`;
or `skmtc-debug` could document the file as the first place to look.

**Version anchor:** `@skmtc/cli@0.3.4`, `@skmtc/core@0.6.2`

**Status:** open

### 2. `@skmtc/cli@0.3.4` silently requires Deno ≥ 2.4 (`deno bundle -o`) [friction]

Same bundle debugging — the sandbox container was pinned to Deno 2.1.4.

**What happened:** `createBundle` runs `deno bundle -o bundle.js
worker.ts`. `deno bundle` was removed in Deno 1.31 and re-introduced
(esbuild-based) in Deno 2.4.0. On Deno 2.1.4 the subcommand exists only
as a deprecated stub that rejects the flag:
`error: unexpected argument '-o' found / Usage: deno bundle [OPTIONS]`.
The CLI never checks the Deno version; the failure presents as the
generic `Failed to create bundle` (see #1), and the `-o` error is only
visible once `.settings/error-logs.txt` is read. Bumping the container
to Deno 2.7.14 fixed it.

**What was expected:** either `deno bundle` to be version-stable, or
the CLI to assert its Deno floor with a clear message.

**Why it matters:** "Deno 2" spans 2.0–2.3 with no working `deno
bundle`; a user on any recent-but-pre-2.4 Deno 2.x gets an inscrutable
failure. The dependency is a hard, undocumented runtime floor, and the
opacity of #1 compounds it — the actual `unexpected argument '-o'`
message is two layers down.

**Possible fixes:** the CLI could probe `deno --version` (or
`deno bundle --help`) and fail with an explicit "requires Deno ≥ 2.4"
message; document the floor in the CLI reference / install
instructions; or vendor/pin the bundler so it does not depend on the
host Deno's `bundle` subcommand.

**Version anchor:** `@skmtc/cli@0.3.4` — fails on Deno 2.1.4, works on
Deno 2.7.14

**Status:** open

### 3. `bundle`'s `remote-only` no-op message misleads when a local generator exists but isn't discovered [polish]

The agent-authored generator package was named `@lab/ts-type-alias` —
no `gen-` prefix.

**What happened:** With a real local generator folder present and wired
into the project `deno.json#imports`, `skmtc bundle` returned
`{ kind: "noop", reason: "remote-only", detail: "Project has only
remote (installed) generators..." }`. The project did **not** have only
remote generators — it had a local generator the CLI failed to discover
because `bundle-headless.ts`'s `hasLocalGenerator` requires the import
key's package name (`parseModuleName(id).packageName`) to start with
`gen-`. The message gives no hint that a naming rule caused the miss.

**What was expected:** a no-op reason that points at the discovery rule
when a non-`jsr:` import is present but rejected by the `gen-` filter.

**Why it matters:** the `gen-` prefix rule is documented (skmtc-cli
skill), but the failure mode is near-silent — the `detail` text
actively asserts something false ("only remote generators"), steering
diagnosis away from the naming cause. The `--json` result *does* carry
`reason`/`detail`, so it is not fully silent, but the text misleads.

**Possible fixes:** `hasLocalGenerator` could detect non-`jsr:` import
values that fail *only* the `gen-` filter and surface a distinct
reason — "a local generator folder was found but its package name
lacks the required `gen-` prefix"; or the `detail` text could mention
the rule.

**Version anchor:** `@skmtc/cli@0.3.4`

**Status:** open

### 4. `bundleHeadless` existence check false-negatives on a `file://` URL string [blocker]

The next layer of the same `skmtc bundle` chase — reached only once #2
(Deno floor) and #3 (`gen-` naming) were cleared and `deno bundle`
actually ran to completion.

**What happened:** `skmtc bundle <project> --json` of a project with a
local generator fails with `Error: bundle.js was expected at
file:///…/.skmtc/lab/bundle.js but wasn't written`
(`@skmtc/cli@0.3.4/lib/bundle-headless.ts:70`) — even though the
captured `deno bundle` stderr reports success ("Bundled 447 modules in
388ms, bundle.js 693.47KB"). The chain inside `@skmtc/cli`:

- `toBundlePath()` (`cli/lib/to-bundle-path.ts`) returns a `file://`
  URL **serialised to a string**: `` `file://${join(projectPath, 'bundle.js')}` ``.
- `createBundle()` (`cli/tasks/GenerateBundleTask.tsx`) runs
  `deno bundle -o bundle.js worker.ts` with `cwd: projectPath` — which
  writes the real `bundle.js` to `projectPath/bundle.js` — then returns
  that `file://` string as `bundlePath`.
- `bundleHeadless()` does `await exists(bundlePath, { isFile: true })`,
  passing the `file://` string straight to `@std/fs`'s `exists`.

`@std/fs`'s `exists(path: string | URL)` treats a **string** as a
literal filesystem path and resolves `file://` only when given a
**`URL` object**. The string `"file:///…/bundle.js"` is not a real
path, so `exists` returns `false` for a file that genuinely exists and
`bundleHeadless` throws "wasn't written". Both halves were measured:
`deno bundle -o bundle.js entry.ts` (cwd=X) on Deno 2.7.14 writes
`X/bundle.js` — so `deno bundle` places the output exactly where
`bundleHeadless` looks — and `exists("file://" + realFile)` → `false`
while `exists(new URL("file://" + realFile))` → `true` and
`exists(plainPath)` → `true`.

**What was expected:** the check is, by its own comment, a
"belt-and-braces ... readback [to] confirm the file actually landed on
disk before declaring success." Fed a `file://` string, it can never
pass.

**Why it matters:** `skmtc bundle` is one of the two core pipeline
commands, and this makes it fail **100% of the time for any project
with a local (cloned or authored) generator** — `deno bundle`
succeeds, the bundle is written, and the CLI's own safety check
rejects it. Remote-only projects are unaffected: `bundleHeadless`
returns its `noop: 'remote-only'` branch before reaching
`createBundle`, which is why the bug stayed dormant. The check was
added to "close the silent-success class of bug"; it instead
introduced a guaranteed false-negative. `git blame`:
`cli/lib/bundle-headless.ts` was created — the check and all — in a
single commit, `886ac2cc "update cli structure"` (2026-05-11), and has
no other commits, so the file was born with the bug. It stayed latent
because in the lab this code path was blocked earlier by #3 (naming)
then #2 (Deno version) — this verification run is the first to clear
both and reach the guard.

**Possible fixes:** pass `new URL(bundlePath)` to `exists` (a `URL`
object resolves `file://` correctly — measured); or have `toBundlePath`
/ `createBundle` return a plain filesystem path and `new URL()` it only
where a URL is genuinely needed (e.g. a dynamic `import()`); or drop
the readback and trust `deno bundle`'s exit code (`createBundle`
already throws on `!success`).

**Version anchor:** `@skmtc/cli@0.3.4` (bug introduced 2026-05-11 in
`886ac2cc`); observed on Deno 2.7.14 with `@skmtc/core@0.6.2`.

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 / K5 — `bundleHeadless` existence check false-negatives | `skmtc bundle` fails 100% for any project with a local generator — `deno bundle` succeeds and writes the file, then the CLI's own check rejects it. The single hard blocker on the `bundle` pipeline. | SKMTC CLI code — `exists(new URL(bundlePath))`, or have `toBundlePath` return a plain path |
| 2 | #1 / K2 — bundle error opacity | Every `skmtc bundle` failure collapses to one opaque message; the real cause is in an undocumented file. Affects all bundle debugging. | `skmtc-debug` skill (add "read `.settings/error-logs.txt`") + SKMTC CLI code (surface stderr in the error / JSON result) |
| 3 | #2 / K1 — undocumented Deno ≥ 2.4 floor | A silent, inscrutable failure for anyone on a pre-2.4 Deno 2.x. | CLI reference / install docs (state the floor) + a `deno --version` check in the CLI |
