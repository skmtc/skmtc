import type { OasMediaType } from '../mediaType/MediaType.js'
import type { OasRef } from '../ref/Ref.js'
import type { OasExample } from '../example/Example.js'
import type { OasSchema } from '../schema/Schema.js'

export type HeaderFields = {
  description: string | undefined
  required: boolean | undefined
  deprecated: boolean | undefined
  schema: OasSchema | OasRef<'schema'> | undefined
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  content: Record<string, OasMediaType> | undefined
  extensionFields?: Record<string, unknown>
}

/** Describes a single header in the API */
export class OasHeader {
  oasType: 'header' = 'header'
  #fields: HeaderFields

  constructor(fields: HeaderFields) {
    this.#fields = fields
  }

  /** Brief description of header */
  get description(): string | undefined {
    return this.#fields.description
  }

  /** Indicates if header is mandatory. Default value is `false` */
  get required(): boolean | undefined {
    return this.#fields.required
  }

  /** Indicates if header is deprecated and should no longer be used. Default value is false */
  get deprecated(): boolean | undefined {
    return this.#fields.deprecated
  }

  /** Schema for the header */
  get schema(): OasSchema | OasRef<'schema'> | undefined {
    return this.#fields.schema
  }

  /** Examples of the header */
  get examples(): Record<string, OasExample | OasRef<'example'>> | undefined {
    return this.#fields.examples
  }

  /** Content of the header */
  get content(): Record<string, OasMediaType> | undefined {
    return this.#fields.content
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }

  /** Returns true if object is a reference */
  isRef(): this is OasRef<'header'> {
    return false
  }

  /** Returns itself */
  resolve(): OasHeader {
    return this
  }

  resolveOnce(): OasHeader {
    return this
  }

  /** Returns schema for the header. Either, `schema` property if
   * definedor value matching `mediaType` from `content` property.
   *
   * @param mediaType - Optional media type to get schema for. Defaults to `application/json`
   */
  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> {
    if (this.schema) {
      return this.schema
    }

    const schema = this.#fields.content?.[mediaType]?.schema

    if (!schema) {
      throw new Error(`Schema not found for media type ${mediaType}`)
    }

    return schema
  }
}
