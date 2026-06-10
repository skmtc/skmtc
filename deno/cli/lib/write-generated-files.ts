import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { resolve } from '@std/path/resolve'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import type { ClientSettings } from '@skmtc/core/Settings'
import * as v from 'valibot'
import { toRootPath, toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { pruneEmptyDirs, toAnchorDirs } from '@/lib/prune-empty-dirs.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

type DeletePreviousArtifactsArgs = {
  skmtcRootPath: string
  manifestPath: string
  incomingPaths: string[]
  /** Output anchors from the run's client.json — used to bound the
   *  empty-dir prune that follows file deletion. When absent (no
   *  basePath, or called without settings), dirs aren't pruned. */
  clientSettings?: ClientSettings
}

export const deletePreviousArtifacts = ({
  skmtcRootPath,
  incomingPaths,
  manifestPath,
  clientSettings
}: DeletePreviousArtifactsArgs) => {
  if (!existsSync(manifestPath)) {
    return
  }

  // Tolerant read: stale/malformed manifests degrade to a no-op
  // instead of aborting the generate run. The next `skmtc generate`
  // pass rewrites the manifest, so a stale one is self-healing —
  // it just means we can't prune the previous run's artifacts on
  // this single pass. The warning lands on stderr so `--json`
  // consumers reading stdout stay clean.
  const raw = Deno.readTextFileSync(manifestPath)
  const manifestFile = readManifestForCleanup(raw, manifestPath)
  if (manifestFile === null) {
    return
  }

  const paths = Object.keys(manifestFile.files)

  const deletedAbsPaths: string[] = []

  paths.forEach(path => {
    try {
      if (!incomingPaths.includes(path)) {
        const absolutePath = join(skmtcRootPath, '..', path)

        Deno.removeSync(absolutePath)
        deletedAbsPaths.push(absolutePath)
      }
    } catch (_error) {
      // Ignore
      // console.error(`Failed to delete artifact: "${error}"`)
    }
  })

  // Prune any directories the stale-artifact deletion emptied, bounded
  // by the output anchors so the walk can never remove basePath or a
  // package root. Same self-limiting prune `clean` uses.
  const anchors = toAnchorDirs(resolve(toAbsoluteRootPath()), clientSettings)
  if (anchors && deletedAbsPaths.length > 0) {
    pruneEmptyDirs({ deletedAbsPaths, anchors, dryRun: false })
  }
}

/**
 * Parses a manifest payload, returning `null` for any failure that
 * would otherwise abort cleanup. Mirrors the tolerant behavior of
 * `Manifest.open` — see {@link lib/manifest.ts}.
 */
const readManifestForCleanup = (
  raw: string,
  manifestPath: string
): ManifestContent | null => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `Warning: manifest at ${manifestPath} contains invalid JSON (${message}); ` +
        `skipping previous-artifact cleanup. The next \`skmtc generate\` run will rewrite it.`
    )
    return null
  }
  const result = v.safeParse(manifestContent, parsedJson)
  if (!result.success) {
    const summary = result.issues[0]?.message ?? 'schema mismatch'
    console.error(
      `Warning: manifest at ${manifestPath} doesn't match the current schema (${summary}); ` +
        `skipping previous-artifact cleanup. The next \`skmtc generate\` run will rewrite it.`
    )
    return null
  }
  return result.output
}

type WriteGeneratedFilesArgs = {
  manifestPath: string
  artifacts: Record<string, string>
  manifest: ManifestContent
  /** Output anchors from the run's client.json — forwarded to the
   *  stale-artifact prune so it can clean up emptied directories. */
  clientSettings?: ClientSettings
}

export const writeGeneratedFiles = ({
  manifestPath,
  artifacts,
  manifest,
  clientSettings
}: WriteGeneratedFilesArgs): GenerateResponse => {
  const skmtcRootPath = toRootPath()

  deletePreviousArtifacts({
    incomingPaths: Object.keys(artifacts ?? {}),
    manifestPath,
    skmtcRootPath,
    clientSettings
  })

  ensureFileSync(manifestPath)

  Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
    const content = String(artifactContent)
    const absolutePath = join(skmtcRootPath, '..', artifactPath)

    const { dir } = parse(absolutePath)

    ensureDirSync(dir)

    Deno.writeTextFileSync(absolutePath, content)
  })

  return { manifest, artifacts }
}
