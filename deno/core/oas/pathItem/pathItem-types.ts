import { markdown } from '../markdown/markdown-types.ts'
import {
  type OasParameterData,
  oasParameterData
} from '../parameter/parameter-types.ts'
import {
  type OasParameterRefData,
  oasParameterRefData
} from '../ref/ref-types.ts'
import { z } from 'npm:zod@3.23.4'

export type OasPathItemData = {
  oasType: 'pathItem'
  $ref?: string
  summary?: string
  description?: string
  // servers?: OasServerData[]
  parameters?: (OasParameterData | OasParameterRefData)[]
}

export const oasPathItemData: z.ZodType<OasPathItemData> = z.object({
  oasType: z.literal('pathItem'),
  $ref: z.string().optional(),
  summary: z.string().optional(),
  description: markdown.optional(),
  // servers: z.array(server).optional(),
  parameters: z
    .array(z.union([oasParameterData, oasParameterRefData]))
    .optional()
})
