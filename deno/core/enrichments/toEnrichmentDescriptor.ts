import type * as v from 'valibot'
import { moduleTypeOf } from '@/types/ModuleSelect.ts'

/**
 * Properties shared by every enrichment-field variant.
 */
export type EnrichmentFieldBase = {
  /** Key written into the enrichment values object. */
  key: string
  /** Human label, derived from the key when no metadata is supplied. */
  label: string
  description?: string
  /** Whether the schema marks this field optional. */
  optional: boolean
}

/**
 * The variant-specific part of one enrichment field — the widget `type`
 * discriminant plus exactly the payload that widget carries. Mirrors the
 * `EnrichmentField` union in the skmtc-hub TypeSpec contract.
 *
 * There are deliberately NO standalone `module` / `schemaPath` widget
 * types: a component reference is only meaningful WITH the path that gives
 * it a type, so the pair is declared as one `moduleSelect` field. A
 * generator that uses the raw `moduleExport` / `schemaPath` schemas
 * standalone degrades to the generic object/array widgets.
 */
export type EnrichmentFieldShape =
  | { type: 'text' }
  | { type: 'textarea' }
  | { type: 'toggle' }
  | {
      type: 'select'
      /** The selectable choices. */
      options: string[]
    }
  | {
      type: 'moduleSelect'
      /**
       * The TS source of the contract a chosen module must satisfy for this
       * field (a single `export type XModule<F> = …` the editor's matcher
       * checks candidates against). Always present: the module type is
       * explicit in the declaration (`lensInputModuleType` for the common
       * lens/input case), never an editor-side default.
       */
      moduleType: string
    }
  | {
      type: 'array'
      /** Shape of each item. */
      item: EnrichmentField
    }
  | {
      type: 'object'
      /** The nested object's fields. */
      fields: EnrichmentField[]
    }

/**
 * One node of a serialised enrichment-schema descriptor — the
 * form-renderable projection of a generator's enrichment schema,
 * discriminated on `type`. Recursive: `array` fields carry a single
 * `item` shape, `object` fields carry nested `fields`.
 */
export type EnrichmentField = EnrichmentFieldBase & EnrichmentFieldShape

/** The widget-type discriminant values of {@link EnrichmentField}. */
export type EnrichmentFieldType = EnrichmentField['type']

/** Which subject type a generator enriches — operations, webhooks, or models. */
export type SubjectType = 'operation' | 'model' | 'webhook'

/**
 * A generator's enrichment schema, projected for the CMS. The same
 * descriptor is what an agent would drive — the form UI is one
 * renderer of it.
 */
