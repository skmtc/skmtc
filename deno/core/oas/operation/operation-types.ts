import { markdown } from '../markdown/markdown-types.ts'
import { type OasParameterData, oasParameterData } from '../parameter/parameter-types.ts'
import { type OasPathItemData, oasPathItemData } from '../pathItem/pathItem-types.ts'
import {
  type OasParameterRefData,
  type OasRequestBodyRefData,
  type OasResponseRefData,
  oasParameterRefData,
  oasRequestBodyRefData,
  oasResponseRefData
} from '../ref/ref-types.ts'
import { type OasRequestBodyData, oasRequestBodyData } from '../requestBody/requestBody-types.ts'
import { type OasResponseData, oasResponseData } from '../response/response-types.ts'
import * as v from 'valibot'

export type OasOperationData = {
  oasType: 'operation'
  pathItem: OasPathItemData
  path: string
  method: 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'
  operationId?: string
  tags?: string[]
  summary?: string
  description?: string
  // externalDocs?: ExternalDocs
  // operationId?: string
  parameters?: (OasParameterData | OasParameterRefData)[]
  requestBody?: OasRequestBodyData | OasRequestBodyRefData
  responses: Record<string, OasResponseData | OasResponseRefData>
  // callbacks: never
  deprecated?: boolean
  // security: never
  // servers?: Server[]
}

export const oasOperationData: v.GenericSchema<OasOperationData> = v.object({
  oasType: v.literal('operation'),
  pathItem: oasPathItemData,
  path: v.string(),
  method: v.enum({
    get: 'get',
    put: 'put',
    post: 'post',
    delete: 'delete',
    options: 'options',
    head: 'head',
    patch: 'patch',
    trace: 'trace'
  }),
  operationId: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  summary: v.optional(v.string()),
  description: v.optional(markdown),
  // externalDocs: externalDocs.optional(),
  // operationId: z.string().optional(),
  parameters: v.optional(v.array(v.union([oasParameterData, oasParameterRefData]))),
  requestBody: v.optional(v.union([oasRequestBodyData, oasRequestBodyRefData])),
  responses: v.record(v.string(), v.union([oasResponseData, oasResponseRefData])),
  // callbacks: z.never(),
  deprecated: v.optional(v.boolean())
  // security: z.never(),
  // servers: z.array(server).optional()
})
