import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { toGenerationStats } from '@/lib/generationStats.ts'

type GenerateArgs = {
  project: Project | RemoteProject
  bundlePath: string
  skmtcRoot: SkmtcRoot
  accountName: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
  token: string | undefined
}

export const generate = async ({
  project,
  bundlePath,
  skmtcRoot,
  accountName,
  schemaContents,
  clientSettings,
  token
}: GenerateArgs) => {
  try {
    const { artifacts, manifest } =
      project instanceof Project
        ? await GenerateArtifacts.generateWithWorker({
            bundlePath,
            schemaContents,
            clientSettings
          })
        : await GenerateArtifacts.generateWithSandboxApi({
            projectName: project.name,
            accountName,
            schemaContents,
            clientSettings,
            token
          })

    const manifestPath = project.toManifestPath()

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest
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
