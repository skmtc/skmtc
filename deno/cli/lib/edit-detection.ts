import type { GeneratedLockContent, GeneratedLockEntry } from '@/lib/generated-lock.ts'
import { toContentHash } from '@/lib/generated-lock.ts'
import { formatContent } from '@/lib/formatter.ts'

/**
 * Everything edit detection needs to classify one on-disk artifact.
 * Bundled once per run and threaded through the writer's overwrite
 * path, the stale-artifact prune, and `skmtc status`, so every
 * consumer enforces the same invariant: a hand-edited generated file
 * is never overwritten and never deleted.
 */
export type EditDetectionContext = {
  lock: GeneratedLockContent | null
  /** From `client.json#settings.formatter`; absent → raw comparison only. */
  formatterCommand: string | undefined
  /** App root — cwd for formatter runs. */
  appRoot: string
}

export type ClassifyResult = {
  edited: boolean
  diskHash: string
  /**
   * Set when the mismatch was explained by a formatter-config change
   * (re-formatting `freshCanonicalContent` under the current config
   * reproduces the disk content). The caller records this as the
   * file's new `formattedHash` so the next run compares cheaply.
   */
  driftResolvedFormattedHash?: string
}

/**
 * Decides whether the file at `absolutePath` was hand-edited since the
 * run recorded in `lockEntry`:
 *
 * 1. Disk matches `formattedHash` → untouched.
 * 2. Otherwise, re-format `freshCanonicalContent` under the *current*
 *    formatter config; if that reproduces the disk content, only the
 *    formatting moved (config change) — untouched.
 * 3. Otherwise: edited.
 *
 * `freshCanonicalContent` is this run's live canonical render for the
 * artifact — from the engine during `generate`, or from `status`/
 * `clean`'s own on-demand engine call. It's `undefined` when nothing
 * rendered this artifact this run (a stale-artifact protect-check) or
 * the engine couldn't be reached (the schema-unreachable degrade
 * path) — either way step 2 is skipped and a hash mismatch is edited.
 */
export const classifyDiskFile = ({
  absolutePath,
  lockEntry,
  detection,
  freshCanonicalContent
}: {
  absolutePath: string
  lockEntry: GeneratedLockEntry
  detection: EditDetectionContext
  freshCanonicalContent: string | undefined
}): ClassifyResult => {
  const diskContent = Deno.readTextFileSync(absolutePath)
  const diskHash = toContentHash(diskContent)

  if (diskHash === lockEntry.formattedHash) {
    return { edited: false, diskHash }
  }

  const { formatterCommand, appRoot } = detection

  if (formatterCommand && freshCanonicalContent !== undefined) {
    const formattedFresh = formatContent({
      command: formatterCommand,
      absolutePath,
      content: freshCanonicalContent,
      cwd: appRoot
    })

    if (formattedFresh !== null && toContentHash(formattedFresh) === diskHash) {
      return { edited: false, diskHash, driftResolvedFormattedHash: diskHash }
    }
  }

  return { edited: true, diskHash }
}
