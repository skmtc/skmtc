import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

export type OasExampleData = {
  oasType: 'example'
  summary?: string
  description?: string
  value?: unknown
  // externalValue?: string
}

export const oasExampleData = v.object({
  oasType: v.literal('example'),
  summary: v.optional(v.string()),
  description: v.optional(markdown),
  value: v.optional(v.unknown())
  // externalValue: url.optional()
})
