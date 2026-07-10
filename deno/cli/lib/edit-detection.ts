import type { GeneratedLockContent, GeneratedLockEntry } from '@/lib/generated-lock.ts'
import { toContentHash } from '@/lib/generated-lock.ts'
import { readBaseline } from '@/lib/baseline-store.ts'
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
  /** Absent when the caller didn't supply a `projectPath` (baselines disabled). */
  baselinesDir: string | null
  /** App root — cwd for formatter runs. */
  appRoot: string
}

export type ClassifyResult = {
  edited: boolean
  diskHash: string
  /**
   * Set when the mismatch was explained by a formatter-config change
   * (re-formatting the stored baseline under the current config
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
 * 2. Otherwise, re-format the canonical baseline under the *current*
 *    formatter config; if that reproduces the disk content, only the
 *    formatting moved (config change) — untouched.
 * 3. Otherwise: edited.
 */
export const classifyDiskFile = ({
  artifactPath,
  absolutePath,
  lockEntry,
  detection
}: {
  artifactPath: string
  absolutePath: string
  lockEntry: GeneratedLockEntry
  detection: EditDetectionContext
}): ClassifyResult => {
  const diskContent = Deno.readTextFileSync(absolutePath)
  const diskHash = toContentHash(diskContent)

  if (diskHash === lockEntry.formattedHash) {
    return { edited: false, diskHash }
  }

  const { formatterCommand, baselinesDir, appRoot } = detection

  if (formatterCommand && baselinesDir) {
    const baseline = readBaseline(baselinesDir, artifactPath)

    if (baseline !== null) {
      const formattedBaseline = formatContent({
        command: formatterCommand,
        absolutePath,
        content: baseline,
        cwd: appRoot
      })

      if (formattedBaseline !== null && toContentHash(formattedBaseline) === diskHash) {
        return { edited: false, diskHash, driftResolvedFormattedHash: diskHash }
      }
    }
  }

  return { edited: true, diskHash }
}
