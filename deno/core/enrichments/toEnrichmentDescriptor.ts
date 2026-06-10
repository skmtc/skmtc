import * as v from 'valibot'
import { moduleExport } from '@/types/ModuleExport.ts'
import { accessorPath } from '@/types/AccessorPath.ts'

/**
 * Widget kind for one enrichment field — the rendered control in the
 * enrichment-editor UI. Mirrors the `EnrichmentFieldKind` enum in the
 * skmtc-hub TypeSpec contract.
 */
export type EnrichmentFieldKind =
  | 'text'
  | 'textarea'
  | 'toggle'
  | 'select'
  | 'module'
  | 'accessorPath'
  | 'array'
  | 'object'

/**
 * One node of a serialised enrichment-schema descriptor — the
 * form-renderable projection of a generator's enrichment schema.
 */
export type EnrichmentField = {
  /** Key written into the enrichment values object. */
  key: string
  /** Human label, derived from the key when no metadata is supplied. */
  label: string
  description?: string
  /** Whether the schema marks this field optional. */
  optional: boolean
  kind: EnrichmentFieldKind
  /** Choices for a `select` field. */
  options?: string[]
  /**
   * For `kind: 'array'` — a one-element list describing the item shape.
   * If the item is an object, the synthesised field carries the nested
   * `fields`; if it is a primitive, the synthesised field carries the
   * appropriate primitive kind. The single-element convention matches
   * the contract's `EnrichmentField[]` shape.
   */
  item?: EnrichmentField[]
  /** For `kind: 'object'` — the nested object's fields. */
  fields?: EnrichmentField[]
}

/** What a generator targets — operations or models. */
export type TargetKind = 'operation' | 'model'

/**
 * A generator's enrichment schema, projected for the CMS. The same
 * descriptor is what an agent would drive — the form UI is one
 * renderer of it.
 */
export type EnrichmentDescriptor = {
  generator: string
  appliesTo: TargetKind
  fields: EnrichmentField[]
}

/**
 * Structural view of the data the walker needs from a generator entry.
 * Every entry returned by `toOasOperationEntry`, `toGqlOperationEntry`,
 * and `toModelEntry` satisfies this shape — the walker stays decoupled
 * from `GeneratorConfig` so callers can pass any entry-like object
 * (e.g. tests or programmatically authored generators).
 */
export type EnrichmentSource = {
  readonly id: string
  readonly type: 'oasOperation' | 'gqlOperation' | 'model'
  readonly toEnrichmentSchema?: () => v.GenericSchema
}

/**
 * Structural view of a Valibot schema as observed at runtime. Valibot's
 * declared `GenericSchema` is opaque (intentionally a black box for
 * parse calls) but the runtime objects expose tagged-union shape via
 * `type` plus the wrapper / container properties below. The walker
 * narrows into this view via {@link isValibotSchema} once at each
 * entry point and stays inside it for traversal.
 */
type ValibotSchemaShape = {
  readonly type: string
  readonly wrapped?: unknown
  readonly entries?: unknown
  readonly item?: unknown
  readonly options?: unknown
}

const isValibotSchema = (input: unknown): input is ValibotSchemaShape =>
  typeof input === 'object' &&
  input !== null &&
  'type' in input &&
  typeof (input as { type: unknown }).type === 'string'

const isEntriesRecord = (input: unknown): input is Record<string, v.GenericSchema> =>
  typeof input === 'object' && input !== null

const isOptionsArray = (input: unknown): input is readonly unknown[] => Array.isArray(input)

const WRAPPER_TYPES = new Set(['optional', 'nullable', 'nullish'])

const unwrap = (schema: ValibotSchemaShape): { inner: ValibotSchemaShape; optional: boolean } => {
  if (WRAPPER_TYPES.has(schema.type) && isValibotSchema(schema.wrapped)) {
    return { inner: schema.wrapped, optional: true }
  }
  return { inner: schema, optional: false }
}

