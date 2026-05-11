import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import { toRootPath } from '@/lib/to-root-path.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

type DeletePreviousArtifactsArgs = {
  skmtcRootPath: string
  manifestPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
  skmtcRootPath,
  incomingPaths,
  manifestPath
}: DeletePreviousArtifactsArgs) => {
  if (!existsSync(manifestPath)) {
    return
  }

  const manifest = Deno.readTextFileSync(manifestPath)

  const manifestFile = parseOrExplain(
    manifestContent,
    JSON.parse(manifest),
    `manifest at ${manifestPath}`
  )

  if (!manifest) {
    return
  }

  const paths = Object.keys(manifestFile.files)

  paths.forEach(path => {
    try {
      if (!incomingPaths.includes(path)) {
        const absolutePath = join(skmtcRootPath, '..', path)

        Deno.removeSync(absolutePath)
      }
    } catch (_error) {
      // Ignore
      // console.error(`Failed to delete artifact: "${error}"`)
    }
  })
}

type WriteGeneratedFilesArgs = {
  manifestPath: string
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const writeGeneratedFiles = ({
  manifestPath,
  artifacts,
  manifest
}: WriteGeneratedFilesArgs): GenerateResponse => {
  const skmtcRootPath = toRootPath()

  deletePreviousArtifacts({
    incomingPaths: Object.keys(artifacts ?? {}),
    manifestPath,
    skmtcRootPath
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
