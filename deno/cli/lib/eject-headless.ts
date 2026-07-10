/**
 * Headless `eject` / `adopt` paths — moving a generated file between
 * engine ownership and user ownership.
 *
 * **Eject** renames `X.generated.ts` → `X.ts`, adds the owned export
 * path to `client.json#settings.ejected` (the authoritative set the
 * engine and writer read), records provenance metadata in
 * `.settings/ejections.json`, re-keys the generated lock entry, and
 * copies the canonical baseline into the committed
 * `.settings/baselines/` store. From the next generate on, the engine
 * stores the owned path into ContentSettings for this item — every
 * peer import specifier follows automatically — and the host never
 * writes or deletes the file.
 *
 * **Adopt** is the inverse: rename back, remove the setting and
 * metadata. It never destroys content — if the adopted file still
 * differs from generated output, the next generate *protects* it (the
 * prime invariant) rather than overwriting.
 *
 * Both operations order their steps so an interruption leaves a safe
 * state: client.json is updated before the rename on eject (a listed
 * but not-yet-renamed file just means one more generate treats the old
 * path as ejected), and after the rename on adopt.
 */

import { join } from '@std/path/join'
import { dirname } from '@std/path/dirname'
import { normalize } from '@std/path/normalize'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'
import * as v from 'valibot'
import {
  applyGeneratedSuffix,
  removeGeneratedSuffix,
  DEFAULT_GENERATED_SUFFIX,
  toResolvedArtifactPath
} from '@skmtc/core'
import type { ClientSettings } from '@skmtc/core/Settings'
import { Manifest } from '@/lib/manifest.ts'
import { toCommittedBaselinePath } from '@/lib/baseline-store.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import { readGeneratedLock, toGeneratedLockPath, writeGeneratedLock } from '@/lib/generated-lock.ts'
import {
  type EjectionItem,
  readEjections,
  toEjectionsPath,
  writeEjections
} from '@/lib/ejections.ts'

type EjectHeadlessArgs = {
  projectName: string
  /**
   * The file to eject — an on-disk artifact path as the manifest keys
   * it (`src/types/user.generated.ts`) or the export path
   * (`@/types/user.generated.tsx`). Matched against manifest keys and
   * entry destinationPaths.
   */
  file: string
  clientSettings: ClientSettings | undefined
  /** Workspace root (`.skmtc`); injectable for tests. */
  skmtcRootPath?: string
}

export type EjectHeadlessResult =
  | {
      ok: true
      projectName: string
      /** Owned export path recorded in `settings.ejected`. */
      ownedExportPath: string
      /** Owned on-disk path (app-root relative). */
      ownedArtifactPath: string
      /** Pre-eject on-disk path. */
      previousArtifactPath: string
      /** Contributing generator items from the generation map (may be empty). */
      items: EjectionItem[]
      /** True when the committed baseline copy was written. */
      baselineRecorded: boolean
    }
  | { ok: false; reason: string }

