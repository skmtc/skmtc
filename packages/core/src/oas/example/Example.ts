import type { OasRef } from '../ref/Ref.js'
import type { ToJsonSchemaOptions } from '../schema/Schema.js'
import type { OpenAPIV3 } from 'openapi-types'

export type ExampleFields = {
  summary: string | undefined
  description: string | undefined
  value: unknown
  extensionFields?: Record<string, unknown>
}

/** Provides example data represented by schema */
export class OasExample {
  /** Static identifier property for OasExample */
  oasType: 'example' = 'example'
  /** @internal */
  #fields: ExampleFields

  constructor(fields: ExampleFields) {
    this.#fields = fields
  }

  /** Brief summary of example */
  get summary(): string | undefined {
    return this.#fields.summary
  }

  /** Detailed description of the example. May contain CommonMark Markdown */
  get description(): string | undefined {
    return this.#fields.description
  }

  /** Embedded example value */
  get value(): unknown {
    return this.#fields.value
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }

  /** Returns true if object is a reference */
  isRef(): this is OasRef<'example'> {
    return false
  }

  /** Returns itself */
  resolve(): OasExample {
    return this
  }

  resolveOnce(): OasExample {
    return this
  }

  toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ExampleObject {
    return {
      summary: this.summary,
      description: this.description,
      value: this.value
    }
  }
}
