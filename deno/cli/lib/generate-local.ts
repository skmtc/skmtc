import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toGenerationStats } from '@/lib/generationStats.ts'

type GenerateLocalArgs = {
  bundlePath: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
  manifestPath: string
}

export const generateLocal = async ({
  bundlePath,
  schemaContents,
  clientSettings,
  manifestPath
}: GenerateLocalArgs) => {
  try {
    const { artifacts, manifest } = await GenerateArtifacts.generateWithWorker({
      bundlePath,
      schemaContents,
      clientSettings
    })

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest
    })

    const stats = toGenerationStats({ manifest, artifacts })

    return stats
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    throw error
  }
}
