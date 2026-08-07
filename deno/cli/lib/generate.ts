import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import type { Project } from '@/lib/project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toGenerationStats } from '@/lib/generationStats.ts'

type GenerateArgs = {
  project: Project
  bundlePath: string
  skmtcRoot: SkmtcRoot
  schemaContents: string
  /**
   * File type of the schema source. Drives which parser the worker
   * runs over `schemaContents`.
   */
  clientSettings: ClientSettings | undefined
  /**
   * When set (from `client.json#serverUrl`), generate against this deployed
   * stack server over HTTP instead of the local `bundle.js`.
   */
  stackUrl?: string
}

export const generate = async ({
  project,
  bundlePath,
  skmtcRoot,
  schemaContents,
  clientSettings,
  stackUrl
}: GenerateArgs) => {
  try {
    const { artifacts, manifest } = await GenerateArtifacts.generateWithWorker({
      bundlePath,
      schemaContents,
      clientSettings,
      stackUrl
    })

    const manifestPath = project.toManifestPath()

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest,
      clientSettings
    })

    const stats = toGenerationStats({ manifest, artifacts })

    await skmtcRoot.manager.cleanup()

    return stats
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    // Sentry.captureException(error)

    // await Sentry.flush()

    await skmtcRoot.manager.cleanup()

    throw error
  }
}
