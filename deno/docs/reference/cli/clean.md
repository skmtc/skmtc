# skmtc clean

> Delete a project's generated files (and its manifest), pruning any
> directories the deletions leave empty. The inverse of the write
> half of `generate`.

`clean` reads a project's
`.settings/manifest.json` — the per-run record of every file the
last `generate` wrote — and deletes each of those files from disk.
It then prunes the directories those files lived in (only the ones
it emptied) and removes the manifest itself, returning the project
to its pre-generation state. It's `make clean` for SKMTC.

This is distinct from the *incremental* prune that runs inside
`generate`: that one deletes only the files the **next** run won't
rewrite (stale artifacts from a removed generator, a renamed
output). `clean` deletes the **full** set the manifest records.

`clean` is a local-only operation — it never contacts JSR, never
rebundles, and never touches generator source or `client.json`.

## Synopsis

```
skmtc clean [project] [--json] [--dry-run] [--verbose]
```

Like `doctor` and `agent-context`, `clean` has no interactive Ink
variant — it always runs headless and emits text or `--json`. There
is no confirmation prompt; use `--dry-run` to preview first.

## Arguments

### `[project]`

The target project name. Required — when omitted, the CLI exits with
a recipe error (exit 2) pointing at `ls .skmtc/` to discover valid
project names. (Declared optional in the parser only so the recipe
error fires instead of a terse "missing argument".)

## Options

### `--dry-run`

Enumerate the files that would be deleted and the directories that
would be pruned, without touching disk. The manifest is left in
place. Recommended before a real run, since deletion is irreversible.

The dry-run directory report is a full simulation: a parent
directory is reported as "would remove" only if every entry it holds
is either a file being deleted or a subdirectory that would itself be
removed.

### `--verbose`

In text output, list every deleted file path and every pruned
directory, not just the counts. No effect on `--json` (which always
carries the full lists).

### `--json`

Write a single JSON object to stdout. Logs and warnings go to
stderr. Implies non-interactive.

## Behavior

### Files deleted

Every key in `manifest.files` is resolved relative to the app root
(the directory containing `.skmtc/`) and deleted. A manifest key that
resolves *outside* the app root (a stray `..` segment) is refused as
a safety guard and reported under `skipped` — never deleted.

Files already absent from disk (e.g. a manual delete since the last
generate) are counted under `missing` and otherwise ignored.

### Empty directories pruned

After the files are gone, `clean` prunes the directories they
occupied — but only the ones it emptied. The walk starts at each
deleted file's parent and climbs, removing a directory only while it
is empty and stopping at the first non-empty ancestor. A directory
holding anything you didn't generate (a hand-written file alongside
generated ones) is never removed.

The climb is bounded by the project's **output anchors** so it can
never remove the anchor itself or anything above it:

- **`basePath`** (`client.json#settings.basePath`) — the floor. Never
  removed, even if a project generated everything under it.
- **Each `packages[].rootPath`** (multi-package output) — a package
  root below the floor. Never removed.

If `basePath` is absent from `client.json`, directory pruning is
**skipped entirely** rather than guessed at — deleting a directory is
destructive and a wrong floor could take out `src/`.

### Manifest removed

On a real run (not `--dry-run`), the manifest file itself is deleted
last. After `clean`, the project has no manifest, which accurately
reflects "nothing generated." The next `generate` writes a fresh one.
A subsequent `clean` on the same project is a no-op (reports
`noManifest`).

### Tolerant manifest read

A missing, malformed, or schema-mismatched manifest degrades to a
no-op (the `noManifest` result), with a warning on stderr — `clean`
never aborts mid-way on a bad manifest.

## JSON output

```jsonc
{
  "projectName": "demo",
  "dryRun": false,
  // BasePath-relative paths that were deleted (or, on a dry run,
  // would be deleted).
  "deleted": [
    "src/generated/types/User.ts",
    "src/generated/api.ts"
  ],
  // Manifest-recorded paths already absent from disk.
  "missing": [],
  // Manifest-recorded paths refused for resolving outside the app
  // root. Empty in normal operation.
  "skipped": [],
  // Directories removed (or, on a dry run, that would be removed)
  // because the deletions emptied them. App-root-relative.
  "removedDirs": ["src/generated/types"],
  // Whether the manifest file itself was removed (false on dry run
  // or when there was no manifest).
  "manifestRemoved": true,
  // True when the project had no manifest — clean was a no-op.
  "noManifest": false
}
```

The shape matches `CleanHeadlessResult` in
`cli/lib/clean-headless.ts`.

## Examples

### Preview a clean

```bash
skmtc clean my-api --dry-run --verbose
```

Lists every file that would be deleted and every directory that would
be pruned. Touches nothing.

### Clean a project

```bash
skmtc clean my-api --json
```

Deletes the generated files, prunes emptied directories, removes the
manifest. Returns the structured result above.

### Regenerate from a clean slate

```bash
skmtc clean my-api --json && skmtc generate my-api --json
```

Useful when stale output has accumulated and you want a guaranteed
fresh tree rather than relying on the incremental prune.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — including the no-op case (no manifest to clean) |
| `1` | Operational failure |
| `2` | Required `project` argument missing (recipe error on stderr) |

## What `clean` does *not* do

- Does **not** rebundle, contact JSR, or touch `bundle.js` /
  `worker.ts`.
- Does **not** modify `client.json` (enrichments, skip/include,
  basePath) or `deno.json` — generator *configuration* is untouched.
  Use [`remove`](remove.md) to uninstall a generator.
- Does **not** delete files the current manifest doesn't record. If
  you hand-deleted the manifest, or a file was written by a tool
  other than SKMTC, `clean` won't find it.
- Does **not** prune directories when `basePath` is unset — see
  *Empty directories pruned* above.
- Does **not** prompt for confirmation. `--dry-run` is the safety
  valve.

## See also

- [`skmtc generate`](generate.md) — produces the files `clean`
  removes; its internal prune is the *incremental* counterpart
- [`skmtc remove`](remove.md) — removes a *generator* (config +
  cloned source), not generated output
- [`skmtc doctor`](doctor.md) — inspects the manifest `clean` reads
- [Manifest format](../manifest-format.md) — the `files` record
  `clean` walks
- [client.json schema](../settings/client-json-schema.md) — `basePath`
  and `packages`, the anchors that bound directory pruning
