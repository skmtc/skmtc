import type { OasRefData } from './ref-types.js'
import { toRefName } from '../../helpers/refFns.js'
import { match } from 'ts-pattern'
import type { OasSchema } from '../schema/Schema.js'
import type { OasResponse } from '../response/Response.js'
import type { OasParameter } from '../parameter/Parameter.js'
import type { OasExample } from '../example/Example.js'
import type { OasRequestBody } from '../requestBody/RequestBody.js'
import type { OasHeader } from '../header/Header.js'
import type { OasDocument } from '../document/Document.js'
import type { RefName } from '../../types/RefName.js'

const MAX_LOOKUPS = 10

export type RefFields<T extends OasRefData['refType']> = {
  refType: T
  $ref: string
  summary?: string
  description?: string
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

  get summary(): string | undefined {
    return this.#fields.summary
  }

  get description(): string | undefined {
    return this.#fields.description
  }

  get oasDocument(): OasDocument {
    return this.#oasDocument
  }
}

export type OasComponentType =
  | OasSchema
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader

export type ResolvedRef<T extends OasRefData['refType']> = Extract<OasComponentType, { oasType: T }>
