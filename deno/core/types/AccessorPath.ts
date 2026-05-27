import * as v from 'valibot'

/**
 * A path of property names into a parsed schema document — e.g.
 * `['customer', 'primaryAddress', 'type']` to reach the nested
 * `type` property. Generators that overlay per-field enrichments
 * key those overlays by accessor path.
 */
export type AccessorPath = string[]

/**
 * Canonical Valibot schema for an `AccessorPath`. Generators should
 * import this rather than write `v.array(v.string())` inline — the
 * descriptor walker identity-matches the exported value and emits a
 * schema-aware path-picker widget (`kind: "accessorPath"`) instead of
 * a generic array of strings.
 */
export const accessorPath: v.GenericSchema<AccessorPath> = v.array(v.string())
