import {
  type OasExampleData,
  oasExampleData
} from '../example/example-types.ts'
import { type OasHeaderData, oasHeaderData } from '../header/header-types.ts'
import {
  type OasParameterData,
  oasParameterData
} from '../parameter/parameter-types.ts'
import type {
  OasExampleRefData,
  OasHeaderRefData,
  OasParameterRefData,
  OasRequestBodyRefData,
  OasResponseRefData,
  OasSchemaRefData
} from '../ref/ref-types.ts'
import {
  oasExampleRefData,
  oasHeaderRefData,
  oasParameterRefData,
  oasRequestBodyRefData,
  oasResponseRefData,
  oasSchemaRefData
} from '../ref/ref-types.ts'
import {
  type OasRequestBodyData,
  oasRequestBodyData
} from '../requestBody/requestBody-types.ts'
import {
  type OasResponseData,
  oasResponseData
} from '../response/response-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { z } from 'npm:zod@3.24.1'

export type OasComponentsData = {
  oasType: 'components'
  schemas?: Record<string, OasSchemaData | OasSchemaRefData>
  responses?: Record<string, OasResponseData | OasResponseRefData>
  parameters?: Record<string, OasParameterData | OasParameterRefData>
  examples?: Record<string, OasExampleData | OasExampleRefData>
  requestBodies?: Record<string, OasRequestBodyData | OasRequestBodyRefData>
  headers?: Record<string, OasHeaderData | OasHeaderRefData>
}

export const oasComponentsData: z.ZodType<OasComponentsData> = z.object({
  oasType: z.literal('components'),
  schemas: z.record(z.union([oasSchemaData, oasSchemaRefData])).optional(),
  responses: z
    .record(z.union([oasResponseData, oasResponseRefData]))
    .optional(),
  parameters: z
    .record(z.union([oasParameterData, oasParameterRefData]))
    .optional(),
  examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional(),
  requestBodies: z
    .record(z.union([oasRequestBodyData, oasRequestBodyRefData]))
    .optional(),
  headers: z.record(z.union([oasHeaderData, oasHeaderRefData])).optional()
  // securitySchemes: z.record(z.union([securityScheme, ref])),
  // links: z.record(z.union([link, ref])),
  // callbacks: z.never(),
  // pathItems: z.record(z.union([oasPathItemData, oasPathItemRefData])).optional()
})
