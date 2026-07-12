/**
 * @fileoverview Structural view of Valibot schemas as observed at runtime.
 *
 * Valibot's declared `GenericSchema` is opaque (intentionally a black box
 * for parse calls) but the runtime objects expose tagged-union shape via
 * `type` plus the wrapper / container properties below. The walkers that
 * traverse generator enrichment schemas — `toEnrichmentDescriptor` (form
 * projection) and `findUnknownKeys` (dropped-key detection) — narrow into
 * this view once at each entry point and stay inside it.
 *
 * @module valibotShape
 */

import type * as v from 'valibot'

/**
 * The runtime shape of a Valibot schema node. `wrapped` carries the inner
 * schema of `optional` / `nullable` / `nullish` wrappers; `entries` the
 * member schemas of an `object`; `item` an `array`'s element schema;
 * `key` / `value` a `record`'s key and value schemas; `options` a
 * `picklist` / union's choices; `pipe` a `v.pipe(...)`'s action chain
 * (whose first element is the base schema).
 */
export type ValibotSchemaShape = {
  readonly type: string
  readonly wrapped?: unknown
  readonly entries?: unknown
  readonly item?: unknown
  readonly key?: unknown
  readonly value?: unknown
  readonly options?: unknown
  readonly pipe?: unknown
}

export const isValibotSchema = (input: unknown): input is ValibotSchemaShape =>
  typeof input === 'object' &&
  input !== null &&
  'type' in input &&
  typeof (input as { type: unknown }).type === 'string'

export const isEntriesRecord = (input: unknown): input is Record<string, v.GenericSchema> =>
  typeof input === 'object' && input !== null

const WRAPPER_TYPES = new Set(['optional', 'nullable', 'nullish'])

/**
 * Strip a single `optional` / `nullable` / `nullish` wrapper, reporting
 * whether one was present. Wrappers don't nest in practice (a schema is
 * declared optional once), so one level suffices.
 */
export const unwrap = (
  schema: ValibotSchemaShape
): { inner: ValibotSchemaShape; optional: boolean } => {
  if (WRAPPER_TYPES.has(schema.type) && isValibotSchema(schema.wrapped)) {
    return { inner: schema.wrapped, optional: true }
  }
  return { inner: schema, optional: false }
}

/**
 * A `v.pipe(base, …actions)` schema spreads `base` and adds a `pipe` array
 * whose first element IS the original base schema. Lookups keyed on schema
 * *identity* (e.g. the `moduleSelect` registry) must therefore also check
 * the pipe's base, or piping a schema through metadata (`v.title(…)`)
 * would silently break the lookup.
 */
export const baseOf = (schema: ValibotSchemaShape): ValibotSchemaShape =>
  Array.isArray(schema.pipe) && isValibotSchema(schema.pipe[0]) ? schema.pipe[0] : schema
