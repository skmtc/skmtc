# 2026-07-12 — Format-agnostic attribution (spike → release)

Built and released the full format-agnostic-attribution track in one
session: Phase 0 corpus spike, host-side sidecar post-pass (core + CLI),
reader re-anchoring (`@skmtc/vite`), formatted-coordinate emission, and the
desktop rail UX — plus the release cascade and two release-pipeline
failures found and fixed along the way (PRs #66, #72, #75).

## Knowledge acquired

Working across `core/anchors`, the CLI generate/write pipeline, the vite
plugin's gen-map reader, and the release/publish tooling.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | Sidecar spans are **UTF-16 code units** (`CaptureSink` uses `indexOf`/`String.length`), while the `fromByte`/`toByte` names and the attribution concept doc say "byte spans" — and oxc's own offsets are UTF-8 bytes, so the two only coincide for ASCII. Had to be settled from source. | Fix "byte" wording in `concepts/attribution-and-gen-maps.md`; consider renaming the row fields at the next format rev |
| K2 | Two oxc AST node kinds are **formatting artifacts that break child-index paths**: whitespace-only `JSXText` (JSX reflow inserts/removes them, shifting sibling indices) and `ParenthesizedExpression` (formatters freely add/drop parens, e.g. around a reflowed JSX return). Traversal must filter/unwrap them on BOTH the record and descend sides. Found empirically via a 22k-anchor corpus + a test that reflowed a single-line JSX return. | Now encoded in `oxcAdapter` comments + the traversal-conformance fixture; add a paragraph to the attribution concept doc's re-anchor section |
| K3 | `deno task bump <pkg> --minor` is the only safe way to stage a release: hand-bumping one package's version leaves workspace-internal pins on the old version, deno resolves the published copy alongside the local one, and **the pre-push doc-test fails on the resulting split type identities**. The bump task rewrites pins + patch-bumps dependents exactly like the release cascade. | Root-level release docs mention `deno task release`; add the bump-task requirement (and the failure signature) to the same section |
| K4 | Version bumps must be **in the feature PR before merge** — the merge-time `deno task release` publishes only versions not yet on the registry, so a PR without bumps strands its packages unpublished and needs a follow-up bump PR (happened to core/cli here; previously happened to `@skmtc/vite`). | Same release-doc section as K3 |
| K5 | The CLI's install shim must include `--unstable-worker-options` (`deno install` bakes flags into the shim). Without it, `skmtc generate` dies with `Unstable API 'Worker.deno.permissions'` (exit 70). The only written trace of the correct install command is an old friction-log entry. | `deno/cli/README.md` install section + skmtc-cli skill |
| K6 | `deno publish --dry-run` on core fails with 16 pre-existing slow-type findings; the release task runs with `--allow-slow-types`, so dry-runs must use the same flags to reflect reality. | One-line note in core CLAUDE.md / release docs |
| K7 | The repo's pre-push hook (`deno task check`) is a stronger gate than CI (which only runs coverage + publish): GitHub merges bypass it, so main can carry hook-failing states (ratchet baselines, doc-test) that then block the NEXT person's push. `verify-docs.ts --update-reader-baseline` is the ratchet-shrink remedy. | Contributor/release docs; possibly run `deno task check` in CI |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `settings.formatter` shipped decoupled from attribution — every formatted artifact instantly stale | friction | resolved 2026-07-12 (PR #66) |
| 2 | `packages/core` is a gitignored pnpm workspace member — plain `pnpm install` strands npm publishes | friction | open (lockfile restored in PR #75; structural fix open) |
| 3 | CLI install flags are undocumented; a flagless reinstall produces a broken `skmtc` | friction | open |
| 4 | Verification read stale artifacts because a pipeline masked the generate exit code | friction | open |
| 5 | Shared-fixture conformance test for deliberately hand-mirrored code | win | open |

---

### 1. `settings.formatter` shipped decoupled from attribution — every formatted artifact instantly stale [friction]

The eject/adopt work (PR #54) added `client.json#settings.formatter`,
running the consumer's formatter over freshly written artifacts.

**What happened:** sidecars were still written in raw-render coordinates
and manifest `characters` stayed the raw length, so the moment the
formatter ran, every generated file's on-disk length diverged from the
manifest and the gen-map reader dropped the whole file as stale. A
flagship feature (run the user's formatter) silently defeated another
flagship feature (attribution) on every generate.

**What was expected:** that a feature writing artifacts through a
formatter would keep the run's other write-products (sidecars, manifest
metadata) describing the same bytes.

**Why it matters:** the run's artifacts form a coherence set — file
contents, manifest `characters`/`lines`, sidecar spans — and any step
that rewrites one member must update the others or explicitly mark them
stale. This session's fix (realign spans + manifest together, and only
together — realigning the manifest without the spans would silence the
reader's drift trigger and serve wrong spans) is the general shape of
the invariant.

**Possible fixes:** resolved by PR #66 (host-side post-pass +
`reanchorSidecar` + lockstep manifest realignment). The remaining
reflection: is there a place to *state* the coherence-set invariant so
the next write-path feature doesn't repeat this?

**Version anchor:** `@skmtc/core@0.26.0 → 0.27.0`, `@skmtc/cli@0.9.28 → 0.9.29`

**Status:** resolved 2026-07-12 (PR #66)

### 2. `packages/core` is a gitignored pnpm workspace member — plain `pnpm install` strands npm publishes [friction]

Found when the Publish run for the release-bump merge failed its npm
step.

**What happened:** `packages/core` is dnt-generated and gitignored, but
it is a pnpm workspace member. Running `pnpm install` in a checkout
without a local dnt build (any fresh worktree) silently prunes the
`packages/core` importer from `pnpm-lock.yaml`. The committed lockfile
then fails CI's `pnpm install --filter @skmtc/core --frozen-lockfile`,
stranding the npm publish while JSR ships fine — a half-released
version.

**What was expected:** that a routine `pnpm install` (needed to add a
dependency elsewhere) could not corrupt the release pipeline's inputs.

**Why it matters:** a generated-but-workspace-registered package makes
the lockfile depend on transient local build state. Every contributor
who touches pnpm without knowing to run `deno task build` in core first
will re-introduce the corruption; the failure surfaces much later, in
CI, on an unrelated merge.

**Possible fixes:** unresolved — candidates: run the dnt build in the
workflow before the frozen install; commit a minimal
`packages/core/package.json` so the importer is stable; or drop
`packages/core` from the pnpm workspace and install it standalone in
CI.

**Version anchor:** `@skmtc/core@0.27.0`, Publish workflow @ PR #72/#75

**Status:** open (lockfile restored in PR #75; structural fix open)

### 3. CLI install flags are undocumented; a flagless reinstall produces a broken `skmtc` [friction]

Upgrading the installed CLI to the freshly released 0.9.29.

**What happened:** `deno install -Argf jsr:@skmtc/cli@0.9.29` produced a
shim that fails every `generate` with `Unstable API
'Worker.deno.permissions'. The --unstable-worker-options flag must be
provided` (exit 70). The flag has to be given at *install* time because
`deno install` bakes flags into the shim. The correct invocation exists
nowhere in current docs — I found it in a 2026-05-12 friction-log entry.

**What was expected:** the CLI README's install section to carry the
canonical install command, including required unstable flags.

**Why it matters:** every fresh machine and every version upgrade hits
this; the error message names the flag but not that it must be baked
into the shim, so the natural fix (rerunning generate with the flag)
doesn't exist as an option — `skmtc` is not invoked via `deno run` by
the user.

**Possible fixes:** document the canonical install command in
`deno/cli/README.md` and the skmtc-cli skill; longer-term, `deno
compile` distribution or dropping the unstable worker-permissions
dependency removes the flag entirely.

**Version anchor:** `@skmtc/cli@0.9.29`, Deno 2.x

**Status:** open

### 4. Verification read stale artifacts because a pipeline masked the generate exit code [friction]

The first "released-stack e2e" run in this session.

**What happened:** `skmtc generate … | tail -2 && <verify>` — generate
failed (exit 70, the entry-3 shim problem) but the pipeline's exit code
came from `tail`, so the verification chain proceeded and validated the
*previous* run's artifacts: manifest aligned, spans formatted,
everything green. Only a rerun without the pipe exposed the failure.

**What was expected:** a failing generate to stop the `&&` chain.

**Why it matters:** SKMTC's write-products (manifest, sidecars,
artifacts) persist across runs by design, which makes stale-success a
distinctive trap: a failed generate leaves a fully plausible,
self-consistent previous state on disk. Verification of a generate must
therefore (a) take the exit code from the generate itself, never a
pipeline tail, and (b) ideally assert freshness (mtime or a nonce
change) before validating content.

**Possible fixes:** unresolved — could be a line in the skmtc-debug
skill's verify-first stance ("generate success = its own exit code +
fresh manifest mtime, not plausible artifacts").

**Version anchor:** `@skmtc/cli@0.9.29`

**Status:** open

### 5. Shared-fixture conformance test for deliberately hand-mirrored code [win]

The vite gen-map reader intentionally re-implements the core adapter's
AST traversal rather than importing `@skmtc/core` (bundle-isolation
stance), guarded only by "must match exactly" comments.

**What happened:** review asked for the comments to become a check. The
shape that worked: one JSON fixture whose expected values (landmark,
child-index path, formatted slice) are *recorded by the core adapter*,
then asserted by BOTH sides — a Deno test in core (records + descends)
and a vitest in the vite package (descends only). The fixture bakes in
the three hard traversal cases (JSX reflow with paren-add, non-exported
landmark, parenthesized union), so either implementation drifting — or
an oxc version bump reordering AST keys — fails a test in the package
that drifted.

**Why it matters:** SKMTC has several deliberately-unshared mirrors
(the hub's sidecar reader, the vite reader, the core adapter — the
"hand-mirrored with defensive narrowing" stance). Without this pattern,
each mirror is protected only by comments; another agent adding a
traversal rule to one side would likely not know the others exist. A
recorded-by-the-authority fixture asserted by every mirror is cheap and
converts the lockstep requirement into CI signal.

**Possible fixes:** n/a — candidate for the skmtc-architecture skill's
invariants section ("mirrored implementations must share a conformance
fixture"), and the hub's gen-map reader could join the same fixture.

**Version anchor:** `@skmtc/core@0.27.0`, `@skmtc/vite@0.7.0`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #3 — CLI install flags undocumented | Every fresh install/upgrade of the released CLI produces a broken binary; the fix is one documented command. | `deno/cli/README.md` install section + skmtc-cli skill |
| 2 | #2 — gitignored workspace member corrupts the lockfile | Any contributor's `pnpm install` can silently strand future npm releases; needs a structural fix, not just the restored lockfile. | SKMTC code (Publish workflow or workspace layout) |
| 3 | K3/K4 — bump task + bump-in-PR release requirements | Two releases in a row were stranded or broken by hand-managed versions; the failure signatures are non-obvious (doc-test type-identity errors). | Release section of root CLAUDE.md / contributor docs |
