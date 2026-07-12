/**
 * The small subset of [`reftools`](https://www.npmjs.com/package/reftools)
 * that swagger2openapi relies on: a JSON deep clone, an object recursor, and a
 * JSON Pointer / JSON Reference resolver (`jptr`).
 *
 * @module
 */

import {
  getMember,
  isJsonArray,
  isJsonObject,
  type JsonContainer,
  type JsonObject,
  type JsonValue
} from './json.ts'

/** Deep-clones a JSON value (equivalent to a `JSON.parse(JSON.stringify(...))` round-trip). */
export const clone = (value: JsonValue): JsonValue => {
  if (isJsonArray(value)) return value.map(clone)
  if (isJsonObject(value)) {
    const result: JsonObject = {}
    for (const key of Object.keys(value)) result[key] = clone(value[key])
    return result
  }
  return value
}

/** Escapes a JSON Pointer reference token (`~` → `~0`, `/` → `~1`). */
export const jpescape = (token: string): string => token.split('~').join('~0').split('/').join('~1')

/** Unescapes a JSON Pointer reference token (`~1` → `/`, `~0` → `~`). */
export const jpunescape = (token: string): string =>
  token.split('~1').join('/').split('~0').join('~')

/** State threaded through {@link recurse}. */
export interface RecurseState {
  path: string
  depth: number
  pkey: string
  parent: JsonContainer
  payload: Record<string, unknown>
  seen: WeakMap<object, string>
  identity: boolean
  identityDetection: boolean
  key?: string
  identityPath?: string
}

/** Callback invoked for every own member encountered by {@link recurse}. */
export type RecurseCallback = (container: JsonContainer, key: string, state: RecurseState) => void

const defaultState = (): RecurseState => ({
  path: '#',
  depth: 0,
  pkey: '',
  parent: {},
  payload: {},
  seen: new WeakMap(),
  identity: false,
  identityDetection: false
})

/**
 * Recurses through every property of a JSON value, invoking `callback` with the
 * containing object/array, the key, and the running {@link RecurseState}.
 */
export const recurse = (
  object: JsonValue,
  state: Partial<RecurseState> | null,
  callback: RecurseCallback
): void => {
  const current: RecurseState =
    !state || !state.depth
      ? { ...defaultState(), ...(state ?? {}) }
      : { ...defaultState(), ...state }

  if (object === null || typeof object !== 'object') return

  const container: JsonContainer = object
  const originalPath = current.path
  for (const key in container) {
    const member = getMember(container, key)
    current.key = key
    current.path = current.path + '/' + jpescape(key)
    const seenPath =
      member !== null && typeof member === 'object' ? current.seen.get(member) : undefined
    current.identityPath = seenPath
    current.identity = typeof seenPath !== 'undefined'
    callback(container, key, current)
    if (member !== null && typeof member === 'object' && !current.identity) {
      if (current.identityDetection && !isJsonArray(member)) {
        current.seen.set(member, current.path)
      }
      recurse(
        member,
        {
          parent: container,
          path: current.path,
          depth: current.depth ? current.depth + 1 : 1,
          pkey: key,
          payload: current.payload,
          seen: current.seen,
          identity: false,
          identityDetection: current.identityDetection
        },
        callback
      )
    }
    current.path = originalPath
  }
}

/**
 * Resolves a JSON Pointer / JSON Reference `pointer` against `root`, optionally
 * setting it to `newValue`. Only internal (`#/…`) references are resolved;
 * external URIs yield `false`. Returns the resolved value, or `false`/`undefined`
 * when it cannot be resolved.
 */
export const jptr = (
  root: JsonValue | undefined,
  pointer: string,
  newValue?: JsonValue
): JsonValue | false | undefined => {
  if (typeof root === 'undefined') return false
  if (!pointer || pointer === '#') return typeof newValue !== 'undefined' ? newValue : root

  let prop = pointer
  if (prop.indexOf('#') >= 0) {
    const parts = prop.split('#')
    if (parts[0]) return false // internal resolution only
    prop = decodeURIComponent(parts[1].slice(1))
  }
  if (prop.startsWith('/')) prop = prop.slice(1)

  let current: JsonValue = root
  const components = prop.split('/')
  for (let i = 0; i < components.length; i++) {
    components[i] = jpunescape(components[i])
    const setAndLast = typeof newValue !== 'undefined' && i === components.length - 1

    let index = parseInt(components[i], 10)
    const numericOnArray =
      isJsonArray(current) && !isNaN(index) && index.toString() === components[i]
    if (!numericOnArray) {
      index = isJsonArray(current) && components[i] === '-' ? -2 : -1
    } else {
      // backtrack to the indexed property name for the hasOwnProperty check
      components[i] = i > 0 ? components[i - 1] : ''
    }

    const ownsKey =
      isJsonObject(current) && Object.prototype.hasOwnProperty.call(current, components[i])

    if (index !== -1 || ownsKey) {
      if (index >= 0 && isJsonArray(current)) {
        if (setAndLast && typeof newValue !== 'undefined') current[index] = newValue
        current = current[index]
      } else if (index === -2) {
        if (setAndLast && typeof newValue !== 'undefined') {
          if (isJsonArray(current)) current.push(newValue)
          return newValue
        }
        return undefined
      } else if (isJsonObject(current)) {
        if (setAndLast && typeof newValue !== 'undefined') current[components[i]] = newValue
        current = current[components[i]]
      }
    } else if (typeof newValue !== 'undefined' && isJsonObject(current)) {
      current[components[i]] = setAndLast ? newValue : {}
      current = current[components[i]]
    } else {
      return false
    }
  }
  return current
}
