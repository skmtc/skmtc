import { z } from 'zod'

export const oasIntegerData: z.ZodType<OasIntegerData> = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.number().int().optional(),
    format: z.union([z.literal('int32'), z.literal('int64')]).optional(),
    enum: z.array(z.number()).optional(),
    type: z.literal('integer'),
    nullable: z.boolean().optional(),
    example: z.number().int().optional().catch(undefined) as z.ZodType<number | undefined>
    // Add soon
    // multipleOf: z.number().optional(),
    // maximum: z.number().optional(),
    // exclusiveMaximum: z.boolean().optional(),
    // minimum: z.number().optional(),
    // exclusiveMinimum: z.boolean().optional()
  })
  .passthrough()

export type OasIntegerData = {
  title?: string
  description?: string
  default?: number
  format?: 'int32' | 'int64'
  enum?: number[]
  nullable?: boolean
  type: 'integer'
  example?: number
}
