import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toGenerationStats, type GenerationStats } from '@/lib/generationStats.ts'
import type { FileType } from '@/lib/types.ts'
import type { ParseIssue } from '@skmtc/core'

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
  /**
   * Parse-time issues for this run. Sourced from `manifest.parseIssues`
   * (the manifest is now the persistent record of every run-level
   * diagnostic); surfaced separately here for convenience so the CLI
   * summary doesn't have to re-dig into the manifest.
   */
  parseIssues: ParseIssue[]
  /**
   * Paths of every file the run wrote, relative to the SKMTC root.
   * Surfaced so `--json` consumers (and agents) can see exactly where
   * the output landed without re-parsing the manifest — closes
   * friction #14 in structured form.
   */
  filePaths: string[]
}

export const generateLocal = async ({
  bundlePath,
  schemaContents,
  fileType,
  clientSettings,
  manifestPath
}: GenerateLocalArgs): Promise<GenerateLocalResult> => {
  try {
    const { artifacts, manifest } = await GenerateArtifacts.generateWithWorker({
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

    return {
      stats,
      parseIssues: manifest.parseIssues,
      filePaths: Object.keys(artifacts)
    }
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    throw error
  }
}
