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
  readonly type: 'oasOperation' | 'gqlOperation' | 'model' | 'webhook'
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

/**
 * Whether an object member should be omitted from the descriptor. A member
 * that unwraps to `v.undefined()` carries no payload — it is the canonical
 * "this scope is absent" marker (e.g. the `v.undefined()` members of
 * `emptyEnrichmentSchema`). Omitting it keeps a no-enrichment generator's
 * descriptor empty (the editor hides the section) and lets a partially
 * populated umbrella surface only the scopes that actually carry fields. The
 * rule is structural — it names no scope, so it composes with the generic
 * object walk rather than special-casing `subject` / `generator` / `stack`.
 */
const isOmittedMember = (rawSchema: unknown): boolean =>
  isValibotSchema(rawSchema) && unwrap(rawSchema).inner.type === 'undefined'

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
        fields: walkEntries(entries)
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
 * Walk an object schema's `entries` into descriptor fields, omitting members
 * that carry no payload (see {@link isOmittedMember}). The single iteration
 * point shared by the top-level walk ({@link toEnrichmentFields}) and the
 * nested-object case in {@link kindFor}.
 */
const walkEntries = (entries: Record<string, v.GenericSchema>): EnrichmentField[] =>
  Object.keys(entries)
    .filter(key => !isOmittedMember(entries[key]))
    .map(key => walkField(key, entries[key]))

/**
 * Walk a Valibot object schema and return the projected list of
 * `EnrichmentField`s. A `v.optional(v.object({...}))` outer wrapper is
 * silently unwrapped; any non-object root yields an empty list; members that
 * unwrap to `v.undefined()` are omitted (see {@link isOmittedMember}).
 *
 * For a generator entry the schema is the three-scope **umbrella** composite
 * `v.object({ subject, generator, stack })` that `toEnrichmentSchema` returns,
 * so the top-level fields are the three scopes — each an `object` field whose
 * nested `fields` are that scope's own leaf. The walk discovers the scopes
 * structurally; it never names `subject` / `generator` / `stack`. A scope
 * declared `v.undefined()` (the no-enrichment marker) drops out, so a
 * subject-only generator yields just the `subject` scope and a fully empty
 * umbrella yields `[]`.
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
  return walkEntries(inner.entries)
}

const toAppliesTo = (entryType: EnrichmentSource['type']): TargetKind => {
  switch (entryType) {
    case 'model':
      return 'model'
    case 'oasOperation':
    case 'gqlOperation':
      return 'operation'
    // STOPGAP: a webhook is operation-shaped (method + responses), so its
    // enrichment editor reuses the 'operation' context for now. A dedicated
    // 'webhook' TargetKind would be more truthful but ripples into the
    // skmtc-hub TypeSpec contract that TargetKind/appliesTo mirror — deferred
    // to a coordinated change. (Was an uncovered gap: WebhookConfig joined the
    // GeneratorConfig union without a toAppliesTo arm.)
    case 'webhook':
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
 * `'model'` → `'model'`). If the entry has no `toEnrichmentSchema`, or
 * declares the empty umbrella, the descriptor has an empty `fields`
 * array — the UI hides the section, matching the engine's "no
 * enrichments" behaviour.
 *
 * `toEnrichmentSchema` returns the three-scope umbrella composite
 * `v.object({ subject, generator, stack })`, so the descriptor's
 * top-level `fields` are the three scopes — each an `object` field whose
 * nested `fields` are that scope's own leaf (absent scopes drop out). The
 * `subject` scope describes one *variant*'s leaf shape; variant selection
 * sits above it in the editor UI, since the variant axis is core-owned.
 */
export const toEnrichmentDescriptor = (entry: EnrichmentSource): EnrichmentDescriptor => ({
  generator: entry.id,
  appliesTo: toAppliesTo(entry.type),
  fields: toEnrichmentFields(entry.toEnrichmentSchema?.())
})
