/**
 * Depth-first walk over a JSON Schema, invoking a callback for the schema and
 * every sub-schema (items, properties, combiners, etc.). A `$ref` short-circuits
 * the walk — all sibling keywords are ignored, per JSON Reference semantics.
 *
 * @module
 */

import { isJsonArray, isJsonObject, type JsonObject, type JsonValue } from './json.ts'

/** State threaded through {@link walkSchema}. */
export interface WalkSchemaState {
  depth: number
  seen: WeakMap<object, boolean>
  top: boolean
  /** Collapse single-element `allOf`/`anyOf`/`oneOf` into the parent before walking. */
  combine: boolean
  /** Path segment of the sub-schema currently being visited. */
  property?: string
  [extra: string]: unknown
}

/** Fresh default {@link WalkSchemaState}. */
export const getDefaultState = (): WalkSchemaState => ({
  depth: 0,
  seen: new WeakMap(),
  top: true,
  combine: false
})

/** Callback invoked for the schema and each sub-schema. */
export type WalkSchemaCallback = (
  schema: JsonObject,
  parent: JsonObject,
  state: WalkSchemaState
) => void

const combineSingle = (schema: JsonObject, keyword: string): JsonObject => {
  const sub = schema[keyword]
  if (isJsonArray(sub) && sub.length === 1 && isJsonObject(sub[0])) {
    const merged: JsonObject = { ...sub[0], ...schema }
    delete merged[keyword]
    return merged
  }
  return schema
}

const descend = (
  schema: JsonObject,
  state: WalkSchemaState,
  callback: WalkSchemaCallback,
  property: string,
  child: JsonValue
): void => {
  if (isJsonObject(child)) {
    state.property = property
    walk(child, schema, state, callback)
  }
}

const descendMap = (
  schema: JsonObject,
  state: WalkSchemaState,
  callback: WalkSchemaCallback,
  keyword: string
): void => {
  const map = schema[keyword]
  if (isJsonObject(map)) {
    for (const key of Object.keys(map)) {
      descend(schema, state, callback, keyword + '/' + key, map[key])
    }
  }
}

const descendList = (
  schema: JsonObject,
  state: WalkSchemaState,
  callback: WalkSchemaCallback,
  keyword: string
): void => {
  const list = schema[keyword]
  if (isJsonArray(list)) {
    list.forEach((sub, index) => {
      descend(schema, state, callback, keyword + '/' + index, sub)
    })
  }
}

const walk = (
  schema: JsonObject,
  parent: JsonObject,
  state: WalkSchemaState,
  callback: WalkSchemaCallback
): JsonObject => {
  if (typeof schema.$ref !== 'undefined') {
    const temp: JsonObject = { $ref: schema.$ref }
    callback(temp, parent, state)
    return temp // all other properties SHALL be ignored
  }

  let working = schema
  if (state.combine) {
    working = combineSingle(working, 'allOf')
    working = combineSingle(working, 'anyOf')
    working = combineSingle(working, 'oneOf')
  }

  callback(working, parent, state)
  if (state.seen.has(working)) return working
  state.seen.set(working, true)
  state.top = false
  state.depth++

  descend(working, state, callback, 'items', working.items)
  descend(working, state, callback, 'additionalItems', working.additionalItems)
  descend(working, state, callback, 'additionalProperties', working.additionalProperties)
  descendMap(working, state, callback, 'properties')
  descendMap(working, state, callback, 'patternProperties')
  descendList(working, state, callback, 'allOf')
  descendList(working, state, callback, 'anyOf')
  descendList(working, state, callback, 'oneOf')
  descend(working, state, callback, 'not', working.not)

  state.depth--
  return working
}

/** Walks `schema`, invoking `callback` for it and every sub-schema. */
export const walkSchema = (
  schema: JsonObject,
  parent: JsonObject,
  state: Partial<WalkSchemaState>,
  callback: WalkSchemaCallback
): JsonObject => {
  const fullState: WalkSchemaState =
    typeof state.depth === 'undefined'
      ? getDefaultState()
      : {
          ...getDefaultState(),
          ...state,
          depth: state.depth,
          seen: state.seen ?? new WeakMap()
        }
  return walk(schema, parent, fullState, callback)
}
