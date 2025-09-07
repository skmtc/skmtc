import { type OasHeaderData, oasHeaderData } from '../header/header-types.ts'
import { type OasMediaTypeData, oasMediaTypeData } from '../mediaType/mediaType-types.ts'
import { type OasHeaderRefData, oasHeaderRefData } from '../ref/ref-types.ts'
import * as v from 'valibot'

export type OasResponseData = {
  oasType: 'response'
  description: string
  headers?: Record<string, OasHeaderData | OasHeaderRefData>
  content?: Record<string, OasMediaTypeData>
  // links?: Record<string, Link | Ref>
}

export const oasResponseData: v.GenericSchema<OasResponseData> = v.object({
  oasType: v.literal('response'),
  description: v.string(),
  headers: v.optional(v.record(v.string(), v.union([oasHeaderData, oasHeaderRefData]))),
  content: v.optional(v.record(v.string(), oasMediaTypeData))
  // links: z.record(z.union([link, ref])).optional()
})
