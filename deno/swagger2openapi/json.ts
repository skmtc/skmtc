/**
 * Minimal JSON value model plus guards and accessors.
 *
 * The converter and validator manipulate arbitrary OpenAPI/Swagger documents
 * whose shape shifts mid-transformation, so a precise structural type is not
 * workable. Instead the document is modelled as {@link JsonValue} and narrowed
 * with the guards below — which keeps the port free of `any` and `as` while
 * still type-checking every property access.
 *
 * @module
 */

/** A JSON scalar. */
export type JsonPrimitive = string | number | boolean | null

/** Any JSON value. */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

/** A JSON object (string-keyed map of {@link JsonValue}). */
export interface JsonObject {
  [key: string]: JsonValue
}

/** Either of the two mutable JSON container kinds. */
export type JsonContainer = JsonObject | JsonValue[]

/** Narrows a value to a plain JSON object (not an array, not null). */
export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Narrows a value to a JSON array. */
export const isJsonArray = (value: unknown): value is JsonValue[] => Array.isArray(value)

/** Narrows a value to a string. */
export const isString = (value: unknown): value is string => typeof value === 'string'

/** Narrows a value to a number. */
export const isNumber = (value: unknown): value is number => typeof value === 'number'

/** Narrows a value to a boolean. */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/** `true` when the value is a `$ref` string held under the `$ref` key. */
export const isRef = (container: JsonObject, key: string): boolean =>
  key === '$ref' && isString(container[key])

/**
 * Returns the value as a {@link JsonObject}, throwing if it is not one. Used at
 * points where the algorithm has already established the value must be an
 * object, replacing an unchecked cast with a runtime-narrowed guard.
 */
export const asObject = (value: JsonValue | undefined): JsonObject => {
  if (isJsonObject(value)) return value
  throw new TypeError('Expected a JSON object')
}

/**
 * Coerces an `unknown` (e.g. the result of `JSON.parse` or a YAML parser) into a
 * {@link JsonValue}, recursively rebuilding objects and arrays. Non-JSON leaves
 * (functions, `undefined`, symbols) become `null`. This bridges external,
 * loosely-typed values into the JSON model without an unchecked cast.
 */
export const toJson = (value: unknown): JsonValue => {
  if (value === null) return null
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return value
    case 'object': {
      if (Array.isArray(value)) return value.map(toJson)
      const result: JsonObject = {}
      for (const [key, member] of Object.entries(value)) {
        if (typeof member !== 'undefined') result[key] = toJson(member)
      }
      return result
    }
    default:
      return null
  }
}

/** Reads a member from either container type using a string key. */
export const getMember = (container: JsonContainer, key: string): JsonValue =>
  isJsonArray(container) ? container[Number(key)] : container[key]

/** Writes a member to either container type using a string key. */
export const setMember = (container: JsonContainer, key: string, value: JsonValue): void => {
  if (isJsonArray(container)) {
    container[Number(key)] = value
  } else {
    container[key] = value
  }
}
