import type { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'

export type TagFields = {
  name: string
  description: string | undefined
  externalDocs?: OasExternalDocs
  extensionFields?: Record<string, unknown>
}

export class OasTag {
  oasType: 'tag' = 'tag'
  #fields: TagFields

  constructor(fields: TagFields) {
    this.#fields = fields
  }

  get name(): string {
    return this.#fields.name
  }

  get description(): string | undefined {
    return this.#fields.description
  }

  get externalDocs(): OasExternalDocs | undefined {
    return this.#fields.externalDocs
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
