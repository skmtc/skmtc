import { dirname } from '@std/path/dirname'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { existsSync } from '@std/fs/exists'
import { ensureDirSync } from '@std/fs/ensure-dir'

/**
 * The baseline store keeps the *canonical* (unformatted) render output
 * of the last generate run, one file per artifact, mirrored under
 * `.skmtc/<project>/.baselines/<artifactPath>`.
 *
 * It exists for one job the committed lock's hashes can't do: resolving
 * a formatter-config change. When a disk file matches neither hash in
 * the lock, the writer re-formats this baseline under the *current*
 * formatter config — if that reproduces the disk content, the file is
 * clean (only the formatting moved) rather than hand-edited.
 *
 * The store is build output: gitignored, rebuilt on every generate, and
 * safe to delete (a missing baseline just means a formatter-config
 * change can't be distinguished from an edit until the next reseed —
 * the writer degrades to protecting the file and saying why).
 */

export const baselinesDirName = '.baselines'

export const toBaselinesDir = (projectPath: string): string => {
  return join(projectPath, baselinesDirName)
}

/**
 * The *committed* baseline copy for an ejected file, written at eject
 * time under `.settings/baselines/` (unlike the gitignored cache
 * above, this must survive fresh clones — it is the merge/drift base
 * for a file the user owns).
 */
export const toCommittedBaselinePath = (projectPath: string, ownedArtifactPath: string): string => {
  return join(projectPath, '.settings', 'baselines', ownedArtifactPath)
}

/**
 * The last pristine render of an ejected file, persisted by the writer
 * each generate (ejected items still render in memory). This is what
 * lets `skmtc merge` run offline — the "theirs" side of the three-way
 * — without re-running the engine. Derived output: gitignored,
 * rewritten each generate.
 */
export const toPristinePath = (projectPath: string, ownedArtifactPath: string): string => {
  return join(projectPath, baselinesDirName, 'pristine', ownedArtifactPath)
}

/**
 * Maps an artifact path (app-root relative, the manifest/lock key) to
 * its baseline file. Returns `null` for paths that would escape the
 * baseline dir — same containment stance as `clean`'s guard.
 */
export const toBaselinePath = (baselinesDir: string, artifactPath: string): string | null => {
  const absolutePath = resolve(baselinesDir, artifactPath)

  if (!absolutePath.startsWith(resolve(baselinesDir) + '/')) {
    return null
  }

  return absolutePath
}

export const readBaseline = (baselinesDir: string, artifactPath: string): string | null => {
  const baselinePath = toBaselinePath(baselinesDir, artifactPath)

  if (baselinePath === null || !existsSync(baselinePath)) {
    return null
  }

  return Deno.readTextFileSync(baselinePath)
}

export const writeBaseline = (
  baselinesDir: string,
  artifactPath: string,
  content: string
): void => {
  const baselinePath = toBaselinePath(baselinesDir, artifactPath)

  if (baselinePath === null) {
    return
  }

  ensureDirSync(dirname(baselinePath))
  Deno.writeTextFileSync(baselinePath, content)
}

export const removeBaseline = (baselinesDir: string, artifactPath: string): void => {
  const baselinePath = toBaselinePath(baselinesDir, artifactPath)

  if (baselinePath === null) {
    return
  }

  try {
    Deno.removeSync(baselinePath)
  } catch (_error) {
    // Best-effort: a leftover baseline is harmless build output
  }
}
