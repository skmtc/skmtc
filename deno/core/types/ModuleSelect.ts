import * as v from 'valibot'
import { moduleExport, type ModuleExport } from '@/types/ModuleExport.ts'
import { schemaPath, type SchemaPath } from '@/types/SchemaPath.ts'

/**
 * One bound (field, component) pair: WHERE in the subject's data shape the
 * field lives (`schemaPath`) and WHICH consumer component renders it
 * (`module`). The two are one unit by construction — a component cannot be
 * stored without the path that gives it a type, which is what lets the
 * editor's type-aware matcher verify the pair before it is ever written.
 *
 * Stored in `client.json` under the literal key `moduleSelect`:
 *
 * ```jsonc
 * {
 *   "moduleSelect": {
 *     "schemaPath": ["RequestBody", "officeIds"],
 *     "module": { "exportName": "OfficesMultiSelectField", "exportPath": "@/inputs/OfficesMultiSelectField.generated.tsx" }
 *   },
 *   "label": "Offices"
 * }
 * ```
 */
export type ModuleSelect = {
  /** Path into the subject's data shape: a target token (`RequestBody` /
   *  `SuccessResponse` / `Model`) followed by property names. */
  schemaPath: SchemaPath
  /** The consumer component bound to that field. */
  module: ModuleExport
}

/**
 * Per-declaration configuration for {@link moduleSelect}.
 *
 * `slot` is the TypeScript source of a CUSTOM binding contract — a single
 * `export type X<F> = …` the editor's matcher checks candidates against
 * (`typeof Candidate extends X<FieldType>`). Omit it for the built-in
 * lens/input contract: the default lives in the editor tooling, so ordinary
 * generators never carry conditional-type source strings.
 */
export type ModuleSelectConfig = {
  /** TS source of a custom slot contract (`export type X<F> = …`). */
  slot?: string
}

// Factory-created schemas can't be reference-compared to a singleton (unlike
// `moduleExport` / `schemaPath`), so the descriptor walker recognises them —
// and reads their per-declaration config — through this registry.
const moduleSelectConfigs = new WeakMap<object, ModuleSelectConfig>()

/**
 * Declare a `moduleSelect` enrichment field: the atomic
 * `{ schemaPath, module }` pair validated as one value. The enrichment
 * editor renders it as a single composite control (path picker + type-matched
 * component picker), and `toEnrichmentDescriptor` projects it as
 * `type: 'moduleSelect'` carrying the declared `slot` (if any).
 *
 * ```ts
 * export const formFieldItem = v.object({
 *   moduleSelect: v.optional(v.pipe(moduleSelect(), v.title('Input'))),
 *   label: v.optional(v.string())
 * })
 * ```
 */
export const moduleSelect = (config: ModuleSelectConfig = {}): v.GenericSchema<ModuleSelect> => {
  const schema: v.GenericSchema<ModuleSelect> = v.object({
    schemaPath,
    module: moduleExport
  })
  moduleSelectConfigs.set(schema, config)
  return schema
}

/**
 * The {@link ModuleSelectConfig} a schema was declared with, or `undefined`
 * when the schema is not a {@link moduleSelect}. Callers pass the schema as
 * observed at runtime (the descriptor walker's structural view), so the
 * parameter is deliberately `unknown`.
 */
export const moduleSelectConfigOf = (schema: unknown): ModuleSelectConfig | undefined =>
  typeof schema === 'object' && schema !== null ? moduleSelectConfigs.get(schema) : undefined