export type EnrichmentDescriptor = {
  generator: string
  subjectType: SubjectType
  /**
   * Whether this generator's entry declares variant support
   * (`supportsVariant: () => true`). The CMS reads it to decide whether to
   * offer the per-subject variant axis (add / rename / delete variants) above
   * the subject scope; `false` when the entry omits it.
   */
  supportsVariant: boolean
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
  /**
   * Whether the entry supports the variant axis. Required: every entry built by
   * `toOasOperationEntry` / `toGqlOperationEntry` / `toModelEntry` has it,
   * because the factory inserts a `() => false` default when the author omits
   * it — so by the time an entry reaches the descriptor the function always
   * exists.
   */
  readonly supportsVariant: () => boolean
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
  readonly pipe?: unknown
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
 * A `v.pipe(base, …actions)` schema spreads `base` and adds a `pipe` array
 * whose first element IS the original base schema. The `moduleSelect`
 * registry lookup must therefore also check the pipe's base, or piping a
 * moduleSelect through metadata (`v.title(…)`) would silently demote it to
 * a generic object widget.
 */
const baseOf = (schema: ValibotSchemaShape): ValibotSchemaShape =>
  Array.isArray(schema.pipe) && isValibotSchema(schema.pipe[0]) ? schema.pipe[0] : schema

/** The `v.title(…)` metadata riding a piped schema, if any — the field label. */
const titleOf = (schema: ValibotSchemaShape): string | undefined => {
  if (!Array.isArray(schema.pipe)) return undefined
  for (const action of schema.pipe) {
    if (
      typeof action === 'object' &&
      action !== null &&
      'type' in action &&
      action.type === 'title' &&
      'title' in action &&
      typeof action.title === 'string'
    ) {
      return action.title
    }
  }
  return undefined
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

const typeFor = (schema: ValibotSchemaShape): EnrichmentFieldShape => {
  const moduleType = moduleTypeOf(schema) ?? moduleTypeOf(baseOf(schema))
  if (moduleType !== undefined) {
    return { type: 'moduleSelect', moduleType }
  }

  switch (schema.type) {
    case 'string':
      return { type: 'text' }
    case 'boolean':
      return { type: 'toggle' }
    case 'number':
      return { type: 'text' }
    case 'picklist': {
      const opts = isOptionsArray(schema.options) ? schema.options.map(o => String(o)) : []
      return { type: 'select', options: opts }
    }
    case 'object': {
      const entries = isEntriesRecord(schema.entries) ? schema.entries : {}
      return {
        type: 'object',
        fields: walkEntries(entries)
      }
    }
    case 'array': {
      if (isValibotSchema(schema.item)) {
        return { type: 'array', item: walkFromShape('', schema.item) }
      }
      // An unrecognisable item schema degrades to a text item — consistent
      // with the walker's default posture for unknown leaves.
      return { type: 'array', item: { key: '', label: '', optional: false, type: 'text' } }
    }
    default:
      return { type: 'text' }
  }
}

const walkFromShape = (key: string, rawSchema: ValibotSchemaShape): EnrichmentField => {
  const { inner, optional } = unwrap(rawSchema)
  // A `v.title(…)` label wins over the key-derived one; the title may ride
  // the schema itself or sit inside an optional wrapper.
  const label = titleOf(inner) ?? titleOf(rawSchema) ?? toLabel(key)
  return { key, label, optional, ...typeFor(inner) }
}

const walkField = (key: string, rawSchema: v.GenericSchema): EnrichmentField => {
  if (!isValibotSchema(rawSchema)) {
    return { key, label: toLabel(key), optional: false, type: 'text' }
  }
  return walkFromShape(key, rawSchema)
}

/**
 * Walk an object schema's `entries` into descriptor fields, omitting members
 * that carry no payload (see {@link isOmittedMember}). The single iteration
 * point shared by the top-level walk ({@link toEnrichmentFields}) and the
 * nested-object case in {@link typeFor}.
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
 * takes a generator entry and fills in `generator` / `subjectType`
 * automatically. This lower-level entry point is useful in tests and
 * when only the field shape is needed.
 */
export const toEnrichmentFields = (schema: v.GenericSchema | undefined): EnrichmentField[] => {
  if (!isValibotSchema(schema)) return []
  const { inner } = unwrap(schema)
  if (inner.type !== 'object' || !isEntriesRecord(inner.entries)) return []
  return walkEntries(inner.entries)
}

const toSubjectType = (entryType: EnrichmentSource['type']): SubjectType => {
  switch (entryType) {
    case 'model':
      return 'model'
    case 'oasOperation':
    case 'gqlOperation':
      return 'operation'
    // A webhook resembles an operation (a path-item keyed by HTTP method) but
    // is a DISTINCT subject: it is addressed by webhook name, not request path,
    // and has no request URL. It is its own SubjectType so the editor and the
    // hub treat it truthfully rather than conflating it with an operation.
    case 'webhook':
      return 'webhook'
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
 * to `subjectType` (`'oasOperation' | 'gqlOperation'` → `'operation'`;
 * `'webhook'` → `'webhook'`; `'model'` → `'model'`). If the entry has no
 * `toEnrichmentSchema`, or
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
  subjectType: toSubjectType(entry.type),
  supportsVariant: entry.supportsVariant(),
  fields: toEnrichmentFields(entry.toEnrichmentSchema?.())
})
