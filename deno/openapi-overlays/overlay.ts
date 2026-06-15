import { JSONPath } from 'jsonpath-plus'
import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml'

/** A JSON scalar. */
export type JsonPrimitive = string | number | boolean | null

/** Any value reachable in a parsed JSON/YAML document. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/** A JSON object node. */
export type JsonObject = { [key: string]: JsonValue }

/** A single Overlay action — either an `update` merge or a `remove` at `target`. */
export type OverlayAction = {
  /** JSONPath expression selecting the node(s) to act on. */
  target: string
  /** Optional human-readable description of the action. */
  description?: string
  /** Value merged into the target node(s). Ignored when `remove` is present. */
  update?: JsonValue
  /** When present, the target node(s) are removed instead of updated. */
  remove?: boolean
}

/** An OpenAPI Overlay (1.0.0) document. */
export type Overlay = {
  /** Overlay specification version, e.g. `"1.0.0"`. */
  overlay?: string
  info?: { title?: string; version?: string }
  /** Reference to the document the overlay was authored against (informational; not resolved). */
  extends?: string
  actions?: OverlayAction[]
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-merge `source` into `target`, concatenating arrays — equivalent to
 * `mergician({ appendArrays: true })(target, source)` in the reference tool.
 * Inputs are never mutated; the merged tree is freshly cloned.
 */
function deepMerge(target: JsonValue, source: JsonValue): JsonValue {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source].map((element) => structuredClone(element))
  }

  if (isJsonObject(target) && isJsonObject(source)) {
    const result: JsonObject = {}
    for (const key of Object.keys(target)) {
      result[key] = structuredClone(target[key])
    }
    for (const key of Object.keys(source)) {
      const incoming = source[key]
      const existing = result[key]
      const mergeable = (isJsonObject(existing) && isJsonObject(incoming)) ||
        (Array.isArray(existing) && Array.isArray(incoming))
      result[key] = mergeable ? deepMerge(existing, incoming) : structuredClone(incoming)
    }
    return result
  }

  return structuredClone(source)
}

/**
 * Build the merge function applied to each targeted node. Merging into a
 * primitive is rejected so the value is left untouched, matching the reference
 * tool's behaviour for the "immutable" case.
 */
function buildMerger(update: JsonValue): (chunk: JsonValue) => JsonValue {
  return (chunk) => {
    if (!isJsonObject(chunk) && !Array.isArray(chunk)) {
      throw new Error('Cannot apply an update to a non-object value')
    }
    return deepMerge(chunk, update)
  }
}

type PathMatch = {
  value: JsonValue
  parent: JsonObject | JsonValue[] | null
  parentProperty: string | number | null
}

function queryAll(json: JsonValue, path: string): PathMatch[] {
  // jsonpath-plus' result type is intentionally loose; `resultType: 'all'`
  // yields live `parent`/`parentProperty` references we mutate in place.
  const result = JSONPath({ path, json: json as object, resultType: 'all', wrap: true })
  return Array.isArray(result) ? (result as PathMatch[]) : []
}

/**
 * Remove every node matching `target`. The document is re-queried after each
 * deletion so array index shifts and recursive descent (`$..foo`) are handled
 * exactly like the reference implementation.
 */
function applyRemove(spec: JsonValue, target: string): void {
  // Upper bound guards against a pathological expression that never converges.
  for (let iterations = 0; iterations < 1_000_000; iterations++) {
    const matches = queryAll(spec, target)
    if (matches.length === 0) return

    const { parent, parentProperty } = matches[0]
    if (parent === null || parentProperty === null) return

    if (Array.isArray(parent)) {
      parent.splice(Number(parentProperty), 1)
    } else {
      delete parent[String(parentProperty)]
    }
  }
}

