/**
 * Headless `merge` path — resolving drift on an ejected file by
 * applying the generator's changes while keeping the user's edits.
 *
 * A classic three-way merge over the versions the writer maintains:
 *
 *   - base   — the committed baseline (`.settings/baselines/`), what
 *              the generator produced when the file was ejected
 *   - ours   — the user's file on disk
 *   - theirs — the last pristine render, persisted by the writer to
 *              the gitignored `.baselines/pristine/` area each
 *              generate (ejected items still render in memory)
 *
 * Non-overlapping changes merge mechanically; any collision refuses
 * whole — a merged file is written entirely or not at all, never with
 * conflict markers. On success the baseline advances to the pristine
 * render (`baselineHash` + committed baseline content), the reviewed
 * hash is cleared, and the file STAYS ejected — merge resolves drift,
 * it does not return ownership (that is `skmtc adopt`).
 *
 * When a formatter is configured, base and theirs (canonical renders)
 * are re-formatted under the current config before merging, because
 * ours is a formatted file; the merged result is then formatted in
 * place.
 */

import { join } from '@std/path/join'
import { dirname } from '@std/path/dirname'
import { normalize } from '@std/path/normalize'
import { resolve } from '@std/path/resolve'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { DEFAULT_GENERATED_SUFFIX, toResolvedArtifactPath } from '@skmtc/core'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toRootPath } from '@/lib/to-root-path.ts'
import { toContentHash } from '@/lib/generated-lock.ts'
import { formatContent, runFormatter } from '@/lib/formatter.ts'
import { isThreeWayDiffable, mergeThreeWay, type LineRange } from '@/lib/three-way.ts'
import { toCommittedBaselinePath, toPristinePath } from '@/lib/baseline-store.ts'
import { readEjections, toEjectionsPath, writeEjections } from '@/lib/ejections.ts'
import {
  readEjectionState,
  toEjectionStatePath,
  writeEjectionState
} from '@/lib/ejection-state.ts'

type MergeHeadlessArgs = {
  projectName: string
  /** The ejected file — on-disk path or export path, as listed by `skmtc status`. */
  file: string
  clientSettings: ClientSettings | undefined
  skmtcRootPath?: string
}

export type MergeHeadlessResult =
  | {
      ok: true
      projectName: string
      ownedArtifactPath: string
      /** True when there was nothing to merge (baseline already current). */
      upToDate: boolean
    }
  | {
      ok: false
      reason: string
      /** For collision refusals: the touching baseline line ranges (0-indexed). */
      collisions?: LineRange[]
    }

