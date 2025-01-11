import { markdown } from '../markdown/markdown-types.ts'
import { z } from '@hono/zod-openapi'

export type OasTagData = {
  oasType: 'tag'
  name: string
  description?: string
}

export const oasTagData: z.ZodType<OasTagData> = z.object({
  oasType: z.literal('tag'),
  name: z.string(),
  description: markdown.optional()
  // externalDocs: externalDocs.optional()
})
