import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

export type OasTagData = {
  oasType: 'tag'
  name: string
  description?: string
}

export const oasTagData = v.object({
  oasType: v.literal('tag'),
  name: v.string(),
  description: v.optional(markdown)
  // externalDocs: externalDocs.optional()
})
