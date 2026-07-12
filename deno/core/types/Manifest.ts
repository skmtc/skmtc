/**
 * @fileoverview Generation Manifest System for SKMTC Core
 *
 * This module provides comprehensive manifest generation for tracking and organizing
 * all artifacts produced during the SKMTC code generation process. The manifest
 * system captures metadata about generated files, including size metrics, locations,
 * preview information, and generation statistics.
 *
 * Manifests serve as a complete inventory of generated content, enabling tools,
 * IDEs, and other systems to understand what was generated and how to interact
 * with the generated code.
 *
 * ## Key Features
 *
 * - **File Tracking**: Complete inventory of all generated files with metrics
 * - **Size Analytics**: Line counts, character counts, and size statistics
 * - **Preview Integration**: Rich preview metadata for UI generation
 * - **Generation Stats**: Detailed metrics about the generation process
 * - **Type Safety**: Comprehensive validation with Valibot schemas
 *
 * @example Creating a manifest entry
 * ```typescript
 * import type { ManifestEntry } from '@skmtc/core/Manifest';
 *
 * const entry: ManifestEntry = {
 *   lines: 150,
 *   characters: 4200,
 *   destinationPath: './src/generated/UserApi.ts'
 * };
 * ```
 *
 * @example Processing manifest content
 * ```typescript
 * import type { ManifestContent } from '@skmtc/core/Manifest';
 *
 * const manifest: ManifestContent = {
 *   files: {
 *     'UserApi.ts': {
 *       lines: 150,
 *       characters: 4200,
 *       destinationPath: './src/generated/UserApi.ts'
 *     }
 *   },
 *   stats: {
 *     totalFiles: 1,
 *     totalLines: 150,
 *     totalCharacters: 4200,
 *     generatedAt: new Date().toISOString()
 *   },
 *   previews: [],
 *   mappings: []
 * };
 * ```
 *
 * @example Using manifest for tooling
 * ```typescript
 * function analyzeGeneration(manifest: ManifestContent) {
 *   const fileCount = Object.keys(manifest.files).length;
 *   const totalSize = Object.values(manifest.files)
 *     .reduce((sum, file) => sum + file.characters, 0);
 *
 *   console.log(`Generated ${fileCount} files with ${totalSize} characters`);
 *
 *   // Process previews for UI generation
 *   manifest.previews.forEach(preview => {
 *     console.log(`Preview available: ${preview.title}`);
 *   });
 * }
 * ```
 *
 * @module Manifest
 */

import { resultsItem, type ResultsItem } from './Results.ts'
import { preview, type Preview } from './Preview.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'
import { enrichmentWarning, type EnrichmentWarning } from '@/enrichments/EnrichmentWarning.ts'
import { oasIssueType } from '@/context/generateTypes.ts'
import { gqlIssueType } from '@/context/ParseIssue.ts'
import * as v from 'valibot'

/**
 * Valibot schema for the unified {@link ParseIssue} discriminated union.
 *
 * The TS type and this schema stay in sync via the
 * `v.GenericSchema<ParseIssue>` annotation — adding a variant on one
 * side without the other fails to type-check.
 */
const parseIssue: v.GenericSchema<ParseIssue> = v.variant('protocol', [
  v.variant('level', [
    v.object({
      protocol: v.literal('oas'),
      level: v.literal('error'),
      type: oasIssueType,
      location: v.string(),
      message: v.string(),
      cause: v.optional(v.unknown())
    }),
    v.object({
      protocol: v.literal('oas'),
      level: v.literal('warning'),
      type: oasIssueType,
      location: v.string(),
      message: v.string()
    }),
    v.object({
      protocol: v.literal('oas'),
      level: v.literal('debug'),
      type: oasIssueType,
      location: v.string(),
      message: v.string()
    })
  ]),
  v.variant('level', [
    v.object({
      protocol: v.literal('gql'),
      level: v.literal('error'),
      type: gqlIssueType,
      location: v.string(),
      message: v.string(),
      cause: v.optional(v.unknown())
    }),
    v.object({
      protocol: v.literal('gql'),
      level: v.literal('warning'),
      type: gqlIssueType,
      location: v.string(),
      message: v.string()
    }),
    v.object({
      protocol: v.literal('gql'),
      level: v.literal('debug'),
      type: gqlIssueType,
      location: v.string(),
      message: v.string()
    })
  ])
])

export type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
  /**
   * True when the file is ejected (`client.json#settings.ejected`) —
   * the user owns it. The item still generated in memory (its content
   * is drift detection's input) but the CLI did not write it to disk
   * and will never delete it. Annotated by the CLI writer, not the
   * engine.
   */
  ejected?: boolean
}

export const manifestEntry: v.GenericSchema<ManifestEntry> = v.object({
  lines: v.number(),
  characters: v.number(),
  destinationPath: v.string(),
  ejected: v.optional(v.boolean())
})

export type PreviewItem = {
  name: string
  exportPath: string
}

export const previewItem: v.GenericSchema<PreviewItem> = v.object({
  name: v.string(),
  exportPath: v.string()
})

export type ManifestContent = {
  deploymentId: string
  traceId: string
  spanId: string
  region?: string
  files: Record<string, ManifestEntry>
  previews: Record<string, Preview>
  results: ResultsItem
  /**
   * Issues recorded during the parse phase — both protocol-agnostic
   * (OAS and GQL share the same union). Defaults to `[]` for clean
   * parses. Lives in the manifest so post-run diagnostics can re-read
   * it from `.settings/manifest.json` without re-running.
   */
  parseIssues: ParseIssue[]
  /**
   * Enrichment addressing / unknown-key warnings recorded during the
   * generate phase — dead config the engine never consumed, keys the
   * generator's schema dropped, and info lines for enrichments on
   * skipped items. Empty for a clean run; optional so manifests written
   * by older cores still parse.
   */
  enrichmentWarnings?: EnrichmentWarning[]
  startAt: number
  endAt: number
}

export const manifestContent: v.GenericSchema<ManifestContent> = v.object({
  deploymentId: v.string(),
  traceId: v.string(),
  spanId: v.string(),
  region: v.optional(v.string()),
  files: v.record(v.string(), manifestEntry),
  previews: v.record(v.string(), preview),
  results: resultsItem,
  parseIssues: v.array(parseIssue),
  enrichmentWarnings: v.optional(v.array(enrichmentWarning)),
  startAt: v.number(),
  endAt: v.number()
})
