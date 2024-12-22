import { type OasHeaderData, oasHeaderData } from '../header/header-types.ts'
import {
  type OasMediaTypeData,
  oasMediaTypeData
} from '../mediaType/mediaType-types.ts'
import { type OasHeaderRefData, oasHeaderRefData } from '../ref/ref-types.ts'
import { z } from 'npm:zod@3.23.4'

export type OasResponseData = {
  oasType: 'response'
  description: string
  headers?: Record<string, OasHeaderData | OasHeaderRefData>
  content?: Record<string, OasMediaTypeData>
  // links?: Record<string, Link | Ref>
}

export const oasResponseData: z.ZodType<OasResponseData> = z.object({
  oasType: z.literal('response'),
  description: z.string(),
  headers: z.record(z.union([oasHeaderData, oasHeaderRefData])).optional(),
  content: z.record(oasMediaTypeData).optional()
  // links: z.record(z.union([link, ref])).optional()
})
