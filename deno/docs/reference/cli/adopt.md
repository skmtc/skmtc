# skmtc adopt

> Return an ejected file to generation: rename it back to its generated
> name and remove it from `settings.ejected`. The next generate resumes
> writing it — and a file that still carries manual edits is protected,
> never overwritten.

`adopt` is the symmetric inverse of [`skmtc eject`](./eject.md). Use it
when the reason for ejecting has passed: the manual change was moved
into an enrichment or a hand-written module, the schema/generator
caught up and now produces what the edit did, or the edit was
reverted.

Concretely, adopting `src/types/user.ts`:

1. **Renames** it back to its generated name
   (`src/types/user.generated.ts`, from the ejection record — or by
   re-applying `settings.generatedSuffix` when no record exists).
   Refused when files exist at *both* names (resolve the duplicate
   first).
2. **Removes** the entry from `client.json#settings.ejected` and the
   record from `.settings/ejections.json`.
3. From the next `skmtc generate`: the engine emits the suffixed path
   again, peer imports follow, and the file is engine-owned.

**Adopt never destroys content.** If the adopted file's content still
differs from what the generator produces, the next generate detects the
difference and *protects* the file (reports it, leaves it untouched)
rather than overwriting — the prime invariant of edit detection. Adopt
is therefore always safe to try; the worst case is returning to a
protected state.

## Synopsis

```
skmtc adopt [project] [file] [--json]
```

Headless-only (text or `--json`), like `eject`.

## Arguments

### `[project]`

The target project name. Required — a missing value exits with a recipe
error (exit 2) pointing at `ls .skmtc/`.

### `[file]`

The ejected file: its on-disk path (`src/types/user.ts`) or its export
path (`@/types/user.ts`), as listed in `settings.ejected` and marked
`E` by `skmtc status`. Required.

## Options

### `--json`

Write the structured result to stdout: the owned export path and the
generated on-disk path the file returned to. On failure: `{ ok: false,
reason }` with exit 1.

## Behavior notes

- Adopting a file whose on-disk copy was deleted works — ownership is
  released and the next generate rewrites the file.
- Exit codes: `0` adopted, `1` refused (not in the ejected set, or
  duplicate files at both names), `2` recipe error (missing arguments).

## See also

- [eject](./eject.md) — the forward direction.
- [status](./status.md) — ejected files are marked `E`.
- [client.json schema](../settings/client-json-schema.md) —
  `settings.ejected`.
