import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasExample}.
 */
export type ExampleFields = {
  /** Short summary of the example */
  summary?: string
  /** Longer description of the example */
  description?: string
  /** The example value */
  value: unknown
  /** The external value of the example */
  externalValue?: string
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

export class OasExample {
  /** Static identifier property for OasExample */
  oasType: 'example' = 'example'
  /** @internal */
  summary?: string
  description?: string
  value?: unknown
  externalValue?: string
  extensionFields?: Record<string, unknown>

  constructor(fields: ExampleFields) {
    this.summary = fields.summary
    this.description = fields.description
    this.value = fields.value
    this.externalValue = fields.externalValue
    this.extensionFields = fields.extensionFields
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
