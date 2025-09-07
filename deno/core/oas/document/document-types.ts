import { type OasTagData, oasTagData } from '../tag/tag-types.ts'
import { type OasOperationData, oasOperationData } from '../operation/operation-types.ts'
import * as v from 'valibot'
import { type OasComponentsData, oasComponentsData } from '../components/components-types.ts'
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

export const oasDocumentData: v.GenericSchema<OasDocumentData> = v.object({
  oasType: v.literal('openapi'),
  openapi: v.string(),
  info: oasInfoData,
  jsonSchemaDialect: v.optional(v.string()),
  // servers: z.array(server).optional(),
  operations: v.array(oasOperationData),
  // webhooks: z.record(z.union([pathItem, ref])).optional(),
  components: v.optional(oasComponentsData),
  // security: z.never(),
  tags: v.optional(v.array(oasTagData))
  // externalDocs: externalDocs.optional()
})
