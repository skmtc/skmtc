export type EnrichmentRequest = {
  prompt: string
  responseSchema: EnrichmentResponseSchema
  content: string
}

/**
 * Contains the list of OpenAPI data types
 * as defined by https://swagger.io/docs/specification/data-models/data-types/
 * @public
 */
export declare enum EnrichmentResponseSchemaType {
  /** String type. */
  STRING = 'string',
  /** Number type. */
  NUMBER = 'number',
  /** Integer type. */
  INTEGER = 'integer',
  /** Boolean type. */
  BOOLEAN = 'boolean',
  /** Array type. */
  ARRAY = 'array',
  /** Object type. */
  OBJECT = 'object'
}

/**
 * Schema is used to define the format of input/output data.
 * Represents a select subset of an OpenAPI 3.0 schema object.
 * More fields may be added in the future as needed.
 * @public
 */
export declare interface EnrichmentResponseSchema {
  /**
   * Optional. The type of the property. {@link
   * SchemaType}.
   */
  type?: EnrichmentResponseSchemaType
  /** Optional. The format of the property. */
  format?: string
  /** Optional. The description of the property. */
  description?: string
  /** Optional. Whether the property is nullable. */
  nullable?: boolean
  /** Optional. The items of the property. */
  items?: EnrichmentResponseSchema
  /** Optional. The enum of the property. */
  enum?: string[]
  /** Optional. Map of {@link Schema}. */
  properties?: {
    [k: string]: EnrichmentResponseSchema
  }
  /** Optional. Array of required property. */
  required?: string[]
  /** Optional. The example of the property. */
  example?: unknown
}
