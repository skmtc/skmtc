import { z } from 'zod'
import { resultsItem, type ResultsItem } from './Results.ts'
import { preview, type Preview } from './Preview.ts'
import { serializedSchemaOption, type SerializedSchemaOption } from './SchemaOptions.ts'
export type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
}

export const manifestEntry = z.object({
  lines: z.number(),
  characters: z.number(),
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
  results: ResultsItem
  startAt: number
  endAt: number
  schemaOptions: SerializedSchemaOption[]
}

export const manifestContent = z.object({
  deploymentId: z.string(),
  traceId: z.string(),
  spanId: z.string(),
  region: z.string().optional(),
  files: z.record(manifestEntry),
  previews: z.record(z.record(preview)),
  results: resultsItem,
  startAt: z.number(),
  endAt: z.number(),
  schemaOptions: z.array(serializedSchemaOption)
})
