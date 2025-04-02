import * as v from 'valibot'

export const stringFormat = v.enum({
  'date-time': 'date-time',
  time: 'time',
  date: 'date',
  duration: 'duration',
  email: 'email',
  hostname: 'hostname',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  uuid: 'uuid',
  uri: 'uri',
  regex: 'regex',
  password: 'password',
  byte: 'byte',
  binary: 'binary'
})

export const oasStringData = v.object({
  type: v.literal('string'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.string()),
  maxLength: v.optional(v.number()),
  minLength: v.optional(v.number()),
  pattern: v.optional(v.string()),
  enum: v.optional(v.array(v.string())),
  format: v.optional(v.string()),
  nullable: v.optional(v.boolean()),
  example: v.optional(v.string())
})

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
