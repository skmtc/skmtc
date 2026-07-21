import { createHash } from 'node:crypto'
import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'
import * as v from 'valibot'

/**
 * Per-file record in the generated lock. Both hashes are lowercase hex
 * SHA-256 digests of file *content*:
 *
 * - `canonicalHash` — the render output exactly as the worker produced
 *   it (unformatted). Stable across formatter and formatter-config
 *   changes; this is the identity edit detection ultimately compares.
 * - `formattedHash` — the bytes actually on disk after the post-write
 *   formatter ran (equal to `canonicalHash` when no formatter is
 *   configured). A disk file matching this hash is provably untouched.
 */
export type GeneratedLockEntry = {
  canonicalHash: string
  formattedHash: string
}

/**
 * Content of `.settings/generated.lock.json` — a machine-local record
 * of what the last generate run wrote, keyed by artifact path (the
 * same app-root-relative keys the manifest uses). The lock is a
 * write-avoidance cache for `writeGeneratedFiles` (an unchanged render
 * whose disk bytes still match the recorded post-formatter state skips
 * the rewrite, keeping mtimes stable) and the informational baseline
 * `status` and `clean` classify against. It never blocks an overwrite
 * — generated files are engine-owned.
 */
export type GeneratedLockContent = {
  version: 1
  files: Record<string, GeneratedLockEntry>
}

const generatedLockEntry: v.GenericSchema<GeneratedLockEntry> = v.object({
  canonicalHash: v.string(),
  formattedHash: v.string()
})

export const generatedLockContent: v.GenericSchema<GeneratedLockContent> = v.object({
  version: v.literal(1),
  files: v.record(v.string(), generatedLockEntry)
})

export const generatedLockFileName = 'generated.lock.json'

/** The lock lives beside the manifest in the project's `.settings/`. */
export const toGeneratedLockPath = (manifestPath: string): string => {
  return join(dirname(manifestPath), generatedLockFileName)
}

/**
 * Tolerant read, mirroring the manifest's contract: a missing,
 * malformed, or stale-schema lock degrades to `null` (edit detection
 * disabled for the run — this run's write reseeds it) instead of
 * aborting the generate. The warning lands on stderr so `--json`
 * consumers reading stdout stay clean.
 */
export const readGeneratedLock = (lockPath: string): GeneratedLockContent | null => {
  if (!existsSync(lockPath)) {
    return null
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(Deno.readTextFileSync(lockPath))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: generated lock at ${lockPath} contains invalid JSON (${message}); ` +
        `edit detection is disabled for this run and the lock will be reseeded.`
    )
    return null
  }

  const result = v.safeParse(generatedLockContent, parsedJson)
  if (!result.success) {
    const summary = result.issues[0]?.message ?? 'schema mismatch'
    console.error(
      `Warning: generated lock at ${lockPath} doesn't match the current schema (${summary}); ` +
        `edit detection is disabled for this run and the lock will be reseeded.`
    )
    return null
  }

  return result.output
}

export const writeGeneratedLock = (lockPath: string, content: GeneratedLockContent): void => {
  ensureDirSync(dirname(lockPath))
  Deno.writeTextFileSync(lockPath, JSON.stringify(content, null, 2))
}

/**
 * Lowercase hex SHA-256 of a text file's content. Uses the `node:crypto`
 * builtin because it is synchronous — the writer runs sync end-to-end so
 * watch-mode retriggers can never interleave with a write in flight
 * (`crypto.subtle.digest` is async-only).
 */
export const toContentHash = (content: string): string => {
  return createHash('sha256').update(content).digest('hex')
}
