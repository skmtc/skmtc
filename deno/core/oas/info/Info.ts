import type { OasContact } from '../contact/Contact.ts'
import type { OasLicense } from '../license/License.ts'

export type InfoFields = {
  title: string
  version: string
  description?: string | undefined
  termsOfService?: string | undefined
  contact?: OasContact | undefined
  license?: OasLicense | undefined
  extensionFields?: Record<string, unknown>
}

export class OasInfo {
  oasType: 'info' = 'info'
  #fields: InfoFields

  constructor(fields: InfoFields) {
    this.#fields = fields
  }

  get title(): string {
    return this.#fields.title
  }

  get description(): string | undefined {
    return this.#fields.description
  }

  get termsOfService(): string | undefined {
    return this.#fields.termsOfService
  }

  get contact(): OasContact | undefined {
    return this.#fields.contact
  }

  get license(): OasLicense | undefined {
    return this.#fields.license
  }

  get version(): string {
    return this.#fields.version
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
