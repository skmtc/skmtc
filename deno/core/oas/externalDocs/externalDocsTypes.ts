import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

export type OasExternalDocsData = {
  description?: string
  url: string
}

export const oasExternalDocsData: v.GenericSchema<OasExternalDocsData> = v.object({
  description: v.optional(markdown),
  url: v.string()
})
