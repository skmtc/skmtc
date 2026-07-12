/**
 * @fileoverview Unknown-key detection for enrichment leaves.
 *
 * Valibot's `v.object` strips keys the schema does not declare — a
 * misspelled optional key (`submitLabl` for `submitLabel`) parses cleanly
 * and the generator silently sees the default. `findUnknownKeys` walks a
 * value against its schema and reports every key the schema would drop,
 * so `parseEnrichmentUmbrella` can surface them as
 * `UNKNOWN_ENRICHMENT_KEY` warnings.
 *
 * Comparing against the *schema* (not the parsed output) keeps the check
 * immune to `v.pipe` transforms that legitimately reshape output, and
 * gives correct "did you mean …?" suggestions — the intended key is in
 * the schema's entries even when it is optional and absent from the
 * parsed value. This is deliberately a warning layer, not
 * `v.strictObject`: a shared client.json paired with an older generator
 * version stays survivable under version skew instead of hard-failing.
 *
 * The walk is fail-open: unions, intersections, loose objects, and any
 * shape it cannot attribute keys to are left alone.
 *
 * @module findUnknownKeys
 */

import { isEntriesRecord, isValibotSchema, unwrap } from '@/enrichments/valibotShape.ts'
import { nearestKey } from '@/helpers/nearestKey.ts'

/**
 * One key the schema would silently drop. `path` runs from the walked
 * root down to the unknown key (array indices as strings); `suggestion`
 * is the nearest declared key at the same level, when a plausible typo
 * target exists.
 */
export type UnknownKey = {
  path: string[]
  suggestion?: string
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const walk = (rawSchema: unknown, value: unknown, path: string[], out: UnknownKey[]): void => {
  if (value === undefined || value === null) return
  if (!isValibotSchema(rawSchema)) return

  // A piped schema spreads its base, so `type` / `entries` / `item` are
  // still visible here — no explicit pipe handling needed.
  const { inner } = unwrap(rawSchema)

  switch (inner.type) {
    case 'object': {
      if (!isRecord(value) || !isEntriesRecord(inner.entries)) return
      const entries = inner.entries
      const declared = Object.keys(entries)

      for (const [key, member] of Object.entries(value)) {
        if (key in entries) {
          walk(entries[key], member, [...path, key], out)
          continue
        }
        const suggestion = nearestKey(key, declared)
        out.push({ path: [...path, key], ...(suggestion !== undefined ? { suggestion } : {}) })
      }
      return
    }
    case 'record': {
      if (!isRecord(value)) return
      for (const [key, member] of Object.entries(value)) {
        walk(inner.value, member, [...path, key], out)
      }
      return
    }
    case 'array': {
      if (!Array.isArray(value)) return
      value.forEach((member, index) => walk(inner.item, member, [...path, String(index)], out))
      return
    }
    default:
      // Leaves, unions, intersections, loose/strict objects: nothing to
      // attribute, or Valibot itself errors loudly (strict). Fail open.
      return
  }
}

/**
 * Every key in `value` that `schema` does not declare and `v.parse` would
 * therefore drop. Wrong-typed values are not this function's concern —
 * the subsequent `v.parse` throws on those as before.
 */
export const findUnknownKeys = (schema: unknown, value: unknown): UnknownKey[] => {
  const out: UnknownKey[] = []
  walk(schema, value, [], out)
  return out
}
