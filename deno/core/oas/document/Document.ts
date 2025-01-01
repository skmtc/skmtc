import type { OasTag } from '../tag/Tag.ts'
import type { OasComponents } from '../components/Components.ts'
import type { OasOperation } from '../operation/Operation.ts'
import type { OasInfo } from '../info/Info.ts'
import type { OasServer } from '../server/Server.ts'

export type DocumentFields = {
  openapi: string
  info: OasInfo
  servers?: OasServer[] | undefined
  operations: OasOperation[]
  components?: OasComponents | undefined
  tags?: OasTag[] | undefined
  extensionFields?: Record<string, unknown>
}

/** Top level document object describing the API */
export class OasDocument {
  /** Static identifier property for OasDocument */
  oasType: 'openapi' = 'openapi'
  /** @internal */
  #fields: DocumentFields | undefined

  constructor(fields?: DocumentFields) {
    this.#fields = fields
  }

  set fields(fields: DocumentFields) {
    this.#fields = fields
  }

  /** OpenAPI specification version */
  get openapi(): string {
    if (!this.#fields) {
      throw new Error(`Accessing 'openapi' before fields are set`)
    }

    return this.#fields.openapi
  }

  /** API metadata */
  get info(): OasInfo {
    if (!this.#fields) {
      throw new Error(`Accessing 'info' before fields are set`)
    }

    return this.#fields.info
  }

  /** List of all operations for the API */
  get operations(): OasOperation[] {
    if (!this.#fields) {
      throw new Error(`Accessing 'operations' before fields are set`)
    }

    return this.#fields.operations
  }

  /** Container object for re-usable schema items within the API */
  get components(): OasComponents | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'components' before fields are set`)
    }

    return this.#fields.components
  }

  /** List of tags used by API with additional metadata */
  get tags(): OasTag[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'tags' before fields are set`)
    }

    return this.#fields.tags
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'extensionFields' before fields are set`)
    }

    return this.#fields.extensionFields
  }
}