export const ejectHeadless = async ({
  projectName,
  file,
  clientSettings,
  skmtcRootPath = toRootPath()
}: EjectHeadlessArgs): Promise<EjectHeadlessResult> => {
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')

  const manifest = await Manifest.openFromPath(projectName, manifestPath)

  if (manifest.contents === null) {
    return { ok: false, reason: 'No manifest found — generate the project before ejecting.' }
  }

  const matched = findManifestEntry(manifest.contents.files, file)

  if (!matched) {
    return {
      ok: false,
      reason: `"${file}" is not a generated file the manifest tracks. See \`skmtc status\`.`
    }
  }

  const [artifactPath, entry] = matched

  const suffix = clientSettings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX
  const ownedExportPath = removeGeneratedSuffix(entry.destinationPath, suffix)

  const alreadyEjected = (clientSettings?.ejected ?? []).some(
    ejectedPath => normalize(ejectedPath) === normalize(ownedExportPath)
  )
  if (entry.ejected || alreadyEjected) {
    return { ok: false, reason: `"${file}" is already ejected.` }
  }

  const ownedArtifactPath = toResolvedArtifactPath({
    basePath: clientSettings?.basePath,
    destinationPath: ownedExportPath
  })

  const absoluteCurrent = join(skmtcRootPath, '..', artifactPath)
  const absoluteOwned = join(skmtcRootPath, '..', ownedArtifactPath)

  if (!existsSync(absoluteCurrent)) {
    return { ok: false, reason: `"${artifactPath}" does not exist on disk — nothing to eject.` }
  }

  const renames = normalize(ownedArtifactPath) !== normalize(artifactPath)

  if (renames && existsSync(absoluteOwned)) {
    return {
      ok: false,
      reason:
        `Cannot eject: "${ownedArtifactPath}" already exists. ` +
        `Move or remove it first — ejecting must not overwrite an existing file.`
    }
  }

  // 1. Record intent first: client.json's ejected set is what the
  //    engine and writer honor, so an interruption after this point
  //    leaves the file safe (treated as ejected) even if not yet
  //    renamed.
  updateClientJsonEjected(projectPath, ejected => [...ejected, ownedExportPath])

  // 2. Rename on disk.
  if (renames) {
    ensureDirSync(dirname(absoluteOwned))
    Deno.renameSync(absoluteCurrent, absoluteOwned)
  }

  // 3. Re-key the lock entry — it holds the last-generated hashes, the
  //    base a future adopt/merge resolves from.
  const lockPath = toGeneratedLockPath(manifestPath)
  const lock = readGeneratedLock(lockPath)
  const lockEntry = lock?.files[artifactPath]
  if (lock && lockEntry && renames) {
    delete lock.files[artifactPath]
    lock.files[ownedArtifactPath] = lockEntry
    writeGeneratedLock(lockPath, lock)
  }

  // 4. Copy the canonical baseline into the committed store, so drift
  //    detection and merge work on fresh clones and in CI.
  const cachedBaselinePath = join(projectPath, '.baselines', artifactPath)
  const committedBaselinePath = toCommittedBaselinePath(projectPath, ownedArtifactPath)
  let baselineRecorded = false
  if (existsSync(cachedBaselinePath)) {
    ensureDirSync(dirname(committedBaselinePath))
    Deno.copyFileSync(cachedBaselinePath, committedBaselinePath)
    baselineRecorded = true
  }

  // 5. Provenance metadata.
  const items = readGenerationMapItems({
    projectPath,
    clientSettings,
    destinationPath: entry.destinationPath
  })

  const ejectionsPath = toEjectionsPath(manifestPath)
  const ejections = readEjections(ejectionsPath)
  ejections.files[ownedExportPath] = {
    reason: 'explicit',
    ejectedAt: new Date().toISOString(),
    generatedExportPath: entry.destinationPath,
    items,
    ...(lockEntry ? { baselineHash: lockEntry.canonicalHash } : {})
  }
  writeEjections(ejectionsPath, ejections)

  return {
    ok: true,
    projectName,
    ownedExportPath,
    ownedArtifactPath,
    previousArtifactPath: artifactPath,
    items,
    baselineRecorded
  }
}

type AdoptHeadlessArgs = {
  projectName: string
  /** The owned file — on-disk path or export path, as listed by `skmtc status`. */
  file: string
  clientSettings: ClientSettings | undefined
  skmtcRootPath?: string
}

export type AdoptHeadlessResult =
  | {
      ok: true
      projectName: string
      ownedExportPath: string
      /** On-disk path the file was renamed back to. */
      generatedArtifactPath: string
    }
  | { ok: false; reason: string }

