# skmtc eject

> Take ownership of a generated file. The file is renamed to drop the
> generated suffix, generators stop writing it, peer imports follow the
> owned path on the next generate, and it is never overwritten or
> deleted.

Generated files are overwritten on every `skmtc generate` run — editing
one directly loses the edit on the next regenerate. `eject` is the
sanctioned way to keep a manual change: it converts the file from
engine-owned output into ordinary hand-written source.

Concretely, ejecting `src/types/user.generated.ts`:

1. **Renames** it to `src/types/user.ts` (the generated suffix —
   `settings.generatedSuffix`, default `.generated` — is removed).
   A pre-flight check refuses to eject when a file already exists at
   the owned name.
2. **Records ownership** in `client.json#settings.ejected` (the
   authoritative set the engine and writer honor) and provenance
   metadata in `.settings/ejections.json` — when it was ejected, which
   generator items produced it (from the generation map, when
   available), and the last-generated content hash.
3. **Re-keys the generated lock entry** — the base a future `adopt`
   resolves from.

From the next `skmtc generate` on:

- The engine stores the owned path into `ContentSettings` for this
  item, so **every peer import specifier points at the owned file
  automatically** — no import fixing, in any language.
- The item still renders in memory (its content is the input for drift
  detection), but the CLI **never writes it and never deletes it** —
  not during generate's stale-artifact prune and not during
  `skmtc clean`.
- `skmtc status` classifies the file as `ejected` (expected to differ
  from generated output — it does not count as dirty).

Reverse with [`skmtc adopt`](./adopt.md).

## Synopsis

```
skmtc eject [project] [file] [--json]
```

Headless-only (text or `--json`), like `clean` and `status`.

## Arguments

### `[project]`

The target project name. Required — a missing value exits with a recipe
error (exit 2) pointing at `ls .skmtc/`.

### `[file]`

The generated file to eject: either its on-disk path as `skmtc status`
lists it (`src/types/user.generated.ts`) or its export path
(`@/types/user.generated.ts`). Required. The file must be tracked by
the project's manifest and exist on disk.

## Options

### `--json`

Write the structured result to stdout: the owned export path and
on-disk path, the previous path, and the contributing generator items.
On failure: `{ ok: false, reason }` with exit 1.

## Behavior notes

- Hand-written imports of the old specifier (in the consumer's own,
  non-generated code) are NOT rewritten — generated importers self-heal
  on the next generate, but hand-written ones need a manual update.
- Contributing generator items are read from the gen-maps generation
  map (`.maps/_map.ndjson`) when the project has anchors enabled;
  without it the record's `items` list is empty.
- A `settings.ejected` entry added by hand (without `skmtc eject`) is
  legal: the engine and writer honor it identically; it just has no
  recorded metadata and no rename was performed for it.
- Exit codes: `0` ejected, `1` refused (untracked file, already
  ejected, missing on disk, or collision at the owned name), `2` recipe
  error (missing arguments).

## See also

- [adopt](./adopt.md) — the symmetric inverse.
- [status](./status.md) — lists generated files and their states.
- [client.json schema](../settings/client-json-schema.md) —
  `settings.ejected`, `settings.generatedSuffix`.
