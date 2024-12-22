import type { Method } from '../../types/Method.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameterLocation } from '../parameter/parameter-types.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import { OasObject } from '../object/Object.ts'

export type OperationFields = {
  path: string
  method: Method
  pathItem: OasPathItem
  operationId?: string | undefined
  summary?: string | undefined
  tags?: string[] | undefined
  description?: string | undefined
  parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined
  requestBody?: OasRequestBody | OasRef<'requestBody'> | undefined
  responses: Record<string, OasResponse | OasRef<'response'>>
  deprecated?: boolean | undefined
  extensionFields?: Record<string, unknown>
}

type ToRequestBodyMapArgs = {
  schema: OasSchema | OasRef<'schema'>
  requestBody: OasRequestBody
}

/** Operation represents a resource path and a method that can be enacted against it */
export class OasOperation {
  oasType: 'operation' = 'operation'

  path: string
  method: Method
  pathItem: OasPathItem
  operationId: string | undefined
  summary: string | undefined
  tags: string[] | undefined
  description: string | undefined
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  requestBody: OasRequestBody | OasRef<'requestBody'> | undefined
  responses: Record<string, OasResponse | OasRef<'response'>>
  deprecated: boolean | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: OperationFields) {
    this.path = fields.path
    this.method = fields.method
    this.pathItem = fields.pathItem
    this.operationId = fields.operationId
    this.summary = fields.summary
    this.tags = fields.tags
    this.description = fields.description
    this.parameters = fields.parameters
    this.requestBody = fields.requestBody
    this.responses = fields.responses
    this.deprecated = fields.deprecated
    this.extensionFields = fields.extensionFields
  }

  toSuccessResponse(): OasResponse | OasRef<'response'> {
    const { default: defaultResponse, ...httpCodeResponses } = this.responses

    const successCode = Object.keys(httpCodeResponses)
      .map(httpCode => parseInt(httpCode))
      .sort((a, b) => a - b)
      .find(httpCode => httpCode >= 200 && httpCode < 300)

    return successCode ? httpCodeResponses[successCode] : defaultResponse
  }

  toRequestBody<V>(
    map: ({ schema, requestBody }: ToRequestBodyMapArgs) => V,
    mediaType = 'application/json'
  ): V | undefined {
    const requestBody = this.requestBody?.resolve()
    const schema = requestBody?.content[mediaType]?.schema

    return schema ? map({ schema, requestBody }) : undefined
  }

  /**
   * Resolve all parameters and optionally filter by location
   *
   * @param filter - only include parameters from specified locations
   * @returns
   */
  toParams(filter?: OasParameterLocation[]): OasParameter[] {
    return (
      this.parameters
        ?.map(param => param.resolve())
        .filter(param =>
          filter?.length ? filter.includes(param.location) : true
        ) ?? []
    )
  }

  toParametersObject(filter?: OasParameterLocation[]) {
    const parameters = this.toParams(filter)

    return parameters.reduce<OasObject>((acc, parameter) => {
      return acc.addProperty({
        name: parameter.name,
        schema: parameter.toSchema(),
        required: parameter.required
      })
    }, OasObject.empty())
  }
}
