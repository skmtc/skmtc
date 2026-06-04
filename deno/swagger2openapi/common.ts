/**
 * Helpers shared across the converter and validator: name sanitisation, the
 * camelCase transform, a stable string hash, the parameter/array property
 * lists, and external `$ref` resolution.
 *
 * @module
 */

import { parse as parseYaml } from '@std/yaml'
import { join as joinPath } from '@std/path'
import { type JsonValue, toJson } from './json.ts'
import { jptr } from './reftools.ts'
import type { ResolveOptions } from './types.ts'

/** Version of this package, recorded in `x-origin` converter provenance entries. */
export const VERSION = '0.1.0'

/** Array `filter` predicate keeping only the first occurrence of each value. */
export const uniqueOnly = <T>(value: T, index: number, self: T[]): boolean =>
  self.indexOf(value) === index

/** `true` when `array` contains a repeated value. */
export const hasDuplicates = (array: readonly unknown[]): boolean =>
  new Set(array).size !== array.length

/**
 * A simple, stable 32-bit string hash
 * (based on {@link https://stackoverflow.com/a/7616484/1749888}).
 */
export const hash = (s: string): number => {
  let h = 0
  if (s.length === 0) return h
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i)
    h = ((h << 5) - h) + chr
    h |= 0 // convert to 32-bit integer
  }
  return h
}

/** Converts a delimited string to camelCase (delimiters: `- _ space / .`). */
export const toCamelCase = (s: string): string =>
  s.toLowerCase().replace(/[-_ /.](.)/g, (_match, group1: string) => group1.toUpperCase())

/** Schema/JSON-Schema keywords whose presence migrates a parameter onto its `schema`. */
export const parameterTypeProperties: readonly string[] = [
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'additionalProperties',
  'pattern',
  'enum',
  'default',
]

/** Array-only JSON-Schema keywords. */
export const arrayProperties: readonly string[] = [
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
]

/** HTTP methods recognised as operations within a path item. */
export const httpVerbs: readonly string[] = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'trace',
]

/** Sanitises a component name, replacing illegal characters in its first path segment. */
export const sanitise = (s: string): string => {
  const replaced = s.replace('[]', 'Array')
  const components = replaced.split('/')
  components[0] = components[0].replace(/[^A-Za-z0-9_\-.]+|\s+/gm, '_')
  return components.join('/')
}

/** Sanitises a name, collapsing all `/` separators first. */
export const sanitiseAll = (s: string): string => sanitise(s.split('/').join('_'))

/** Resolves an internal JSON Reference against `root`. */
export const resolveInternal = jptr

const tryParse = (text: string): JsonValue | undefined => {
  try {
    return toJson(parseYaml(text))
  } catch {
    return undefined
  }
}

/** Callback receiving a resolved external document and its resolved target. */
export type ResolveCallback = (data: JsonValue, source: string) => void

/**
 * Resolves an external (`$ref`) document — over HTTP or from the local file
 * system — relative to `options.source`, caching the result and invoking
 * `callback` with the resolved data.
 */
export const resolveExternal = async (
  _root: JsonValue,
  pointer: string,
  options: ResolveOptions,
  callback: ResolveCallback,
): Promise<JsonValue> => {
  const cache = options.cache ?? (options.cache = {})
  const source = (options.source ?? '').split('\\').join('/')
  const sourceParts = source.split('/')
  const filename = sourceParts.pop()
  if (!filename) sourceParts.pop()

  let fragment = ''
  let target = pointer
  const hashParts = pointer.split('#')
  if (hashParts.length > 1) {
    fragment = '#' + hashParts[1]
    target = hashParts[0]
  }
  const base = sourceParts.join('/')

  const pointerIsHttp = /^https?:\/\//.test(target)
  const sourceIsHttp = /^https?:\/\//.test(source)
  const resolvedTarget = pointerIsHttp
    ? target
    : sourceIsHttp
    ? new URL(target, base + '/').toString()
    : base
    ? joinPath(base, target)
    : target

  const deliver = (data: JsonValue): JsonValue => {
    const resolved = fragment ? resolveValue(data, fragment) : data
    callback(resolved, resolvedTarget)
    return resolved
  }

  if (Object.prototype.hasOwnProperty.call(cache, resolvedTarget)) {
    if (options.verbose) console.log('CACHED', resolvedTarget)
    return deliver(cache[resolvedTarget])
  }

  if (options.verbose) console.log('GET', resolvedTarget)

  const protocol = pointerIsHttp || sourceIsHttp ? 'http:' : 'file:'
  const handler = options.handlers?.[protocol]
  if (handler) {
    const data = await handler(base, target, fragment, options)
    callback(data, resolvedTarget)
    return data
  }

  const text = pointerIsHttp || sourceIsHttp
    ? await (await fetch(resolvedTarget)).text()
    : await Deno.readTextFile(resolvedTarget)

  const parsed = tryParse(text)
  if (typeof parsed === 'undefined') {
    // Mirror the original: a non-parseable payload is delivered as-is.
    callback(text, resolvedTarget)
    return text
  }
  cache[resolvedTarget] = parsed
  return deliver(parsed)
}

const resolveValue = (data: JsonValue, fragment: string): JsonValue => {
  const resolved = jptr(data, fragment)
  return resolved === false || typeof resolved === 'undefined' ? data : resolved
}
