import { resultsItem, type ResultsItem } from './Results.ts'
import { preview, type Preview } from './Preview.ts'
import { serializedSchemaOption, type SerializedSchemaOption } from './SchemaOptions.ts'
import * as v from 'valibot'

export type ManifestEntry = {
  lines: number
  characters: number
  destinationPath: string
}

export const manifestEntry = v.object({
  lines: v.number(),
  characters: v.number(),
  destinationPath: v.string()
})

export type PreviewItem = {
  name: string
  exportPath: string
}

export const previewItem = v.object({
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
  results: ResultsItem
  startAt: number
  endAt: number
  schemaOptions: SerializedSchemaOption[]
}

export const manifestContent = v.object({
  deploymentId: v.string(),
  traceId: v.string(),
  spanId: v.string(),
  region: v.optional(v.string()),
  files: v.record(v.string(), manifestEntry),
  previews: v.record(v.string(), v.record(v.string(), preview)),
  results: resultsItem,
  startAt: v.number(),
  endAt: v.number(),
  schemaOptions: v.array(serializedSchemaOption)
})
