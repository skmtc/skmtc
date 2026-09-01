# skmtc trace

> Show which producers, generator package, and schema element wrote a
> position in a generated file. The answer comes from the provenance
> maps of the last run.

`trace` answers "where did this line come from?". Without it, you
grep generator sources and re-run `skmtc generate`. The engine writes
attribution sidecars under `.skmtc/<project>/.maps/` when you run
`skmtc generate --anchors`. `trace` reads those sidecars, so it
describes the artifacts on disk. Every answer carries a freshness
header that tells you which run it describes.

## Synopsis

```
skmtc trace <location> [project] [--json]
```

### `<location>`

Use `<file>:<line>[:<col>]` with a 1-based line and column. This is
the shape of a compiler error, so you can paste a TS diagnostic
directly. Give the file path relative to the workspace root, or
absolute. If you omit `[project]`, the command searches each
project's manifest for the file.

## Options

### `--json`

The command writes one structured JSON object to stdout. The shape:

- `freshness` — `generatedAt`, `manifestPresent`, `mapsPresent`,
  `staleFileCount`, and `invariants` (`emptyFileCount`,
  `successCount`, `emptyOutputWithSuccess`). If
  `emptyOutputWithSuccess` is `true`, the run is in the fail-open
  "success with no output" state. Do not trust the artifacts of such
  a run.
- `chain` — the producers that cover the position, innermost first.
  Each hop names the producer class, generator package, schema
  pointer, variant, and span offsets. A schema pointer of `""` means
  the span has no attribution. `producerSource` gives the
  `<file>:<line>` of the class declaration in the cloned generator
  source. The value is `null` when the class lives outside the
  clones, for example in a lang package.
- `notes` — plain statements of degradations: stale attribution,
  absent maps, no span at the position.

## Exit codes

- `0` — the command answered. An empty chain is a real answer: no
  span covers that position.
- `1` — the command could not answer. The file is not in a project
  manifest, or the file is not readable.
- `2` — the `<location>` argument does not match
  `<file>:<line>[:<col>]`.

## Requirements

Provenance maps must exist. Run `skmtc generate <project> --anchors`,
or set `settings.anchors.enabled` in client.json. Without `.maps/`,
`trace` exits `0` with an empty chain and a note.

A project formatter can reshape files after a run. `trace` then
re-anchors the spans against the current text where possible. When
re-anchor fails for a file, `trace` reports that file as stale. It
never gives a wrong answer for a stale file.

## Example

```
$ skmtc trace src/types/apiErrorModel.generated.ts:5:6
src/types/apiErrorModel.generated.ts:5:6 (skmtc-reapit)
generated: 2026-07-17T17:37:36.869Z · maps: present · stale files: 0

  TsInteger · @reapit/gen-typescript · (unattributed) · main  ← .skmtc/skmtc-reapit/gen-typescript/src/TsInteger.ts:13
  TsProjection · @reapit/gen-typescript · #/components/schemas/ApiErrorModel · main  ← .skmtc/skmtc-reapit/gen-typescript/src/TsProjection.ts:14
  TsDefinition · @reapit/gen-typescript · #/components/schemas/ApiErrorModel · main
```

## See also

- [`explain`](./explain.md) — the other direction: the output of a
  producer class, and the owner of a definition name.
- [`doctor`](./doctor.md) — checks for anchors config, coverage, and
  staleness.
