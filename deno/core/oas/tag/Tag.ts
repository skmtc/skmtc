export type TagFields = {
  name: string
  description: string | undefined
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

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
