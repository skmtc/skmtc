import { type OasExampleData, oasExampleData } from '../example/example-types.ts'
import { type OasHeaderData, oasHeaderData } from '../header/header-types.ts'
import { type OasParameterData, oasParameterData } from '../parameter/parameter-types.ts'
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
import { type OasRequestBodyData, oasRequestBodyData } from '../requestBody/requestBody-types.ts'
import { type OasResponseData, oasResponseData } from '../response/response-types.ts'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import * as v from 'valibot'

export type OasComponentsData = {
  oasType: 'components'
  schemas?: Record<string, OasSchemaData | OasSchemaRefData>
  responses?: Record<string, OasResponseData | OasResponseRefData>
  parameters?: Record<string, OasParameterData | OasParameterRefData>
  examples?: Record<string, OasExampleData | OasExampleRefData>
  requestBodies?: Record<string, OasRequestBodyData | OasRequestBodyRefData>
  headers?: Record<string, OasHeaderData | OasHeaderRefData>
}

export const oasComponentsData = v.object({
  oasType: v.literal('components'),
  schemas: v.optional(v.record(v.string(), v.union([oasSchemaData, oasSchemaRefData]))),
  responses: v.optional(v.record(v.string(), v.union([oasResponseData, oasResponseRefData]))),
  parameters: v.optional(v.record(v.string(), v.union([oasParameterData, oasParameterRefData]))),
  examples: v.optional(v.record(v.string(), v.union([oasExampleData, oasExampleRefData]))),
  requestBodies: v.optional(
    v.record(v.string(), v.union([oasRequestBodyData, oasRequestBodyRefData]))
  ),
  headers: v.optional(v.record(v.string(), v.union([oasHeaderData, oasHeaderRefData])))
  // securitySchemes: z.record(z.union([securityScheme, ref])),
  // links: z.record(z.union([link, ref])),
  // callbacks: z.never(),
  // pathItems: z.record(z.union([oasPathItemData, oasPathItemRefData])).optional()
})
