/**
 * @fileoverview Public surface of `@skmtc/core/Anchors`. Re-exports
 * the gen-maps (attribution / sidecar / generation-map) building
 * blocks that downstream consumers — the CLI, the worker, the
 * viewer — depend on.
 *
 * Internal helpers (the `CaptureSink` span resolution, `attribute`,
 * `buildSidecar`'s private interning logic) stay unexported. They're
 * load-bearing for `postPass` but not part of the cross-package contract.
 */

export type { Span, Attribution } from './types.ts'
export type { Sidecar, RegistryEntry, GeneratorEntry, AnchorRow } from './sidecar.ts'
export { sidecarSchema, anchorRow, generatorEntry, registryEntry, emptySidecar } from './sidecar.ts'
export type { GenerationMapEntry } from './generationMap.ts'
export { generationMapEntry, entriesForSidecar, toNdjson, parseNdjson } from './generationMap.ts'
export type { ParserAdapter, LandmarkLocation, NodeHandle, ParsedFile } from './ParserAdapter.ts'
// `oxcAdapter` is deliberately NOT re-exported here. It imports
// `npm:oxc-parser`, whose `bindings.js` references every
// platform-specific `.node` file in a way that `deno bundle`
// statically follows — pulling them into the worker bundle breaks
// it for non-host architectures. Host-side consumers (CLI post-pass)
// import from `@skmtc/core/Anchors/oxc` directly. The worker doesn't
// import it at all; `postPass` runs with `parser: undefined` and
// falls back to Definition-identifier landmarks.
export { postPass, type PostPassArgs, type GeneratorMetaLookup } from './postPass.ts'
export { writeSidecars, type WriteSidecarsArgs, type WriteSidecarsResult } from './writeSidecars.ts'
