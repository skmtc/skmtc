import { markdown } from '../markdown/markdown-types.ts'
import { z } from 'npm:zod@3.24.1'

export type OasExampleData = {
  oasType: 'example'
  summary?: string
  description?: string
  value?: unknown
  // externalValue?: string
}

export const oasExampleData: z.ZodType<OasExampleData> = z.object({
  oasType: z.literal('example'),
  summary: z.string().optional(),
  description: markdown.optional(),
  value: z.unknown().optional()
  // externalValue: url.optional()
})
