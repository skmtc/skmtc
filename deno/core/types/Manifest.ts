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
import { preview, type Preview, type Mapping, mapping } from './Preview.ts'
import * as v from 'valibot'

export type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
}

export const manifestEntry: v.GenericSchema<ManifestEntry> = v.object({
  lines: v.number(),
  characters: v.number(),
  destinationPath: v.string()
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
  previews: Record<string, Record<string, Preview>>
  mappings?: Record<string, Record<string, Mapping>>
  results: ResultsItem
  startAt: number
  endAt: number
}

export const manifestContent: v.GenericSchema<ManifestContent> = v.object({
  deploymentId: v.string(),
  traceId: v.string(),
  spanId: v.string(),
  region: v.optional(v.string()),
  files: v.record(v.string(), manifestEntry),
  previews: v.record(v.string(), v.record(v.string(), preview)),
  mappings: v.optional(v.record(v.string(), v.record(v.string(), mapping))),
  results: resultsItem,
  startAt: v.number(),
  endAt: v.number()
})
