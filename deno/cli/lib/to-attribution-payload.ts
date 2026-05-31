/**
 * @fileoverview Build a `SerializableAttribution` payload from
 * `clientSettings.anchors` + the schema source string.
 *
 * Lives separately from `generate-local.ts` so the conversion logic
 * is testable as a pure data → data function. The CLI flag pipeline
 * (Phase D §5.2) will override the `anchors.enabled` decision before
 * this function runs, but the shape of the payload is independent of
 * how the flag resolved.
 */

import type { AnchorsSettings } from '@skmtc/core/Settings'
import type { SerializableAttribution } from '@skmtc/worker/types'

export type ToAttributionPayloadArgs = {
  anchors: AnchorsSettings | undefined
  /**
   * Schema source identifier — the URL or path the producer ran
   * against. Lands on each sidecar's `src` field so re-anchor
   * consumers know which schema produced the file. Falls back to
   * an empty string when unknown.
   */
  schemaSource: string | undefined
  /**
   * CLI flag override for the master switch. `true` from `--anchors`,
   * `false` from `--no-anchors`, `undefined` when neither is passed.
   * When defined, takes precedence over `anchors.enabled`; when
   * undefined, the config value wins.
   */
  flagOverride?: boolean
}

/**
 * Resolve the effective `enabled` value from `(flagOverride,
 * anchors.enabled)`. Exported separately for testing — the rule is
 * simple but worth pinning so a future caller doesn't accidentally
 * change precedence.
 */
export const resolveAnchorsEnabled = (
  anchors: AnchorsSettings | undefined,
  flagOverride: boolean | undefined
): boolean => {
  if (flagOverride !== undefined) return flagOverride
  return anchors?.enabled ?? false
}

/**
 * Returns `undefined` when anchors are disabled (or unconfigured) —
 * the worker treats undefined attribution as "run normally".
 *
 * When enabled, builds a `SerializableAttribution` carrying a
 * `postPass` block with `schemaSrc` (defaulted to `''` when missing) —
 * `postPass` presence is what requests emission (capture is always on
 * in core). `generatorMeta` is left undefined here; later Phase D work
 * will populate it from the project's `deno.json` + lockfile.
 */
export const toAttributionPayload = ({
  anchors,
  schemaSource,
  flagOverride
}: ToAttributionPayloadArgs): SerializableAttribution | undefined => {
  if (!resolveAnchorsEnabled(anchors, flagOverride)) return undefined

  return {
    postPass: {
      schemaSrc: schemaSource ?? ''
    }
  }
}
