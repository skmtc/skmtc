import { type OasTagData, oasTagData } from '../tag/tag-types.ts'
import {
  type OasOperationData,
  oasOperationData
} from '../operation/operation-types.ts'
import { z } from 'npm:zod@3.23.4'
import {
  type OasComponentsData,
  oasComponentsData
} from '../components/components-types.ts'
import { type OasInfoData, oasInfoData } from '../info/info-types.ts'

export type OasDocumentData = {
  oasType: 'openapi'
  openapi: string
  info: OasInfoData
  jsonSchemaDialect?: string
  // servers?: OasServerData[]
  operations: OasOperationData[]
  // webhooks?: Record<string, OasPathItemData | OasPathItemRefData>
  components?: OasComponentsData
  // security: never
  tags?: OasTagData[]
}

export const oasDocumentData: z.ZodType<OasDocumentData> = z.object({
  oasType: z.literal('openapi'),
  openapi: z.string(),
  info: oasInfoData,
  jsonSchemaDialect: z.string().optional(),
  // servers: z.array(server).optional(),
  operations: z.array(oasOperationData),
  // webhooks: z.record(z.union([pathItem, ref])).optional(),
  components: oasComponentsData.optional(),
  // security: z.never(),
  tags: z.array(oasTagData).optional()
  // externalDocs: externalDocs.optional()
})
