/**
 * @fileoverview Compact on-disk codec for `client.json`.
 *
 * `client.json` is authored to be human-readable — pretty-printed, with
 * long descriptive keys (`schemaPath`, `moduleSelect`, `exportPath`, …)
 * and string values (`SuccessResponse`, `_embedded`, `RequestBody`, …)
 * repeated thousands of times across an enrichment-heavy project. That
 * makes it large at rest: a real enrichment-heavy `client.json` runs to
 * ~650 KB.
 *
 * This module trades that readability for size using the same technique
 * the gen-maps sidecar uses (`anchors/sidecar.ts`): **a single interned
 * string pool plus an index-referenced structural body**. Every string —
 * object key and string value alike — is stored once in `pool` and
 * referenced by integer everywhere it occurs. Whitespace is dropped. On
 * an enrichment-heavy `client.json` this is ~5–6× smaller than the
 * pretty-printed form.
 *
 * The codec is deliberately **schema-agnostic**: it round-trips any JSON
 * value losslessly, so the main settings block and arbitrary enrichment
 * config compact and expand identically. The gate for validation is
 * unchanged — a compact file is expanded back to a plain object first,
 * then handed to the existing `skmtcClientConfig` valibot schema.
 *
 * Detection is by the top-level `compact: true` discriminator, which is
 * present **only** on compact files; its absence means the file is in the
 * expanded (human-readable) form. See {@link isCompactClientJson}.
 *
 * ## On-disk shape
 *
 * ```json
 * { "compact": true, "cv": 1, "pool": ["project", …], "doc": [5, [ … ]] }
 * ```
 *
 * ## Node encoding ({@link CompactNode})
 *
 * | JSON value | encoded as                                  |
 * |------------|---------------------------------------------|
 * | string     | a bare integer — index into `pool`          |
 * | number     | `[1, n]`                                     |
 * | boolean    | `[2, 0 \| 1]`                               |
 * | null       | `[3]`                                        |
 * | array      | `[4, [node, …]]`                            |
 * | object     | `[5, [keyIdx, node, keyIdx, node, …]]`      |
 *
 * Strings are the overwhelmingly common leaf, so they get the leanest
 * encoding (a bare integer); everything else carries a one-byte tag. In
 * an object the flat payload alternates key index / value node.
 *
 * @module ClientJsonCompact
 */

import * as v from 'valibot'

/**
 * Current compact-format version, written as `cv`. Bump this when the
 * node encoding changes and ship a decoder branch for the older `cv`.
 */
export const COMPACT_VERSION = 1

/**
 * Any JSON-representable value — the domain and codomain of the codec.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * A single encoded node. See the module docstring for the tag table. A
 * bare `number` is a pool index (a string); the tagged tuples cover every
 * other JSON shape.
 */
export type CompactNode =
  | number
  | readonly [1, number]
  | readonly [2, 0 | 1]
  | readonly [3]
  | readonly [4, CompactNode[]]
  | readonly [5, CompactNode[]]

/**
 * The compact envelope written to `client.json`. `compact: true` is the
 * discriminator; `cv` is the format version; `pool` holds every distinct
 * string; `doc` is the encoded root.
 */
export type CompactClientJson = {
  compact: true
  cv: number
  pool: string[]
  doc: CompactNode
}

/**
 * Shallow valibot schema for the compact envelope. Validates the wrapper
 * (discriminator, version, pool, presence of `doc`) but leaves the `doc`
 * tree to {@link decodeCompact}, which walks it with precise errors. A
 * recursive schema over ~10k nodes buys little over the structural checks
 * the decoder already performs.
 */
export const compactClientJson: v.GenericSchema<CompactClientJson> = v.object({
  compact: v.literal(true),
  cv: v.number(),
  pool: v.array(v.string()),
  doc: v.custom<CompactNode>(node => typeof node === 'number' || Array.isArray(node))
})

const isRecord = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Whether a parsed `client.json` value is in the compact form. The check
 * keys off the top-level `compact: true` discriminator alone — expanded
 * files never carry it, so its presence is unambiguous. Call this on the
 * result of `JSON.parse`, before {@link expandClientJson}.
 */
