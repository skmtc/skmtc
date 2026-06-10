import { markdown } from '../markdown/markdown-types.ts'
import { oasExternalDocsData, type OasExternalDocsData } from '../externalDocs/externalDocsTypes.ts'
import * as v from 'valibot'

export type OasTagData = {
  oasType: 'tag'
  name: string
  description?: string
  externalDocs?: OasExternalDocsData
}

export const oasTagData: v.GenericSchema<OasTagData> = v.object({
  oasType: v.literal('tag'),
  name: v.string(),
  description: v.optional(markdown),
  externalDocs: v.optional(oasExternalDocsData)
})
