import type { OasTag } from '../tag/Tag.ts'
import type { OasComponents } from '../components/Components.ts'
import type { OasOperation } from '../operation/Operation.ts'
import type { OasInfo } from '../info/Info.ts'
import type { OasServer } from '../server/Server.ts'
import type { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
import type { StackTrail } from '../../context/StackTrail.ts'
import { match } from 'ts-pattern'
import type { RefName } from '../../types/RefName.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'

export type DocumentFields = {
  openapi: string
  info: OasInfo
  servers?: OasServer[] | undefined
  operations: OasOperation[]
  components?: OasComponents | undefined
  tags?: OasTag[] | undefined
  security?: OasSecurityRequirement[] | undefined
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

  removeItem(stackTrail: StackTrail): OasOperation | OasSchema | OasRef<'schema'> | undefined {
    const [first, second, third] = stackTrail.stackTrail

    return match(first)
      .with('paths', () => {
        const index = this.#fields!.operations.findIndex(
          ({ path, method }) => path === second && method === third
        )

        if (index === -1) {
          return undefined
        }

        const [removed] = this.#fields!.operations.splice(index, 1)

        return removed
      })
      .with('components', () => {
        if (typeof third !== 'string') {
          throw new Error(`RefName cannot be a number: ${third}`)
        }

        return this.#fields!.components!.removeSchema(third as RefName)
      })
      .otherwise(() => {
        throw new Error(`Unexpected stack trail: ${stackTrail}`)
      })
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

  get servers(): OasServer[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'servers' before fields are set`)
    }

    return this.#fields.servers
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

  /** List of security requirements for the API */
  get security(): OasSecurityRequirement[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'security' before fields are set`)
    }

    return this.#fields.security
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'extensionFields' before fields are set`)
    }

    return this.#fields.extensionFields
  }

  toJSON(): object {
    return {
      openapi: this.openapi,
      info: this.info,
      servers: this.servers,
      operations: this.operations,
      components: this.components,
      tags: this.tags,
      security: this.security,
      ...this.extensionFields
    }
  }
}
