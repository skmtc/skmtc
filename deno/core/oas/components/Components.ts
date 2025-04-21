import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'

export const componentsKeys = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes'
]

export type ComponentsFields = {
  schemas?: Record<RefName, OasSchema | OasRef<'schema'>>
  responses?: Record<RefName, OasResponse | OasRef<'response'>>
  parameters?: Record<RefName, OasParameter | OasRef<'parameter'>>
  examples?: Record<RefName, OasExample | OasRef<'example'>>
  requestBodies?: Record<RefName, OasRequestBody | OasRef<'requestBody'>>
  headers?: Record<RefName, OasHeader | OasRef<'header'>>
  securitySchemes?: Record<string, OasSecurityScheme | OasRef<'securityScheme'>>
  extensionFields?: Record<string, unknown>
}

/** Container object for re-usable schema items within the API
 *
 * Fields not yet implemented: **securitySchemes**, **links**, **callbacks**
 */
export class OasComponents {
  /** Static identifier property for OasComponents */
  oasType = 'components' as const
  /** @internal */
  #fields: ComponentsFields

  constructor(fields: ComponentsFields = {}) {
    this.#fields = fields
  }

  toSchemasRefNames(): RefName[] {
    return Object.keys(this.#fields.schemas ?? {}) as RefName[]
  }

  /** Record holding re-usable {@link OasSchema} objects or Refs  */
  get schemas(): Record<RefName, OasSchema | OasRef<'schema'>> | undefined {
    return this.#fields.schemas
  }

  removeSchema(refName: RefName): OasSchema | OasRef<'schema'> {
    const { [refName]: removed, ...rest } = this.#fields.schemas!

    this.#fields.schemas = rest

    return removed
  }

  /** Record holding re-usable {@link OasResponse} objects or Refs  */
  get responses(): Record<RefName, OasResponse | OasRef<'response'>> | undefined {
    return this.#fields.responses
  }

  /** Record holding re-usable {@link OasParameter} objects or Refs  */
  get parameters(): Record<RefName, OasParameter | OasRef<'parameter'>> | undefined {
    return this.#fields.parameters
  }

  /** Record holding re-usable {@link OasExample} objects or Refs  */
  get examples(): Record<RefName, OasExample | OasRef<'example'>> | undefined {
    return this.#fields.examples
  }

  /** Record holding re-usable {@link OasRequestBody} objects or Refs  */
  get requestBodies(): Record<RefName, OasRequestBody | OasRef<'requestBody'>> | undefined {
    return this.#fields.requestBodies
  }

  /** Record holding re-usable {@link OasHeader} objects or Refs  */
  get headers(): Record<RefName, OasHeader | OasRef<'header'>> | undefined {
    return this.#fields.headers
  }

  /** Record holding re-usable {@link OasSecurityScheme} objects or Refs  */
  get securitySchemes(): Record<string, OasSecurityScheme | OasRef<'securityScheme'>> | undefined {
    return this.#fields.securitySchemes
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
