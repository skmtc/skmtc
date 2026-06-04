/**
 * I/O-bearing entry points: external `$ref` resolution plus the file / URL /
 * stream converters. Kept in a SEPARATE module from {@link ./converter.ts} so
 * that pure, in-memory consumers (notably `@skmtc/convert`, which imports
 * `@skmtc/swagger2openapi/converter` and only calls `convertObj`/`convertStr`)
 * never pull `Deno.readTextFile` / `fetch` into their module graph. That keeps
 * those bundles small and free of runtime-host globals.
 *
 * @module
 */

import { parse as parseYaml } from '@std/yaml'
import { join as joinPath } from '@std/path'
import {
  isJsonArray,
  isJsonObject,
  isRef,
  isString,
  type JsonObject,
  type JsonValue,
  toJson,
} from './json.ts'
import { clone, jptr, recurse, type RecurseState } from './reftools.ts'
import { ConvertError, main, parseInput, prepare, toResult } from './converter.ts'
import type { ConvertOptions, ConvertResult, External, ResolveOptions } from './types.ts'

const tryParse = (text: string): JsonValue | undefined => {
  try {
    return toJson(parseYaml(text))
  } catch {
    return undefined
  }
}

const resolveValue = (data: JsonValue, fragment: string): JsonValue => {
  const resolved = jptr(data, fragment)
  return resolved === false || typeof resolved === 'undefined' ? data : resolved
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

const findExternalRefs = (
  master: JsonValue,
  options: ConvertOptions,
  externals: External[],
  actions: Promise<JsonValue>[],
): void => {
  recurse(master, null, (container, key, state: RecurseState) => {
    if (!isJsonObject(container)) return
    if (!isRef(container, key)) return
    const ref = container[key]
    if (!isString(ref) || ref.startsWith('#')) return
    actions.push(
      resolveExternal(master, ref, options, (data, source) => {
        externals.push({
          context: state.path,
          $ref: ref,
          original: clone(data),
          updated: data,
          source,
        })
        const localOptions: ConvertOptions = { ...options, source }
        findExternalRefs(data, localOptions, externals, actions)
        if (options.patch && isJsonObject(data) && typeof data.description === 'undefined') {
          const description = container.description
          if (typeof description !== 'undefined') data.description = description
        }
        if (typeof key !== 'undefined') {
          const parent = state.parent
          if (isJsonObject(parent)) parent[state.pkey] = data
          else if (isJsonArray(parent)) parent[Number(state.pkey)] = data
        }
      }),
    )
  })
}

const resolveExternalRefs = async (
  openapi: JsonObject,
  options: ConvertOptions,
  externals: External[],
): Promise<void> => {
  const actions: Promise<JsonValue>[] = []
  findExternalRefs(openapi, options, externals, actions)
  for (const action of actions) {
    await action // sequential because the action list mutates while iterating
  }
}

/** Like `convertObj`, but resolves external `$ref`s first (asynchronous). */
export const convertObjResolve = async (
  swagger: JsonValue,
  options: ConvertOptions = {},
): Promise<ConvertResult> => {
  if (!isJsonObject(swagger)) throw new ConvertError('Document must be an object')
  const externals: External[] = []
  const { openapi, isV2 } = prepare(swagger, options)
  if (options.resolve) await resolveExternalRefs(openapi, options, externals)
  if (isV2) main(openapi, options)
  return toResult(openapi, externals, false)
}

const convertStrResolve = async (str: string, options: ConvertOptions): Promise<ConvertResult> => {
  const parsed = parseInput(str)
  if (!parsed) throw new ConvertError('Could not parse the input as JSON or YAML')
  const result = await convertObjResolve(parsed.value, options)
  return toResult(result.openapi, result.externals, parsed.yaml)
}

/** Reads, parses, and converts a local file (resolving external `$ref`s when requested). */
export const convertFile = async (
  filename: string,
  options: ConvertOptions = {},
): Promise<ConvertResult> => {
  const text = await Deno.readTextFile(filename)
  if (!options.source) options.source = filename
  return await convertStrResolve(text, options)
}

/** Fetches, parses, and converts a remote document (resolving external `$ref`s when requested). */
export const convertUrl = async (
  url: string,
  options: ConvertOptions = {},
): Promise<ConvertResult> => {
  if (!options.origin) options.origin = url
  if (options.verbose) console.log('GET ' + url)
  const response = await fetch(url)
  const text = await response.text()
  if (!options.source) options.source = url
  return await convertStrResolve(text, options)
}

/** Drains a readable stream, then parses and converts its contents. */
export const convertStream = async (
  readable: ReadableStream<Uint8Array>,
  options: ConvertOptions = {},
): Promise<ConvertResult> => {
  const text = await new Response(readable).text()
  return await convertStrResolve(text, options)
}
