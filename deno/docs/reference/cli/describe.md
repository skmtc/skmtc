# skmtc describe

> Report a project's preview metadata by running its bundle
> read-only: supported subjects (operations / models) per generator,
> the form-renderable enrichment descriptors, and the schema-derived
> enrichment defaults.

`describe` loads the project's `bundle.js` and the schema, then asks
each installed generator what it *would* act on — without writing any
files. It's the introspection half of `generate`: the same
subject-support decisions, reported instead of executed.

## Synopsis

```
skmtc describe [project] [schema] [--json]
```

Like `clean` and `doctor`, `describe` has no interactive Ink variant —
it always runs headless and emits text or `--json`.

## Arguments

### `[project]`

The target project name. Required — when omitted, the CLI exits with a
recipe error (exit 2) pointing at `ls .skmtc/` to discover valid
project names. (Declared optional in the parser only so the recipe
error fires instead of a terse "missing argument".)

### `[schema]`

Schema source (URL or local path). Optional; falls back to
`client.json#source`, exactly like [`generate`](generate.md).

## Options

### `--json`

Write the metadata as a single structured JSON object to stdout.
Implies `--no-input`.

## Output

Per generator:

- **Supported subjects** — the operations (path + method) or models
  (ref names) the generator's `isSupported` accepts for this schema.
- **Enrichment descriptors** — the generator's enrichment schema in a
  form-renderable shape (what a UI would render to collect enrichment
  values).
- **Enrichment defaults** — the schema-derived default enrichment
  values.

## See also

- [generate](generate.md) — the write half of the same pipeline
- [Enrichments concept](../../concepts/enrichments.md)
