import * as v from 'valibot'

/**
 * Data type for OpenAPI discriminator objects.
 * 
 * Discriminators are used with union types (oneOf/anyOf) to provide
 * hints about which schema variant to use based on a property value.
 * This enables more efficient type resolution and better tooling support.
 */
export type OasDiscriminatorData = {
  /** Type category identifier for discriminator objects */
  oasType: 'discriminator'
  /** Name of the property that contains the discriminator value */
  propertyName: string
  /** Optional mapping from property values to schema names */
  mapping?: Record<string, string>
}

/**
 * Valibot schema for validating OpenAPI discriminator data objects.
 * 
 * Validates discriminator objects including the required property name
 * and optional value-to-schema mappings. Used to ensure discriminator
 * objects conform to OpenAPI specification requirements.
 */
export const oasDiscriminatorData = v.object({
  oasType: v.literal('discriminator'),
  propertyName: v.string(),
  mapping: v.optional(v.record(v.string(), v.string()))
})
