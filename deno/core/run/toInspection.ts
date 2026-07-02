import type { FileBase } from '../dsl/FileBase.ts'

/**
 * Cycle-safe, depth-bounded serializer for the engine's live `inspectedFiles`
 * graph — turns the real `File` / `Definition` / `Snippet` instances (with their
 * Maps and Sets) into plain JSON a debugger UI or `skmtc inspect` can render
 * generically, without the rendered text hiding the structure.
 *
 * Walks own enumerable properties (the leaf `toString` is non-enumerable, so it
 * never appears), tags each instance with `__class`, and converts Maps/Sets to
 * plain data. Omits `context` (the shared graph that would explode the output),
 * `stackTrail`, and `captureSink` — pure noise on every node.
 *
 * Opt-in via `toArtifacts({ inspect: true })`; the pipeline is otherwise
 * untouched.
 */

const OMIT_KEYS = new Set(['context', 'stackTrail', 'captureSink'])
const MAX_DEPTH = 8
const MAX_STRING = 400

const className = (value: object): string => value.constructor?.name ?? 'Object'

const walk = (value: unknown, depth: number, seen: Set<object>): unknown => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (typeof value !== 'object') {
    return String(value)
  }

  if (seen.has(value)) {
    return '[Circular]'
  }
  if (depth >= MAX_DEPTH) {
    return `[${className(value)} …]`
  }

  seen.add(value)
  try {
    if (value instanceof Map) {
      const out: Record<string, unknown> = { __class: 'Map' }
      for (const [key, val] of value) {
        out[String(key)] = walk(val, depth + 1, seen)
      }
      return out
    }
    if (value instanceof Set) {
      return { __class: 'Set', values: [...value].map(item => walk(item, depth + 1, seen)) }
    }
    if (Array.isArray(value)) {
      return value.map(item => walk(item, depth + 1, seen))
    }
    const out: Record<string, unknown> = {}
    const cls = className(value)
    if (cls !== 'Object') {
      out.__class = cls
    }
    for (const key of Object.keys(value)) {
      if (OMIT_KEYS.has(key)) {
        continue
      }
      out[key] = walk(Reflect.get(value, key), depth + 1, seen)
    }
    return out
  } finally {
    seen.delete(value)
  }
}

/**
 * Serialize the live `inspectedFiles` map into a cycle-safe, depth-bounded plain
 * JSON tree — the real object graph, not the rendered text. Consumed by
 * `skmtc inspect` and the VS Code debugger views.
 */
export const toInspection = (files: ReadonlyMap<string, FileBase>): unknown =>
  walk(files, 0, new Set())
