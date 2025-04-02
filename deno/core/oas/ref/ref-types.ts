import { markdown } from '../markdown/markdown-types.ts'
import * as v from 'valibot'

export type OasSchemaRefData = {
  oasType: 'ref'
  refType: 'schema'
  $ref: string
  summary?: string
  description?: string
}

export const oasSchemaRefData: v.GenericSchema<OasSchemaRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('schema'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

export type OasResponseRefData = {
  oasType: 'ref'
  refType: 'response'
  $ref: string
  summary?: string
  description?: string
}

export const oasResponseRefData: v.GenericSchema<OasResponseRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('response'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

export type OasParameterRefData = {
  oasType: 'ref'
  refType: 'parameter'
  $ref: string
  summary?: string
  description?: string
}

export const oasParameterRefData: v.GenericSchema<OasParameterRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('parameter'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

export type OasExampleRefData = {
  oasType: 'ref'
  refType: 'example'
  $ref: string
  summary?: string
  description?: string
}

export const oasExampleRefData: v.GenericSchema<OasExampleRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('example'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

export type OasRequestBodyRefData = {
  oasType: 'ref'
  refType: 'requestBody'
  $ref: string
  summary?: string
  description?: string
}

export const oasRequestBodyRefData: v.GenericSchema<OasRequestBodyRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('requestBody'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})
export type OasHeaderRefData = {
  oasType: 'ref'
  refType: 'header'
  $ref: string
  summary?: string
  description?: string
}

export const oasHeaderRefData: v.GenericSchema<OasHeaderRefData> = v.object({
  oasType: v.literal('ref'),
  refType: v.literal('header'),
  $ref: v.string(),
  summary: v.optional(v.string()),
  description: v.optional(markdown)
})

// export const oasPathItemRefData = z.object({
//   oasType: z.literal('ref'),
//   refType: z.enum(['pathItem']),
//   $ref: z.string(),
//   summary: z.string().optional(),
//   description: markdown.optional()
// })

export type OasRefData =
  | OasSchemaRefData
  | OasResponseRefData
  | OasParameterRefData
  | OasExampleRefData
  | OasRequestBodyRefData
  | OasHeaderRefData
// OasPathItemRefData

export const oasRefData: v.GenericSchema<OasRefData> = v.union([
  oasSchemaRefData,
  oasResponseRefData,
  oasParameterRefData,
  oasExampleRefData,
  oasRequestBodyRefData,
  oasHeaderRefData
  // oasPathItemRefData
])