const toLabel = (key: string): string => {
  if (key === '') return ''
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

type KindShape = Pick<EnrichmentField, 'kind'> &
  Partial<Pick<EnrichmentField, 'options' | 'item' | 'fields'>>

const kindFor = (schema: ValibotSchemaShape): KindShape => {
  if (isValibotSchema(moduleExport) && schema === moduleExport) {
    return { kind: 'module' }
  }
  if (isValibotSchema(accessorPath) && schema === accessorPath) {
    return { kind: 'accessorPath' }
  }

  switch (schema.type) {
    case 'string':
      return { kind: 'text' }
    case 'boolean':
      return { kind: 'toggle' }
    case 'number':
      return { kind: 'text' }
    case 'picklist': {
      const opts = isOptionsArray(schema.options) ? schema.options.map(o => String(o)) : []
      return { kind: 'select', options: opts }
    }
    case 'object': {
      const entries = isEntriesRecord(schema.entries) ? schema.entries : {}
      return {
        kind: 'object',
        fields: Object.keys(entries).map(k => walkField(k, entries[k]))
      }
    }
    case 'array': {
      if (isValibotSchema(schema.item)) {
        return { kind: 'array', item: [walkFromShape('', schema.item)] }
      }
      return { kind: 'array', item: [] }
    }
    default:
      return { kind: 'text' }
  }
}

const walkFromShape = (key: string, rawSchema: ValibotSchemaShape): EnrichmentField => {
  const { inner, optional } = unwrap(rawSchema)
  return { key, label: toLabel(key), optional, ...kindFor(inner) }
}

const walkField = (key: string, rawSchema: v.GenericSchema): EnrichmentField => {
  if (!isValibotSchema(rawSchema)) {
    return { key, label: toLabel(key), optional: false, kind: 'text' }
  }
  return walkFromShape(key, rawSchema)
}

/**
 * Walk a Valibot schema and return the projected list of
 * `EnrichmentField`s. The schema is expected to describe the **leaf**
 * payload that arrives at a generator's routing target (the per-variant
 * inner shape for OAS/GQL operations; the per-refName payload for
 * models). A `v.optional(v.object({...}))` outer wrapper is silently
 * unwrapped; any non-object root yields an empty list.
 *
 * Generally callers should prefer {@link toEnrichmentDescriptor}, which
 * takes a generator entry and fills in `generator` / `appliesTo`
 * automatically. This lower-level entry point is useful in tests and
 * when only the field shape is needed.
 */
export const toEnrichmentFields = (schema: v.GenericSchema | undefined): EnrichmentField[] => {
  if (!isValibotSchema(schema)) return []
  const { inner } = unwrap(schema)
  if (inner.type !== 'object' || !isEntriesRecord(inner.entries)) return []
  const entries = inner.entries
  return Object.keys(entries).map(k => walkField(k, entries[k]))
}

const toAppliesTo = (entryType: EnrichmentSource['type']): TargetKind => {
  switch (entryType) {
    case 'model':
      return 'model'
    case 'oasOperation':
    case 'gqlOperation':
      return 'operation'
    default: {
      const _exhaustive: never = entryType
      throw new Error(`Unhandled generator entry type: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Project a generator entry's enrichment schema into a serialisable
 * `EnrichmentDescriptor` the CMS can render as a form. The entry's
 * `id` becomes `descriptor.generator`; its `type` discriminator maps
 * to `appliesTo` (`'oasOperation' | 'gqlOperation'` → `'operation'`;
 * `'model'` → `'model'`). If the entry has no `toEnrichmentSchema`,
 * the descriptor has an empty `fields` array — the UI hides the
 * section, matching the engine's "no enrichments" behaviour.
 *
 * The descriptor describes one *variant*'s leaf shape. Variant
 * selection sits above this in the editor UI, since the variant axis
 * is core-owned and the per-variant inner shape is what generators
 * actually declare.
 */
export const toEnrichmentDescriptor = (entry: EnrichmentSource): EnrichmentDescriptor => ({
  generator: entry.id,
  appliesTo: toAppliesTo(entry.type),
  fields: toEnrichmentFields(entry.toEnrichmentSchema?.())
})
