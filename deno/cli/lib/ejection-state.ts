import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'
import * as v from 'valibot'
import type { ThreeWayClassification } from '@/lib/three-way.ts'

/**
 * Per-run drift state for ejected files, computed by the writer during
 * each generate (it holds all three versions: the committed baseline B,
 * the fresh pristine render P, and the user's disk file D) and read
 * back by `skmtc status`, which runs without the engine and therefore
 * has no P of its own.
 *
 * Derived output: lives in the gitignored `.baselines/` area and is
 * rewritten wholesale each generate. The only *committed* review
 * bookkeeping is `reviewedPristineHash` in `.settings/ejections.json`,
 * which quiets an acknowledged drift until the pristine output changes
 * again.
 */

export type EjectionFileState = {
  /**
   * - `re-adoptable` — the disk file matches current generated output
   *   (edit reverted, or the generator caught up): suggest `skmtc adopt`.
   * - `quiet`        — the generator's output hasn't moved since eject
   *   (or no baseline hash is recorded to compare against).
   * - `drifted`      — the generator now produces something different
   *   from the baseline the user's edits were made against.
   * - `stale`        — no generator produces this file anymore (the
   *   schema item was removed or renamed).
   */
  state: 're-adoptable' | 'quiet' | 'drifted' | 'stale'
  /** SHA-256 of the current pristine render; absent for `stale`. */
  pristineHash?: string
  /** For `drifted`, when baseline content + disk were readable: do the user's edits and the generator's changes overlap? */
  classification?: ThreeWayClassification
  /** For `drifted`: true when `reviewedPristineHash` in ejections.json already matches — the drift was acknowledged. */
  reviewed?: boolean
}

export type EjectionStateContent = {
  version: 1
  /** Keyed by owned artifact path (app-root relative, as the manifest keys files). */
  files: Record<string, EjectionFileState>
}

const ejectionFileState: v.GenericSchema<EjectionFileState> = v.object({
  state: v.union([
    v.literal('re-adoptable'),
    v.literal('quiet'),
    v.literal('drifted'),
    v.literal('stale')
  ]),
  pristineHash: v.optional(v.string()),
  classification: v.optional(v.union([v.literal('non-overlapping'), v.literal('collision')])),
  reviewed: v.optional(v.boolean())
})

export const ejectionStateContent: v.GenericSchema<EjectionStateContent> = v.object({
  version: v.literal(1),
  files: v.record(v.string(), ejectionFileState)
})

export const ejectionStateFileName = 'ejection-state.json'

/** Derived state lives in the gitignored `.baselines/` area, not `.settings/`. */
export const toEjectionStatePath = (projectPath: string): string => {
  return join(projectPath, '.baselines', ejectionStateFileName)
}

/** Tolerant read: missing or malformed state degrades to empty (it is rebuilt on the next generate). */
export const readEjectionState = (statePath: string): EjectionStateContent => {
  if (!existsSync(statePath)) {
    return { version: 1, files: {} }
  }

  try {
    const result = v.safeParse(
      ejectionStateContent,
      JSON.parse(Deno.readTextFileSync(statePath))
    )
    return result.success ? result.output : { version: 1, files: {} }
  } catch (_error) {
    return { version: 1, files: {} }
  }
}

export const writeEjectionState = (statePath: string, content: EjectionStateContent): void => {
  ensureDirSync(dirname(statePath))
  Deno.writeTextFileSync(statePath, JSON.stringify(content, null, 2))
}
