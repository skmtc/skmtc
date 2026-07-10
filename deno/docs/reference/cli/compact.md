# skmtc compact

> Rewrite a project's `client.json` in the compact (minified +
> string-interned) on-disk form, or restore the human-readable form
> with `--expand`. A lossless format toggle.

`compact` converts a project's `.settings/client.json` between two
on-disk forms:

- **Expanded** — the human-readable, pretty-printed object. What `init`
  and every other command write by default.
- **Compact** — a machine-focused form: minified, with every string
  (object keys and values alike) interned once into a shared pool and
  referenced by index. Gated by a top-level `compact: true` flag.

The compact form is ~5–6× smaller than expanded on an enrichment-heavy
project (for example, 650 KB → ~115 KB). The saving is on the
**uncompressed** at-rest bytes; under gzip the two forms are about
equal, because gzip already captures the string repetition that
interning removes.

The conversion is lossless — it round-trips through the codec (or
through expansion + pretty-print) without going through the settings
schema, so no keys are dropped and nothing but whitespace and string
encoding changes. Every other command reads either form transparently:
a compact file is expanded in memory before validation, so `generate`,
`push`, `doctor`, and the rest behave identically on either form.

`compact` is a local-only operation — it never contacts JSR, rebundles,
or touches generator source.

## Synopsis

```
skmtc compact <project> [--expand] [--json]
```

Like `doctor` and `clean`, `compact` has no interactive Ink variant — it
always runs headless and emits text or `--json`.

## Arguments

### `<project>`

The target project name. Required — when omitted, the CLI exits with a
recipe error (exit 2) pointing at `ls .skmtc/` to discover valid project
names.

## Options

### `--expand`

Restore the human-readable (expanded) form instead of compacting. The
default (no flag) rewrites in the compact form.

### `--json`

Write a single JSON object to stdout. Logs and warnings go to stderr.
Implies non-interactive.

## Behavior

`compact` reads `.settings/client.json`, detects its current form from
the `compact` flag, and rewrites it in the requested form:

- **Already in the target form** — no write; the result reports
  `changed: false`.
- **No `client.json`** — no-op; the result reports `missing: true`.
- **Otherwise** — the file is expanded in memory (so the source form is
  irrelevant), then re-emitted in the requested form.

The conversion is idempotent: running `skmtc compact <project>` twice
leaves the file unchanged the second time.

Do not hand-edit a compact file — it is not human-readable. Run
`skmtc compact <project> --expand` first, edit, then re-compact.

### Compact form on disk

```jsonc
{
  "compact": true,   // discriminator — present only on compact files
  "cv": 1,           // compact format version
  "pool": ["project", "@acme/api", "source", "settings", "basePath", "..."],
  "doc": [5, ["..."]]  // the settings tree, with every string replaced by a pool index
}
```

## JSON output

```jsonc
{
  "projectPath": "/abs/path/.skmtc/my-api",
  "clientJsonPath": "/abs/path/.skmtc/my-api/.settings/client.json",
  // True when the project has no client.json to convert (no-op).
  "missing": false,
  // The form the file was already in before this run.
  "wasCompact": false,
  // The form requested — true for compact, false for expanded.
  "toCompact": true,
  // Whether the file was rewritten (false when already in the target form).
  "changed": true,
  "beforeBytes": 652675,
  "afterBytes": 115632
}
```

The shape matches `CompactHeadlessResult` in
`cli/lib/compact-headless.ts`.

## Examples

### Compact a project's client.json

```bash
skmtc compact my-api --json
```

Rewrites `.settings/client.json` in compact form and reports the byte
counts.

### Restore the human-readable form

```bash
skmtc compact my-api --expand --json
```

Expands a compact file back to the pretty-printed form for hand-editing.

### Round-trip to hand-edit a compacted file

```bash
skmtc compact my-api --expand   # make it readable
# edit .skmtc/my-api/.settings/client.json
skmtc compact my-api            # re-compact
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — including the no-op cases (already in the target form, or no `client.json`) |
| `1` | Operational failure (for example, `client.json` is not valid JSON) |
| `2` | Required `project` argument missing (recipe error on stderr) |

## What `compact` does *not* do

- Does **not** validate against the settings schema — it is a pure
  format toggle, so it never drops keys. (Every other command validates
  on read.)
- Does **not** rebundle, contact JSR, or touch `bundle.js` /
  `worker.ts`.
- Does **not** change any setting values — only the on-disk encoding.

## See also

- [client.json schema](../settings/client-json-schema.md) — the settings
  shape that both forms encode
- [`skmtc migrate`](migrate.md) — the other one-shot `client.json`
  transform; preserves whichever form the file is in
- [`skmtc generate`](generate.md) — reads either form transparently
