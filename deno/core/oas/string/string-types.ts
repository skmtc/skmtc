import { z } from 'zod'

export const stringFormat = z.enum([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
  'uri',
  'regex',
  'password',
  'byte',
  'binary'
])

export const oasStringData: z.ZodType<OasStringData> = z
  .object({
    type: z.literal('string'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.string().optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).optional(),
    format: z.string().optional(),
    nullable: z.boolean().optional(),
    example: z.string().optional().catch(undefined) as z.ZodType<string | undefined>
  })
  .passthrough()

export type StringFormat =
  | 'date-time'
  | 'time'
  | 'date'
  | 'duration'
  | 'email'
  | 'hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uuid'
  | 'uri'
  | 'regex'
  | 'password'
  | 'byte'
  | 'binary'

export type OasStringData = {
  title?: string
  description?: string
  default?: string
  type: 'string'
  maxLength?: number
  minLength?: number
  pattern?: string
  enum?: string[]
  format?: string
  nullable?: boolean
  example?: string
}
