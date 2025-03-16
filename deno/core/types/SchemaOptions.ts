import { z } from '@hono/zod-openapi'
import type { OasSchema } from '../oas/schema/Schema.ts'

export type SchemaOption = {
  type: 'input' | 'formatter'
  value: string
  matchBy: {
    schema: OasSchema
    name?: string
  }
}

export const schemaOption = z.object({
  type: z.enum(['input', 'formatter']),
  value: z.string(),
  matchBy: z.object({
    schema: z.record(z.unknown()),
    name: z.string().optional()
  })
})
