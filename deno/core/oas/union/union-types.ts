import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'
import {
  type OasDiscriminatorData,
  oasDiscriminatorData
} from '../discriminator/discriminator-types.ts'

/**
 * Data type for OpenAPI union schema objects.
 * 
 * Represents union types (oneOf/anyOf) that allow values to match
 * one or more of several possible schemas. Includes support for
 * discriminator properties for efficient type resolution.
 */
export type OasUnionData = {
  /** Type category identifier for schema objects */
  oasType: 'schema'
  /** Type identifier (always 'union') */
  type: 'union'
  /** Human-readable title for the union */
  title?: string
  /** Detailed description of the union's purpose */
  description?: string
  /** Array of schemas that comprise the union */
  members: (OasSchemaData | OasSchemaRefData)[]
  /** Optional discriminator for efficient type resolution */
  discriminator?: OasDiscriminatorData
}

/**
 * Valibot schema for validating OpenAPI union data objects.
 * 
 * Validates union schemas including member schema arrays and optional
 * discriminator properties. Uses lazy evaluation to handle recursive
 * schema references in union members.
 */
export const oasUnionData: v.GenericSchema<OasUnionData> = v.object({
  oasType: v.literal('schema'),
  type: v.literal('union'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  members: v.lazy(() => v.array(v.union([oasSchemaData, oasSchemaRefData]))),
  discriminator: v.optional(oasDiscriminatorData)
})
