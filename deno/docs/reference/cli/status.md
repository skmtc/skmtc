# skmtc status

> Classify every generated file against the generated lock: which are
> clean, which carry manual edits (and are protected from overwrite),
> which are missing, plus orphaned files a previous generate spared
> from pruning. Read-only.

`status` answers "what does the tool think is going on?" — it never
writes. It reads the project's `.settings/manifest.json` (the record
of what the last `generate` wrote) and `.settings/generated.lock.json`
(per-file content hashes), compares each tracked file's on-disk
content, and reports a per-file classification. It shares its
classification logic with the `generate` writer, so `status` and
`generate` can never disagree about whether a file is edited.

`status` resolves the configured schema and renders fresh content on
demand — the same schema-resolution + worker invocation `generate`
uses — to disambiguate a formatter-config change from a hand edit, and
to classify ejected files against what the generator would currently
produce. When the schema can't be reached (none configured, unreachable
source, no bundle yet), it degrades to lock-hash-only comparison
instead of failing: safe to run any time, including CI, offline, or
before a project has ever been generated. It never contacts JSR and
never rebundles.

## Synopsis

```
skmtc status [project] [--json] [--check] [--verbose]
```

Like `clean` and `doctor`, `status` has no interactive Ink variant —
it always runs headless and emits text or `--json`.

## Arguments

### `[project]`

The target project name. Required — when omitted, the CLI exits with
a recipe error (exit 2) pointing at `ls .skmtc/` to discover valid
project names. (Declared optional in the parser only so the recipe
error fires instead of a terse "missing argument".)

## Options

### `--check`

Exit `1` when any generated file is `modified` or `orphaned` — the CI
gate. `missing` and `unverified` files do not fail the check
(`missing` is rewritten by the next generate; `unverified` is
indeterminate, not dirty). Nothing is ever mutated.

### `--verbose`

In text output, list every file with its status glyph, not just the
modified ones. No effect on `--json` (which always carries the full
list).

### `--json`

Write a single JSON object to stdout — the full structured result:
per-file entries, the orphaned list, counts per status, and the
overall `clean` boolean. Logs and warnings go to stderr.

## File statuses

- **`clean`** — the on-disk content matches what the last generate
  wrote (directly, or via formatter-drift resolution: re-formatting
  this run's fresh canonical render under the current
  `settings.formatter` config reproduces the disk content, so a
  formatter-config change doesn't read as an edit — only available
  when the schema is reachable this run; see [Behavior notes](#behavior-notes)).
- **`modified`** — the file was hand-edited since the last generate.
  The next `generate` will protect it: no overwrite, no delete.
  Lasting changes belong in enrichments or hand-written modules;
  reverting the file resumes generation for it.
- **`missing`** — the manifest records it but it's gone from disk.
  The next `generate` rewrites it.
- **`unverified`** — no lock entry exists (the project predates edit
  detection, or a fresh clone without the lock). Run
  `skmtc generate` once to seed the lock; classification activates
  from the following run.
- **`ejected`** — user-owned by declaration
  (`client.json#settings.ejected`, glyph `E`). Expected to differ from
  generated output, never overwritten or deleted; does not count as
  dirty for `--check`. See [eject](./eject.md) / [adopt](./adopt.md).

### Live state for ejected files

Ejected is binary — owned until `skmtc adopt` — so there's no drift
history to track or acknowledge, only whether the file currently
matches what the generator would produce right now. Each `ejected`
entry carries this live state, computed fresh each run against
`status`'s own resolved schema (absent when the schema couldn't be
reached this run):

- **`re-adoptable`** — the disk file matches current generated output
  (edit reverted, or the generator caught up): run `skmtc adopt`.
- **`owned`** — the disk file differs from current generated output.
  Expected and unremarkable — the file is the user's by design.
- **`stale`** — no generator produces the file anymore (schema item
  removed or renamed). Stale ejections that left the manifest are
  listed separately.

### Orphaned files

Lock-tracked paths that the manifest no longer records: stale files a
previous `generate` would have pruned but spared because they carried
manual edits. They are no longer produced by any generator — the
edits are the user's to keep or move; the files are listed so they
aren't forgotten.

## Behavior notes

- A missing or unreadable manifest reports `noManifest` — the project
  has nothing generated to classify.
- A malformed or stale-schema lock degrades tolerantly: files report
  `unverified` and the next generate reseeds the lock.
- Formatter-drift resolution shells out to `settings.formatter` (via
  `sh -c`, one adjacent hidden temp file per suspect file); with no
  formatter configured, comparison is raw content hashes only.
- When no schema is configured, the schema source is unreachable, or
  the project has no `bundle.js` yet, `status` degrades to comparing
  the lock's recorded hashes only — formatter-drift resolution and
  ejected-file sub-state are unavailable for that run, but `modified`
  detection for ordinary edits still works.

## See also

- [generate](./generate.md) — writes the lock `status` reads; protects
  modified files.
- [clean](./clean.md) — deletes the full generated set.
- [client.json schema](../settings/client-json-schema.md) —
  `settings.formatter`, `settings.generatedSuffix`.
