import { join } from '@std/path'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'
import { writeGeneratedFiles } from '@/lib/write-generated-files.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { writeSidecars } from '@skmtc/core/Anchors'
import { toGenerationStats, type GenerationStats } from '@/lib/generationStats.ts'
import type { FileType } from '@/lib/types.ts'
import type { ParseIssue } from '@skmtc/core'
import { toAttributionPayload } from '@/lib/to-attribution-payload.ts'

type GenerateLocalArgs = {
  bundlePath: string
  schemaContents: string
  /**
   * File type of the schema source. Determines whether the worker
   * receives an OpenAPI document object or raw GraphQL SDL.
   */
  fileType: FileType
  clientSettings: ClientSettings | undefined
  /**
   * When set (from `client.json#serverUrl`), generate against this deployed
   * stack server over HTTP instead of the local `bundle.js`.
   */
  stackUrl?: string
  manifestPath: string
  /**
   * Filesystem path of the project — `.skmtc/<project>/`. Used to
   * resolve the `anchors.out` subdirectory for sidecar writes.
   */
  projectPath: string
  /**
   * Source identifier for the schema (URL or path). Lands on each
   * sidecar's `src` field. Optional — degrades to `''` when missing.
   */
  schemaSource: string | undefined
  /**
   * CLI flag override for the `anchors.enabled` config field.
   * - `true` from `--anchors` — force on regardless of config
   * - `false` from `--no-anchors` — force off regardless of config
   * - `undefined` (default) — use the config value
   */
  anchorsFlag?: boolean
}

/**
 * Per-run summary of gen-maps output. Populated only when the
 * project's `client.json#settings.anchors.enabled` is `true` (or
 * a future `--anchors` flag overrides it on).
 */
export type GenerateLocalAnchorsStats = {
  /** Absolute path of the `.maps` subtree on disk. */
  outDir: string
  /** Number of sidecars (and the rollup file) written. */
  filesWritten: number
  /** Total bytes written across all sidecars + the generation map. */
  totalBytes: number
  /** Number of Definition entries in the generation map. */
  generationMapEntries: number
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
  /**
   * Gen-maps summary. Present only when anchors were enabled and the
   * post-pass actually ran. Mirrored to the `--json` output.
   */
  anchors?: GenerateLocalAnchorsStats
}

export const generateLocal = async ({
  bundlePath,
  schemaContents,
  fileType,
  clientSettings,
  stackUrl,
  manifestPath,
  projectPath,
  schemaSource,
  anchorsFlag
}: GenerateLocalArgs): Promise<GenerateLocalResult> => {
  try {
    const attribution = toAttributionPayload({
      anchors: clientSettings?.anchors,
      schemaSource,
      flagOverride: anchorsFlag
    })

    const { artifacts, manifest, sidecars, generationMap } =
      await GenerateArtifacts.generateWithWorker({
        bundlePath,
        schemaContents,
        fileType,
        clientSettings,
        attribution,
        stackUrl
      })

    writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest,
      clientSettings
    })

    let anchorsStats: GenerateLocalAnchorsStats | undefined
    if (sidecars && generationMap) {
      const outDir = join(projectPath, clientSettings?.anchors?.out ?? '.maps')
      const { written, totalBytes } = await writeSidecars({
        sidecars,
        generationMap,
        outDir
      })
      anchorsStats = {
        outDir,
        filesWritten: written.length,
        totalBytes,
        generationMapEntries: generationMap.length
      }
    }

    const stats = toGenerationStats({ manifest, artifacts })

    return {
      stats,
      parseIssues: manifest.parseIssues,
      filePaths: Object.keys(artifacts),
      anchors: anchorsStats
    }
  } catch (error) {
    console.error(error instanceof Error ? error : 'Failed to generate artifacts')

    throw error
  }
}