export const mergeHeadless = ({
  projectName,
  file,
  clientSettings,
  skmtcRootPath = toRootPath()
}: MergeHeadlessArgs): MergeHeadlessResult => {
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')
  const appRoot = resolve(join(skmtcRootPath, '..'))

  const ownedExportPath = (clientSettings?.ejected ?? []).find(ejectedPath => {
    const ownedArtifact = toResolvedArtifactPath({
      basePath: clientSettings?.basePath,
      destinationPath: ejectedPath
    })
    return (
      normalize(ejectedPath) === normalize(file) || normalize(ownedArtifact) === normalize(file)
    )
  })

  if (!ownedExportPath) {
    return {
      ok: false,
      reason: `"${file}" is not in this project's ejected set. See \`skmtc status\`.`
    }
  }

  const ownedArtifactPath = toResolvedArtifactPath({
    basePath: clientSettings?.basePath,
    destinationPath: ownedExportPath
  })
  const absoluteOwned = join(skmtcRootPath, '..', ownedArtifactPath)

  if (!existsSync(absoluteOwned)) {
    return { ok: false, reason: `"${ownedArtifactPath}" does not exist on disk.` }
  }

  const committedBaselinePath = toCommittedBaselinePath(projectPath, ownedArtifactPath)
  if (!existsSync(committedBaselinePath)) {
    return {
      ok: false,
      reason:
        `No committed baseline for "${ownedArtifactPath}" ` +
        `(.settings/baselines/) — merge needs the content the edits were made against.`
    }
  }

  const pristinePath = toPristinePath(projectPath, ownedArtifactPath)
  if (!existsSync(pristinePath)) {
    return {
      ok: false,
      reason:
        `No pristine render for "${ownedArtifactPath}" — run \`skmtc generate\` first ` +
        `(the writer persists each run's render of ejected files).`
    }
  }

  const baseline = Deno.readTextFileSync(committedBaselinePath)
  const pristine = Deno.readTextFileSync(pristinePath)
  const disk = Deno.readTextFileSync(absoluteOwned)

  const ejectionsPath = toEjectionsPath(manifestPath)
  const ejections = readEjections(ejectionsPath)
  const record = ejections.files[ownedExportPath]

  const pristineHash = toContentHash(pristine)

  if (record?.baselineHash === pristineHash || baseline === pristine) {
    return { ok: true, projectName, ownedArtifactPath, upToDate: true }
  }

  // Ours is a formatted file; bring base and theirs into the same
  // formatting before the line-based merge, or every line differs.
  const formatterCommand = clientSettings?.formatter

  const toComparable = (content: string): string => {
    if (!formatterCommand) {
      return content
    }
    return (
      formatContent({
        command: formatterCommand,
        absolutePath: absoluteOwned,
        content,
        cwd: appRoot
      }) ?? content
    )
  }

  const comparableBase = toComparable(baseline)
  const comparableTheirs = toComparable(pristine)

  // Advance the baseline: the generator's changes are folded in (or
  // already present on disk), so future drift compares against THIS
  // render. The reviewed hash is cleared — there is no outstanding
  // drift to stay quiet about.
  const advanceBaseline = (): void => {
    ensureDirSync(dirname(committedBaselinePath))
    Deno.writeTextFileSync(committedBaselinePath, pristine)

    if (record) {
      record.baselineHash = pristineHash
      delete record.reviewedPristineHash
      writeEjections(ejectionsPath, ejections)
    }

    const statePath = toEjectionStatePath(projectPath)
    const state = readEjectionState(statePath)
    state.files[ownedArtifactPath] = { state: 'quiet', pristineHash }
    writeEjectionState(statePath, state)
  }

  // The user already hand-applied the generator's changes (disk equals
  // the formatted pristine render): nothing to reconcile — advance the
  // baseline without touching the file.
  if (comparableTheirs === disk) {
    advanceBaseline()
    return { ok: true, projectName, ownedArtifactPath, upToDate: false }
  }

  if (!isThreeWayDiffable({ base: comparableBase, ours: disk, theirs: comparableTheirs })) {
    return {
      ok: false,
      reason:
        `"${ownedArtifactPath}" is too large to merge mechanically (the line diff is ` +
        `bounded — see MAX_DIFF_CELLS). Fold the changes by hand from the pristine render ` +
        `at ${pristinePath}, then acknowledge the drift by setting reviewedPristineHash ` +
        `in .settings/ejections.json.`
    }
  }

  const merged = mergeThreeWay({
    base: comparableBase,
    ours: disk,
    theirs: comparableTheirs
  })

  if (!merged.ok) {
    return {
      ok: false,
      reason:
        `The generator's changes collide with your edits in "${ownedArtifactPath}" — ` +
        `resolve by hand (the pristine render is at ${pristinePath}), then acknowledge ` +
        `the drift by setting reviewedPristineHash in .settings/ejections.json.`,
      collisions: merged.collisions
    }
  }

  Deno.writeTextFileSync(absoluteOwned, merged.merged)

  if (formatterCommand) {
    const formatted = runFormatter({
      command: formatterCommand,
      filePaths: [absoluteOwned],
      cwd: appRoot
    })
    if (!formatted.ok) {
      console.error(`Warning: formatter failed after merge (${formatted.error}).`)
    }
  }

  advanceBaseline()

  return { ok: true, projectName, ownedArtifactPath, upToDate: false }
}
