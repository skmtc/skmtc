import * as v from 'valibot'

/**
 * A path of property names into a parsed schema document — e.g.
 * `['customer', 'primaryAddress', 'type']` to reach the nested
 * `type` property. Generators that overlay per-field enrichments
 * key those overlays by schema path.
 */
export type SchemaPath = string[]

/**
 * Canonical Valibot schema for an `SchemaPath`. There is deliberately no
 * standalone path-picker widget: a path is declared together with its
 * component binding as one `moduleSelect` field (this schema is the
 * `schemaPath` half of that pair). Used standalone it renders as a generic
 * array of strings.
 */
export const schemaPath: v.GenericSchema<SchemaPath> = v.array(v.string())
