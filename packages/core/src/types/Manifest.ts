import "../_dnt.polyfills.js";
import { isGeneratorKey } from './GeneratorKeys.js'
import type { GeneratorKey } from './GeneratorKeys.js'
import { z } from 'zod'
import { resultsItem, type ResultsItem } from './Results.js'
import { preview, type Preview } from './Preview.js'
export type ManifestEntry = {
  numberOfLines: number
  numberOfCharacters: number
  hash: string
  generatorKeys: GeneratorKey[]
  destinationPath: string
}

export const manifestEntry = z.object({
  numberOfLines: z.number(),
  numberOfCharacters: z.number(),
  hash: z.string(),
  generatorKeys: z.array(z.string().refine(isGeneratorKey)),
  destinationPath: z.string()
})

export type PreviewItem = {
  name: string
  exportPath: string
}

export const previewItem = z.object({
  name: z.string(),
  exportPath: z.string()
})

export type ManifestContent = {
  deploymentId: string
  traceId: string
  spanId: string
  region?: string
  files: Record<string, ManifestEntry>
  previews: Record<string, Record<string, Preview>>
  pinnable: Partial<Record<GeneratorKey, string>>
  results: ResultsItem
  startAt: number
  endAt: number
}

export const manifestContent = z.object({
  deploymentId: z.string(),
  traceId: z.string(),
  spanId: z.string(),
  region: z.string().optional(),
  files: z.record(manifestEntry),
  previews: z.record(z.string(), z.record(preview)),
  pinnable: z.record(z.string().refine(isGeneratorKey), z.string()),
  results: resultsItem,
  startAt: z.number(),
  endAt: z.number()
})
