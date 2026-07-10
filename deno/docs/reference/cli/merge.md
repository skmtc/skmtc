# skmtc merge

> Resolve drift on an ejected file: a three-way merge that keeps your
> edits and applies the generator's changes, advancing the baseline.
> Refuses whole on collisions — never writes conflict markers. The
> file stays ejected.

An ejected file drifts when its generator starts producing something
different from the baseline the edits were made against (a schema
change, a generator update — see the drift states in
[`skmtc status`](./status.md)). When `status` reports the drift as
**non-overlapping** — the generator's changes don't touch the edited
regions — `merge` resolves it mechanically.

The three sides:

- **base** — the committed baseline (`.settings/baselines/`), what the
  generator produced when the file was ejected
- **ours** — your file on disk, edits included
- **theirs** — the last pristine render, persisted by `generate` each
  run (ejected items still render in memory; `merge` itself never runs
  the engine)

On success:

1. The merged content (your edits + the generator's changes) is
   written to the file, and formatted when `settings.formatter` is
   configured.
2. The baseline advances to the pristine render (both the committed
   content and `baselineHash` in `.settings/ejections.json`), so
   future drift compares against what was just folded in. Any
   `reviewedPristineHash` is cleared — there is no outstanding drift
   left to stay quiet about.
3. The file **stays ejected**. Merge resolves drift; returning the
   file to generation is [`skmtc adopt`](./adopt.md).

On a collision (both sides changed the same baseline region), nothing
is written at all — the command reports the colliding baseline line
ranges and leaves the file exactly as it was. Resolve by hand using
the pristine render (its path is in the failure message), then
acknowledge the drift by setting `reviewedPristineHash` in
`.settings/ejections.json` to the current pristine hash.

## Synopsis

```
skmtc merge [project] [file] [--json]
```

Headless-only (text or `--json`), like `eject` and `adopt`.

## Arguments

### `[project]`

The target project name. Required — a missing value exits with a
recipe error (exit 2) pointing at `ls .skmtc/`.

### `[file]`

The ejected file: its on-disk path (`src/types/user.ts`) or its export
path (`@/types/user.ts`). Required.

## Options

### `--json`

Write the structured result to stdout. Success carries `upToDate`
(true when there was nothing to merge); a collision refusal carries
the colliding baseline line ranges. Exit 1 on any refusal.

## Behavior notes

- Requires a `skmtc generate` run since ejecting (that run persists
  the pristine render `merge` reads) and the committed baseline from
  eject time.
- When `settings.formatter` is configured, base and theirs are
  re-formatted under the current config before the line-based merge —
  your on-disk file is formatted, so comparing canonical renders
  against it would make every line differ.
- The merge is line-based with conservative boundary handling: changes
  that touch at a shared boundary line count as collisions rather than
  being reordered silently.
- Exit codes: `0` merged (or already up to date), `1` refused
  (collision, not ejected, missing baseline or pristine render), `2`
  recipe error (missing arguments).

## See also

- [status](./status.md) — drift states and overlap classification.
- [eject](./eject.md) / [adopt](./adopt.md) — ownership transitions.
