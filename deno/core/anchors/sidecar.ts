/**
 * @fileoverview Sidecar v2 — pooled, position-indexed attribution
 * format. One sidecar per generated file. Lives at
 * `<root>/.skmtc/<project>/.maps/<rel-to-basePath>.skm.json` (Phase D
 * wires the path).
 *
 * Stable enough for round-trip via Valibot (see {@link sidecarSchema}).
 * Format details: docs/notes/gen-maps/plan.md §4.1.
 */

import * as v from 'valibot'

/**
 * Registry pool entry. References the JSR-protocol registry that
 * hosts a generator's source — `jsr.io` for public, `jsr.skmtc.dev`
 * for the SKMTC private registry, plus any future SKMTC-compatible
 * hosts.
 */
export const registryEntry = v.object({
  host: v.string(),
  kind: v.union([v.literal('jsr'), v.literal('jsr-private')])
})

/**
 * Generator pool entry. `r` indexes into the registry pool so the
 * viewer can build a URL without baking the registry host into every
 * generator entry.
 */
export const generatorEntry = v.object({
  name: v.string(),
  version: v.string(),
  r: v.number()
})

/**
 * One row in the anchor table. Tuple of pool indices + byte range:
 *
 *   `[Li, Pi, gi, si, vi, fromByte, toByte]`
 *
 * Where `Li` = landmark, `Pi` = AST path, `gi` = generator,
 * `si` = schema pointer, `vi` = variant. Each index is a non-negative
 * integer; pools are flat string arrays (or objects for `R` / `G`).
 */
export const anchorRow = v.tuple([
  v.number(), // Li (landmark)
  v.number(), // Pi (AST path)
  v.number(), // gi (generator)
  v.number(), // si (schema pointer)
  v.number(), // vi (variant)
  v.number(), // fromByte
  v.number() // toByte
])

/**
 * Sidecar v2. JSON document carried alongside each generated file.
 *
 * - `v` is the format version. Phase 0 froze v2; format evolution
 *   bumps this number and ships an adapter in the viewer.
 * - `f` is the file path (relative to `basePath`), `src` is the
 *   schema source the producer ran against.
 * - `parser` is `"<id>@<version>"` (e.g. `"tsc@5.6.3"`); consumers
 *   that re-anchor a reformatted file warn on mismatch.
 * - `R`, `G`, `S`, `V`, `L`, `P` are pools. `A` is the anchor table
 *   keyed into them.
 */
export const sidecarSchema = v.object({
  v: v.literal(2),
  f: v.string(),
  src: v.string(),
  parser: v.string(),
  R: v.array(registryEntry),
  G: v.array(generatorEntry),
  S: v.array(v.string()),
  V: v.array(v.string()),
  L: v.array(v.string()),
  P: v.array(v.string()),
  A: v.array(anchorRow)
})

export type Sidecar = v.InferOutput<typeof sidecarSchema>
export type RegistryEntry = v.InferOutput<typeof registryEntry>
export type GeneratorEntry = v.InferOutput<typeof generatorEntry>
export type AnchorRow = v.InferOutput<typeof anchorRow>

/**
 * Empty sidecar with the given file/source/parser metadata. Anchor
 * pools start empty and grow via `intern`-style appends during
 * `buildSidecar`.
 */
export const emptySidecar = (filePath: string, schemaSrc: string, parser: string): Sidecar => ({
  v: 2,
  f: filePath,
  src: schemaSrc,
  parser,
  R: [],
  G: [],
  S: [],
  V: [],
  L: [],
  P: [],
  A: []
})