export const adoptHeadless = ({
  projectName,
  file,
  clientSettings,
  skmtcRootPath = toRootPath()
}: AdoptHeadlessArgs): AdoptHeadlessResult => {
  const projectPath = join(skmtcRootPath, projectName)
  const manifestPath = join(projectPath, '.settings', 'manifest.json')
  const suffix = clientSettings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX

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

  const ejectionsPath = toEjectionsPath(manifestPath)
  const ejections = readEjections(ejectionsPath)
  const record = ejections.files[ownedExportPath]

  const generatedExportPath =
    record?.generatedExportPath ?? applyGeneratedSuffix(ownedExportPath, suffix)

  const ownedArtifactPath = toResolvedArtifactPath({
    basePath: clientSettings?.basePath,
    destinationPath: ownedExportPath
  })
  const generatedArtifactPath = toResolvedArtifactPath({
    basePath: clientSettings?.basePath,
    destinationPath: generatedExportPath
  })

  const absoluteOwned = join(skmtcRootPath, '..', ownedArtifactPath)
  const absoluteGenerated = join(skmtcRootPath, '..', generatedArtifactPath)

  const renames = normalize(generatedArtifactPath) !== normalize(ownedArtifactPath)

  if (renames && existsSync(absoluteOwned) && existsSync(absoluteGenerated)) {
    return {
      ok: false,
      reason:
        `Cannot adopt: both "${ownedArtifactPath}" and "${generatedArtifactPath}" exist. ` +
        `Resolve the duplicate first.`
    }
  }

  // 1. Rename back (when the owned file is present — adopt also works
  //    for a deleted owned file: the next generate simply rewrites).
  if (renames && existsSync(absoluteOwned)) {
    ensureDirSync(dirname(absoluteGenerated))
    Deno.renameSync(absoluteOwned, absoluteGenerated)
  }

  // 2. Re-key the lock entry back.
  const lockPath = toGeneratedLockPath(manifestPath)
  const lock = readGeneratedLock(lockPath)
  const lockEntry = lock?.files[ownedArtifactPath]
  if (lock && lockEntry && renames) {
    delete lock.files[ownedArtifactPath]
    lock.files[generatedArtifactPath] = lockEntry
    writeGeneratedLock(lockPath, lock)
  }

  // 3. Release ownership last — from here the engine and writer treat
  //    the file as generated again.
  updateClientJsonEjected(projectPath, ejected =>
    ejected.filter(ejectedPath => normalize(ejectedPath) !== normalize(ownedExportPath))
  )

  delete ejections.files[ownedExportPath]
  writeEjections(ejectionsPath, ejections)

  const committedBaselinePath = toCommittedBaselinePath(projectPath, ownedArtifactPath)
  try {
    Deno.removeSync(committedBaselinePath)
  } catch (_error) {
    // Absent or unremovable — either way, not worth failing the adopt.
  }

  return { ok: true, projectName, ownedExportPath, generatedArtifactPath }
}

/** Matches a user-supplied file argument against manifest keys and destinationPaths. */
const findManifestEntry = (
  files: Record<string, { destinationPath: string; ejected?: boolean }>,
  file: string
): [string, { destinationPath: string; ejected?: boolean }] | undefined => {
  const normalized = normalize(file)

  return Object.entries(files).find(([artifactPath, entry]) => {
    return (
      normalize(artifactPath) === normalized || normalize(entry.destinationPath) === normalized
    )
  })
}

/**
 * Loose parse of client.json for the ejected-set update: validates only
 * what is touched (`settings.ejected`) while `looseObject` passes every
 * other field through verbatim, so a read-modify-write never drops
 * config it doesn't understand.
 */
const clientJsonEjectedSlice = v.object({
  config: v.looseObject({
    settings: v.optional(v.looseObject({ ejected: v.optional(v.array(v.string())) }))
  })
})

/** Read-modify-write of `client.json#settings.ejected`, preserving every other field. */
const updateClientJsonEjected = (
  projectPath: string,
  update: (ejected: string[]) => string[]
): void => {
  const clientJsonPath = join(projectPath, '.settings', 'client.json')

  const { config } = v.parse(clientJsonEjectedSlice, {
    config: JSON.parse(Deno.readTextFileSync(clientJsonPath))
  })

  const settings = config.settings ?? {}
  const nextEjected = update(settings.ejected ?? [])

  if (nextEjected.length === 0) {
    delete settings.ejected
  } else {
    settings.ejected = nextEjected
  }

  config.settings = settings

  Deno.writeTextFileSync(clientJsonPath, JSON.stringify(config, null, 2))
}

/** Contributing items for a destinationPath from `.maps/_map.ndjson`, tolerantly. */
const readGenerationMapItems = ({
  projectPath,
  clientSettings,
  destinationPath
}: {
  projectPath: string
  clientSettings: ClientSettings | undefined
  destinationPath: string
}): EjectionItem[] => {
  const mapPath = join(projectPath, clientSettings?.anchors?.out ?? '.maps', '_map.ndjson')

  if (!existsSync(mapPath)) {
    return []
  }

  try {
    return Deno.readTextFileSync(mapPath)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as { f?: string; g?: string; s?: string; v?: string })
      .filter(mapEntry => mapEntry.f === destinationPath)
      .map(mapEntry => ({
        generator: mapEntry.g ?? '',
        schemaPointer: mapEntry.s ?? '',
        variant: mapEntry.v ?? 'main'
      }))
  } catch (_error) {
    // Provenance is best-effort — a malformed map must not block eject.
    return []
  }
}
