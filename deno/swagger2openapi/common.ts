/**
 * Pure helpers shared across the converter and validator: name sanitisation,
 * the camelCase transform, a stable string hash, and the parameter/array
 * property lists. (External `$ref` resolution lives in `./io.ts` — keep this
 * module free of `Deno`/`fetch` so the converter graph stays I/O-free.)
 *
 * @module
 */

import { jptr } from './reftools.ts'

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
    h = (h << 5) - h + chr
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
  'default'
]

/** Array-only JSON-Schema keywords. */
export const arrayProperties: readonly string[] = ['items', 'minItems', 'maxItems', 'uniqueItems']

/** HTTP methods recognised as operations within a path item. */
export const httpVerbs: readonly string[] = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'trace'
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