/** Merge `action.update` into every node matching `action.target`. */
function applyUpdate(spec: JsonValue, action: OverlayAction): JsonValue {
  const merger = buildMerger(action.update ?? null)

  // The root cannot be replaced through a parent reference, so merge directly.
  if (action.target.trim() === '$') {
    return merger(spec)
  }

  for (const match of queryAll(spec, action.target)) {
    const { parent, parentProperty } = match
    if (parent === null || parentProperty === null) continue

    const merged = merger(match.value)
    if (Array.isArray(parent)) {
      parent[Number(parentProperty)] = merged
    } else {
      parent[String(parentProperty)] = merged
    }
  }

  return spec
}

/**
 * Apply an Overlay document to a parsed OpenAPI definition and return the
 * result. The definition is mutated in place where possible; always use the
 * returned value, since a root-level (`$`) update produces a new object.
 *
 * @example
 * ```ts
 * const updated = applyOverlay(spec, {
 *   overlay: '1.0.0',
 *   actions: [{ target: "$.info", update: { 'x-overlaid': true } }],
 * })
 * ```
 */
export function applyOverlay(spec: JsonValue, overlay: Overlay): JsonValue {
  const actions = overlay.actions
  if (!Array.isArray(actions) || actions.length === 0) {
    return spec
  }

  for (const action of actions) {
    // Presence of the `remove` key (regardless of value) selects removal,
    // matching the reference tool.
    if (Object.prototype.hasOwnProperty.call(action, 'remove')) {
      applyRemove(spec, action.target)
      continue
    }

    try {
      spec = applyUpdate(spec, action)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error applying overlay: ${message}`)
    }
  }

  return spec
}

const OPENAPI_FIELD_ORDER = [
  'info',
  'servers',
  'summary',
  'operationId',
  'tags',
  'paths',
  'components',
  'description',
  'parameters',
  'responses',
]

/** Output serialisation format for {@link stringifyDocument} and {@link overlayFiles}. */
export type OverlayFormat = 'yaml' | 'json'

/** Order well-known OpenAPI keys; leave unknown keys in their existing order. */
function sortOpenAPIFields(a: string, b: string): number {
  const indexA = OPENAPI_FIELD_ORDER.indexOf(a)
  const indexB = OPENAPI_FIELD_ORDER.indexOf(b)
  if (indexA === -1 || indexB === -1) return 0
  return Math.sign(indexA - indexB)
}

/**
 * Recursively reorder object keys so well-known OpenAPI fields lead. Applied
 * before serialising so YAML and JSON output share the same field order
 * (`Array.prototype.sort` is stable, so unknown keys keep their position).
 */
function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (isJsonObject(value)) {
    const sorted: JsonObject = {}
    for (const key of Object.keys(value).sort(sortOpenAPIFields)) {
      sorted[key] = sortKeysDeep(value[key])
    }
    return sorted
  }
  return value
}

/**
 * Serialise an overlaid document as YAML (default) or JSON, with well-known
 * OpenAPI fields ordered consistently across both formats.
 */
export function stringifyDocument(document: JsonValue, format: OverlayFormat = 'yaml'): string {
  const ordered = sortKeysDeep(document)
  return format === 'json' ? JSON.stringify(ordered, null, 2) : stringifyYaml(ordered)
}

/**
 * Read an OpenAPI description and an Overlay document from disk, apply the
 * overlay, and return the resulting document serialised as YAML (default) or
 * JSON.
 *
 * Requires `--allow-read`.
 *
 * @example
 * ```ts
 * const json = await overlayFiles('openapi.yaml', 'overlay.yaml', { format: 'json' })
 * ```
 */
export async function overlayFiles(
  openapiPath: string,
  overlayPath: string,
  options: { format?: OverlayFormat } = {},
): Promise<string> {
  // Casts sit at the parse boundary: @std/yaml returns `unknown`.
  const spec = parseYaml(await Deno.readTextFile(openapiPath)) as JsonValue
  const overlay = parseYaml(await Deno.readTextFile(overlayPath)) as Overlay

  const result = applyOverlay(spec, overlay)

  return stringifyDocument(result, options.format ?? 'yaml')
}
