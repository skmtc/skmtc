import type { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'

export type TagFields = {
  name: string
  description: string | undefined
  /** Short summary of the tag (OpenAPI 3.2) */
  summary?: string
  /** Name of the tag this tag nests under (OpenAPI 3.2) */
  parent?: string
  /** Kind of tag, e.g. `nav`, `badge` or `audience` (OpenAPI 3.2, open registry) */
  kind?: string
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

  get summary(): string | undefined {
    return this.#fields.summary
  }

  get parent(): string | undefined {
    return this.#fields.parent
  }

  get kind(): string | undefined {
    return this.#fields.kind
  }

  get externalDocs(): OasExternalDocs | undefined {
    return this.#fields.externalDocs
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
