# skmtc explain

> Explain a provenance subject from the last run: the real output of
> a producer class, or the generator and artifact that settled a
> definition name.

`explain` reads the same provenance maps as [`trace`](./trace.md).
The maps come from `skmtc generate --anchors` and live under
`.skmtc/<project>/.maps/`. The command answers the two questions that
otherwise cost the most exploration: "what does this Snippet or
Projection class produce?" and "who owns this name?". One real output
sample beats a reconstruction from API docs.

## Synopsis

```
skmtc explain producer <Class> [project] [--generator <id>] [--json]
skmtc explain ref <Name> [project] [--json]
```

## Subjects

### `producer <Class>`

What a producer class wrote in the last run:

- `sources` — the `<file>:<line>` of the class declaration in the
  project's cloned generator source.
- `spanCount` / `fileCount` — the amount of output it produced.
- `samples` — up to three slices of real generated code. The
  selection prefers narrow spans that carry a schema pointer, from
  distinct artifacts, with a length cap. Each sample names its
  artifact path, schema pointer, and variant.

A class with no spans gets a note, not an error — it is a new or
unexercised producer. Bare class names can collide across packages.
Scope with `--generator <id>` when they do.

### `ref <Name>`

What the last run settled for a definition name, from the
`.maps/_map.ndjson` registry index. The answer names the artifact
that holds it, the generator that claims it, its schema pointer, and
its variant. An unknown name returns an empty list with a note. Check the casing
against the registered Definition identifier.

This subject shows only the settled state. Live hit-or-miss
prediction — what an `insertModel` from *here* would do — needs the
engine and is not part of this command.

## Options

### `--json`

The command writes one structured JSON object to stdout. Both
subjects carry the same `freshness` header as [`trace`](./trace.md):
`generatedAt`, maps presence, stale-file count, and the
empty-output-beside-success invariant.

### `-g, --generator <id>` (producer only)

Scope the lookup to one generator package.

## Exit codes

- `0` — the command answered. Empty results with notes count as
  answers.
- `1` — the command found no SKMTC project.
- `2` — the subject is not `producer` or `ref`.

## Example

```
$ skmtc explain producer ZodObject --json | jq '.spanCount, .sources[0], .samples[0].code'
984
".skmtc/skmtc-reapit/gen-zod/src/ZodObject.ts:34"
"z.record(z.string(), z.unknown())"
```

## See also

- [`trace`](./trace.md) — the other direction: from a generated file
  position to its producers.
- [`describe`](./describe.md) — capability introspection: what the
  installed generators can do, as opposed to what they did.
