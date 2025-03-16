import { z } from '@hono/zod-openapi'
import type { OasSchema } from '../oas/schema/Schema.ts'

export type SchemaOption = {
  type: 'input' | 'formatter'
  name: string
  matchBy: {
    schema: OasSchema
    name?: string
  }
  exportPath: string
}

export const schemaOption = z.object({
  type: z.enum(['input', 'formatter']),
  name: z.string(),
  matchBy: z.object({
    schema: z.record(z.unknown()),
    name: z.string().optional()
  }),
  exportPath: z.string()
})

export const serializedSchema: z.ZodType<SerializedSchema> = z.union([
  z.object({
    type: z.literal('object'),
    properties: z.lazy(() => z.record(serializedSchema)).optional()
  }),
  z.object({
    type: z.literal('string')
  }),
  z.object({
    type: z.literal('number')
  }),
  z.object({
    type: z.literal('boolean')
  }),
  z.object({
    type: z.literal('array'),
    items: z.lazy(() => serializedSchema)
  }),
  z.object({
    type: z.literal('integer')
  }),
  z.object({
    type: z.literal('integer')
  })
])

export type SerializedSchema =
  | {
      type: 'object'
      properties?: Record<string, SerializedSchema>
    }
  | {
      type: 'string'
    }
  | {
      type: 'number'
    }
  | {
      type: 'boolean'
    }
  | {
      type: 'array'
      items: SerializedSchema
    }
  | {
      type: 'integer'
    }
  | {
      type: 'boolean'
    }

export const serializedSchemaOption = z.object({
  type: z.enum(['input', 'formatter']),
  name: z.string(),
  exportPath: z.string(),
  matchBy: z.object({
    schema: serializedSchema,
    name: z.string().optional()
  })
})

export type SerializedSchemaOption = {
  type: 'input' | 'formatter'
  name: string
  exportPath: string
  matchBy: {
    schema: SerializedSchema
    name?: string
  }
}
