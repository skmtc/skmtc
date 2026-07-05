import * as v from 'valibot'
import { moduleExport, type ModuleExport } from '@/types/ModuleExport.ts'
import { schemaPath, type SchemaPath } from '@/types/SchemaPath.ts'

/**
 * One field binding: WHERE in the subject's data shape the field lives
 * (`schemaPath`) and — optionally — WHICH consumer component renders it
 * (`module`). The two are one unit by construction, asymmetrically:
 * a component can never be stored without the path that gives it a type
 * (which is what lets the editor's type-aware matcher verify the pair
 * before it is ever written), while a path WITHOUT a component is the
 * everyday "use the generator's default rendering" state — it's how
 * schema-seeded fields start out, and how label/order overrides are
 * expressed for fields that need no custom input.
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
  /** The consumer component bound to that field; absent = the generator's
   *  default rendering for the field's type. */
  module?: ModuleExport
}

/**
 * Per-declaration configuration for {@link moduleSelect}.
 *
 * `slot` is the TypeScript source of the field's binding contract — a single
 * `export type X<F> = …` the editor's matcher checks candidates against
 * (`typeof Candidate extends X<FieldType>`). It is REQUIRED so the contract
 * is always explicit in the declaration — there is no hidden editor-side
 * default. For the common lens/input case pass {@link lensInputSlot}; only
 * generators with a genuinely custom contract write their own source.
 */
export type ModuleSelectConfig = {
  /** TS source of the binding contract (`export type X<F> = …`). */
  slot: string
}

/**
 * The standard lens/input binding contract: a candidate fits a field when it
 * accepts `{ lens: Lens<Normalize<FieldType>> }` (react-hook-form lenses).
 * `__SlotNormalize` mirrors what generated form code does with
 * `lens.focus(path).defined()` — optional/nullable wrappers are stripped on
 * primitives and made recursively optional on objects — so an optional
 * `string | undefined` field still matches a `Lens<string>` input.
 *
 * Pass as `moduleSelect({ slot: lensInputSlot })`. Generators with a custom
 * binding (e.g. a table cell renderer taking `{ value: F }`) declare their
 * own `export type X<F> = …` source instead.
 */
export const lensInputSlot: string = `import type { Lens } from '@hookform/lenses'
type __SlotPrimitive = string | number | boolean | bigint | symbol | null | undefined | Date
type __SlotNormalize<T> = [T] extends [__SlotPrimitive] ? NonNullable<T> : T extends ReadonlyArray<infer U> ? Array<__SlotNormalize<U>> : { [K in keyof T]?: __SlotNormalize<NonNullable<T[K]>> }
export type InputSlot<F> = (props: { lens: Lens<__SlotNormalize<F>> }) => unknown`

// Factory-created schemas can't be reference-compared to a singleton (unlike
// `moduleExport`), so the descriptor walker recognises them — and reads their
// per-declaration config — through this registry.
const moduleSelectConfigs = new WeakMap<object, ModuleSelectConfig>()

/**
 * Declare a `moduleSelect` enrichment field: the `{ schemaPath, module? }`
 * binding validated as one value. The enrichment editor renders it as a
 * single composite control (path picker + type-matched component picker,
 * the component gated on the path), and `toEnrichmentDescriptor` projects
 * it as `type: 'moduleSelect'` carrying the declared `slot`.
 *
 * ```ts
 * import { lensInputSlot, moduleSelect } from '@skmtc/core'
 *
 * export const formFieldItem = v.object({
 *   moduleSelect: v.optional(v.pipe(moduleSelect({ slot: lensInputSlot }), v.title('Input'))),
 *   label: v.optional(v.string())
 * })
 * ```
 */
export const moduleSelect = (config: ModuleSelectConfig): v.GenericSchema<ModuleSelect> => {
  const schema: v.GenericSchema<ModuleSelect> = v.object({
    schemaPath,
    module: v.optional(moduleExport)
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
