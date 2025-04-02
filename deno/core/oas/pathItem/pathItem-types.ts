import { markdown } from '../markdown/markdown-types.ts'
import { type OasParameterData, oasParameterData } from '../parameter/parameter-types.ts'
import { type OasParameterRefData, oasParameterRefData } from '../ref/ref-types.ts'
import * as v from 'valibot'

export type OasPathItemData = {
  oasType: 'pathItem'
  $ref?: string
  summary?: string
  description?: string
  // servers?: OasServerData[]
  parameters?: (OasParameterData | OasParameterRefData)[]
}

export const oasPathItemData = v.object({
  oasType: v.literal('pathItem'),
  $ref: v.optional(v.string()),
  summary: v.optional(v.string()),
  description: v.optional(markdown),
  // servers: z.array(server).optional(),
  parameters: v.optional(v.array(v.union([oasParameterData, oasParameterRefData])))
})
