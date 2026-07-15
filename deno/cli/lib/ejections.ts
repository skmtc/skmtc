import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'
import * as v from 'valibot'

/**
 * `.settings/ejections.json` — the committed metadata sidecar for
 * ejected files. The *authoritative* ejected set lives in
 * `client.json#settings.ejected` (that is what the engine and writer
 * read); this file records the why and the provenance for each entry:
 * when it was ejected, which generator items produced the file, what
 * the last-generated content hash was. `skmtc eject`/`adopt` maintain
 * both together; a hand-added `settings.ejected` entry without
 * metadata here is legal (the file is simply ejected with no recorded
 * history).
 */

/** One contributing generator item, copied from the generation map. */
export type EjectionItem = {
  generator: string
  schemaPointer: string
  variant: string
}

export type EjectionRecord = {
  /** `'manual-edit'` when ejection was triggered by a detected edit; `'explicit'` for a direct `skmtc eject`. */
  reason: 'manual-edit' | 'explicit'
  ejectedAt: string
  /** The suffixed export path the engine used before ejection. */
  generatedExportPath: string
  /** Generator items that produced the file (from `_map.ndjson`); empty when gen-maps weren't available. */
  items: EjectionItem[]
}

export type EjectionsContent = {
  version: 1
  /** Keyed by the owned (suffix-less) export path — the same strings as `client.json#settings.ejected`. */
  files: Record<string, EjectionRecord>
}

const ejectionItem: v.GenericSchema<EjectionItem> = v.object({
  generator: v.string(),
  schemaPointer: v.string(),
  variant: v.string()
})

const ejectionRecord: v.GenericSchema<EjectionRecord> = v.object({
  reason: v.union([v.literal('manual-edit'), v.literal('explicit')]),
  ejectedAt: v.string(),
  generatedExportPath: v.string(),
  items: v.array(ejectionItem)
})

export const ejectionsContent: v.GenericSchema<EjectionsContent> = v.object({
  version: v.literal(1),
  files: v.record(v.string(), ejectionRecord)
})

export const ejectionsFileName = 'ejections.json'

/** The metadata sidecar lives beside the manifest in `.settings/`. */
export const toEjectionsPath = (manifestPath: string): string => {
  return join(dirname(manifestPath), ejectionsFileName)
}

/**
 * Tolerant read, matching the manifest/lock contract: missing,
 * malformed, or stale-schema content degrades to an empty store with a
 * stderr warning — ejection metadata is history, and losing it must
 * never block an eject or a generate.
 */
export const readEjections = (ejectionsPath: string): EjectionsContent => {
  if (!existsSync(ejectionsPath)) {
    return { version: 1, files: {} }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(Deno.readTextFileSync(ejectionsPath))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: ejections metadata at ${ejectionsPath} contains invalid JSON (${message}); ` +
        `continuing with empty metadata.`
    )
    return { version: 1, files: {} }
  }

  const result = v.safeParse(ejectionsContent, parsedJson)
  if (!result.success) {
    const summary = result.issues[0]?.message ?? 'schema mismatch'
    console.error(
      `Warning: ejections metadata at ${ejectionsPath} doesn't match the current schema ` +
        `(${summary}); continuing with empty metadata.`
    )
    return { version: 1, files: {} }
  }

  return result.output
}

export const writeEjections = (ejectionsPath: string, content: EjectionsContent): void => {
  ensureDirSync(dirname(ejectionsPath))
  Deno.writeTextFileSync(ejectionsPath, JSON.stringify(content, null, 2))
}