export const isCompactClientJson = (value: unknown): value is CompactClientJson =>
  isRecord(value) && value.compact === true

/**
 * Encode a JSON value into the compact envelope. Interns every string
 * (keys and values) into a shared pool and encodes the structure as an
 * index-referenced node tree.
 *
 * JSON semantics are honoured to match `JSON.stringify`: object entries
 * whose value is `undefined` are dropped, and `undefined` array elements
 * become `null`. A value that JSON cannot represent (function, symbol,
 * bigint) throws rather than silently corrupting the output.
 */
export const encodeCompact = (value: unknown): CompactClientJson => {
  const pool: string[] = []
  const index = new Map<string, number>()

  const intern = (text: string): number => {
    const existing = index.get(text)
    if (existing !== undefined) return existing
    const next = pool.length
    pool.push(text)
    index.set(text, next)
    return next
  }

  const encode = (node: unknown): CompactNode => {
    if (typeof node === 'string') return intern(node)
    if (typeof node === 'boolean') return [2, node ? 1 : 0]
    if (typeof node === 'number') return [1, node]
    if (node === null) return [3]
    if (Array.isArray(node)) {
      // `undefined` is not JSON — `JSON.stringify` renders it as `null`
      // inside an array, so mirror that here.
      return [4, node.map(element => (element === undefined ? [3] : encode(element)))]
    }
    if (isRecord(node)) {
      const flat: CompactNode[] = []
      for (const [key, child] of Object.entries(node)) {
        // Drop `undefined`-valued keys, exactly as `JSON.stringify` does.
        if (child === undefined) continue
        flat.push(intern(key), encode(child))
      }
      return [5, flat]
    }
    throw new TypeError(
      `Cannot compact a value of type ${typeof node}; client.json must be plain JSON`
    )
  }

  const doc = encode(value)
  return { compact: true, cv: COMPACT_VERSION, pool, doc }
}

/**
 * Decode a compact envelope back to the plain JSON value it was built
 * from. The result is byte-for-byte equal (after re-serialization) to the
 * original, so the caller can hand it straight to `skmtcClientConfig`.
 *
 * Throws a `TypeError` on a malformed node (a pool index out of range, a
 * bad tag, an odd-length object payload) — a compact file is wholly
 * machine-written, so a structural fault means corruption, not staleness.
 */
export const decodeCompact = (compact: CompactClientJson): JsonValue => {
  const { pool } = compact

  const lookup = (poolIndex: number): string => {
    const text = pool[poolIndex]
    if (text === undefined) {
      throw new TypeError(`Compact pool index ${poolIndex} is out of range`)
    }
    return text
  }

  const decode = (node: CompactNode): JsonValue => {
    if (typeof node === 'number') return lookup(node)
    switch (node[0]) {
      case 1:
        return node[1]
      case 2:
        return node[1] === 1
      case 3:
        return null
      case 4:
        return node[1].map(decode)
      case 5: {
        const flat = node[1]
        if (flat.length % 2 !== 0) {
          throw new TypeError('Compact object payload must have an even length')
        }
        const out: { [key: string]: JsonValue } = {}
        for (let i = 0; i < flat.length; i += 2) {
          const keyIndex = flat[i]
          if (typeof keyIndex !== 'number') {
            throw new TypeError('Compact object key must be a pool index')
          }
          out[lookup(keyIndex)] = decode(flat[i + 1])
        }
        return out
      }
      default: {
        const exhaustive: never = node
        throw new TypeError(`Unknown compact node tag: ${JSON.stringify(exhaustive)}`)
      }
    }
  }

  return decode(compact.doc)
}

/**
 * Expand a parsed `client.json` value to its plain form. If `parsed` is a
 * compact envelope it is decoded; otherwise it is returned unchanged.
 * This is the one call a reader needs between `JSON.parse` and
 * `skmtcClientConfig` validation.
 */
export const expandClientJson = (parsed: unknown): unknown =>
  isCompactClientJson(parsed) ? decodeCompact(parsed) : parsed
