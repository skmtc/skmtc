/**
 * @fileoverview Public surface of `@skmtc/core/Anchors`. Re-exports
 * the gen-maps (attribution / sidecar / generation-map) building
 * blocks that downstream consumers — the CLI, the worker, the
 * viewer — depend on.
 *
 * Internal helpers (`resolveSpans`, `attribute`, `buildSidecar`'s
 * private interning logic) stay unexported. They're load-bearing for
 * `postPass` but not part of the cross-package contract.
 */

export type { Span, Attribution } from './types.ts'
export type {
  Sidecar,
  RegistryEntry,
  GeneratorEntry,
  AnchorRow
} from './sidecar.ts'
export {
  sidecarSchema,
  anchorRow,
  generatorEntry,
  registryEntry,
  emptySidecar
} from './sidecar.ts'
export type { GenerationMapEntry } from './generationMap.ts'
export {
  generationMapEntry,
  entriesForSidecar,
  toNdjson,
  parseNdjson
} from './generationMap.ts'
export type { ParserAdapter, LandmarkLocation, NodeHandle, ParsedFile } from './ParserAdapter.ts'
export { tscAdapter } from './tscAdapter.ts'
export {
  postPass,
  type PostPassArgs,
  type GeneratorMetaLookup
} from './postPass.ts'
export {
  writeSidecars,
  type WriteSidecarsArgs,
  type WriteSidecarsResult
} from './writeSidecars.ts'
