import type { OasRefData } from './ref-types.ts'
import { toRefName } from '../../helpers/refFns.ts'
import { match } from 'npm:ts-pattern@5.7.1'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasDocument } from '../document/Document.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'

const MAX_LOOKUPS = 10

export type RefFields<T extends OasRefData['refType']> = {
  refType: T
  $ref: string
}

export class OasRef<T extends OasRefData['refType']> {
  oasType: 'ref' = 'ref'
  type: 'ref' = 'ref'
  #fields: RefFields<T>
  #oasDocument: OasDocument

  constructor(fields: RefFields<T>, oasDocument: OasDocument) {
    this.#fields = fields
    this.#oasDocument = oasDocument
  }

  isRef(): this is OasRef<T> {
    return true
  }

  resolve(lookupsPerformed: number = 0): ResolvedRef<T> {
    if (lookupsPerformed >= MAX_LOOKUPS) {
      throw new Error('Max lookups reached')
    }

    const resolved = this.resolveOnce()

    return resolved.isRef() ? resolved.resolve(lookupsPerformed + 1) : resolved
  }

  resolveOnce(): OasRef<T> | ResolvedRef<T> {
    const c = this.oasDocument.components

    const refName = toRefName(this.$ref)

    const refType: OasRefData['refType'] = this.refType

    const resolved = match(refType)
      .with('schema', () => c?.schemas?.[refName])
      .with('requestBody', () => c?.requestBodies?.[refName])
      .with('parameter', () => c?.parameters?.[refName])
      .with('response', () => c?.responses?.[refName])
      .with('example', () => c?.examples?.[refName])
      .with('header', () => c?.headers?.[refName])
      .with('securityScheme', () => c?.securitySchemes?.[refName])
      .exhaustive()

    if (!resolved) {
      throw new Error(`Ref "${this.#fields.$ref}" not found`)
    }

    if (resolved.isRef()) {
      if (resolved.refType !== this.refType) {
        throw new Error(
          `Ref type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.refType}"`
        )
      }
    } else {
      if (resolved.oasType !== this.refType) {
        throw new Error(
          `Type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.oasType}"`
        )
      }
    }

    return resolved as OasRef<T> | ResolvedRef<T>
  }

  toRefName(): RefName {
    return toRefName(this.#fields.$ref)
  }

  get $ref(): string {
    return this.#fields.$ref
  }

  get refType(): OasRefData['refType'] {
    return this.#fields.refType
  }

  get oasDocument(): OasDocument {
    return this.#oasDocument
  }

  toJsonSchema({
    resolve
  }: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T> {
    if (resolve) {
      const resolved = this.resolve().toJsonSchema({ resolve })

      return resolved as ResolvedRefJsonType<T>
    }

    const ref: OpenAPIV3.ReferenceObject = {
      $ref: `#/components/${match(this.refType)
        .with('schema', () => 'schemas')
        .with('requestBody', () => 'requestBodies')
        .with('parameter', () => 'parameters')
        .with('response', () => 'responses')
        .with('example', () => 'examples')
        .with('header', () => 'headers')
        .with('securityScheme', () => 'securitySchemes')
        .exhaustive()}/${this.toRefName()}`
    }

    return ref
  }

  toJSON() {
    return {
      $ref: `#/components/${match(this.refType)
        .with('schema', () => 'schemas')
        .with('requestBody', () => 'requestBodies')
        .with('parameter', () => 'parameters')
        .with('response', () => 'responses')
        .with('example', () => 'examples')
        .with('header', () => 'headers')
        .with('securityScheme', () => 'securitySchemes')
        .exhaustive()}/${this.toRefName()}`
    }
  }
}

type ResolvedRefJsonType<T extends OasRefData['refType']> = ReturnType<
  ResolvedRef<T>['toJsonSchema']
>

export type OasComponentType =
  | OasSchema
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader
  | OasSecurityScheme

export type ResolvedRef<T extends OasRefData['refType']> = Extract<OasComponentType, { oasType: T }>
