import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toGenerationStats, type GenerationStats } from '@/lib/generationStats.ts'
import type { FileType } from '@/lib/types.ts'
import type { GqlParseIssue } from '@skmtc/core'

type GenerateLocalArgs = {
  bundlePath: string
  schemaContents: string
  /**
   * File type of the schema source. Determines whether the worker
   * receives an OpenAPI document object or raw GraphQL SDL.
   */
  fileType: FileType
  clientSettings: ClientSettings | undefined
  manifestPath: string
}

export type GenerateLocalResult = {
  stats: GenerationStats
  parseIssues: GqlParseIssue[]
}

export const generateLocal = async ({
  bundlePath,
  schemaContents,
  fileType,
  clientSettings,
  manifestPath
}: GenerateLocalArgs): Promise<GenerateLocalResult> => {
  try {
    const { artifacts, manifest, parseIssues } = await GenerateArtifacts.generateWithWorker({
      bundlePath,
      schemaContents,
      fileType,
      clientSettings
    })

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest
    })

    const stats = toGenerationStats({ manifest, artifacts })

    return { stats, parseIssues }
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    throw error
  }
}
