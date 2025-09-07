import * as v from 'valibot'

/**
 * Union type for OpenAPI string format specifiers.
 * 
 * Represents the standard string formats defined in OpenAPI v3,
 * providing semantic meaning for string validation and processing.
 * Used for generating appropriate validation rules in target languages.
 */
export type StringFormat =
  | 'date-time'  // RFC3339 date-time
  | 'time'       // RFC3339 time
  | 'date'       // RFC3339 full-date
  | 'duration'   // RFC3339 duration
  | 'email'      // RFC5322 email address
  | 'hostname'   // RFC1123 hostname
  | 'ipv4'       // IPv4 address
  | 'ipv6'       // IPv6 address
  | 'uuid'       // RFC4122 UUID
  | 'uri'        // RFC3986 URI
  | 'regex'      // Regular expression
  | 'password'   // Password hint for UI
  | 'byte'       // Base64 encoded
  | 'binary'     // Binary data

/**
 * Valibot enum schema for valid OpenAPI string format values.
 * 
 * Defines the standard string formats supported by OpenAPI v3,
 * including date/time formats, network formats, and encoding formats.
 */
export const stringFormat = v.enum({
  'date-time': 'date-time',
  time: 'time',
  date: 'date',
  duration: 'duration',
  email: 'email',
  hostname: 'hostname',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  uuid: 'uuid',
  uri: 'uri',
  regex: 'regex',
  password: 'password',
  byte: 'byte',
  binary: 'binary'
})

/**
 * Valibot schema for validating OpenAPI string data objects.
 * 
 * Validates string schema objects including length constraints,
 * pattern validation, format specifiers, and enumeration values.
 */
export const oasStringData = v.object({
  type: v.literal('string'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.string()),
  maxLength: v.optional(v.number()),
  minLength: v.optional(v.number()),
  pattern: v.optional(v.string()),
  enum: v.optional(v.array(v.string())),
  format: v.optional(v.string()),
  nullable: v.optional(v.boolean()),
  example: v.optional(v.string())
})

/**
 * Data type for OpenAPI string schema objects.
 * 
 * Represents string schemas with validation constraints,
 * format specifiers, and metadata. Used throughout the
 * SKMTC pipeline for string type processing and code generation.
 */
export type OasStringData = {
  /** Human-readable title for the string */
  title?: string
  /** Detailed description of the string's purpose */
  description?: string
  /** Default value for the string */
  default?: string
  /** Type identifier (always 'string') */
  type: 'string'
  /** Maximum allowed length */
  maxLength?: number
  /** Minimum required length */
  minLength?: number
  /** Regular expression pattern for validation */
  pattern?: string
  /** Array of valid enumeration values */
  enum?: string[]
  /** Format specifier (date-time, email, etc.) */
  format?: string
  /** Whether null values are allowed */
  nullable?: boolean
  /** Example value for documentation */
  example?: string
}
