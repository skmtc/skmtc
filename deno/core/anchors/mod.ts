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

export type { Attribution, Span } from "./types.ts";
export type {
  AnchorRow,
  GeneratorEntry,
  RegistryEntry,
  Sidecar,
} from "./sidecar.ts";
export {
  anchorRow,
  emptySidecar,
  generatorEntry,
  registryEntry,
  sidecarSchema,
} from "./sidecar.ts";
export type { GenerationMapEntry } from "./generationMap.ts";
export {
  entriesForSidecar,
  generationMapEntry,
  parseNdjson,
  toNdjson,
} from "./generationMap.ts";
export type {
  LandmarkLocation,
  NodeHandle,
  ParsedFile,
  ParserAdapter,
} from "./ParserAdapter.ts";
// `oxcAdapter` is deliberately NOT re-exported here. It imports
// `npm:oxc-parser`, whose `bindings.js` references every
// platform-specific `.node` file in a way that `deno bundle`
// statically follows — pulling them into the worker bundle breaks
// it for non-host architectures. Host-side consumers (CLI post-pass)
// import from `@skmtc/core/Anchors/oxc` directly. The worker doesn't
// import it at all; `postPass` runs with `parser: undefined` and
// falls back to Definition-identifier landmarks.
export {
  type GeneratorMetaLookup,
  postPass,
  type PostPassArgs,
} from "./postPass.ts";
export {
  reanchorSidecar,
  type ReanchorSidecarArgs,
  upgradeSidecar,
  type UpgradeSidecarArgs,
} from "./upgradeSidecar.ts";
export {
  writeSidecars,
  type WriteSidecarsArgs,
  type WriteSidecarsResult,
} from "./writeSidecars.ts";
