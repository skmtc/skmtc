import * as v from 'valibot'

/**
 * Union type for OpenAPI string format specifiers.
 * 
 * Represents the standard string formats defined in the OpenAPI v3 specification,
 * providing semantic meaning for string validation and processing. These formats
 * are used by generators to produce appropriate validation rules, UI components,
 * and type annotations in target languages.
 * 
 * ## Format Categories
 * 
 * **Date/Time Formats:**
 * - `date-time`: Full RFC3339 date-time (e.g., "2018-03-20T09:12:28Z")
 * - `time`: RFC3339 time only (e.g., "09:12:28")
 * - `date`: RFC3339 full-date (e.g., "2018-03-20")
 * - `duration`: RFC3339 duration (e.g., "P3Y6M4DT12H30M5S")
 * 
 * **Network Formats:**
 * - `email`: RFC5322 email address
 * - `hostname`: RFC1123 hostname
 * - `ipv4`: IPv4 address
 * - `ipv6`: IPv6 address
 * - `uri`: RFC3986 URI
 * - `uuid`: RFC4122 UUID
 * 
 * **Encoding/Pattern Formats:**
 * - `regex`: Regular expression pattern
 * - `password`: Password field hint for UI components
 * - `byte`: Base64 encoded data
 * - `binary`: Binary data
 * 
 * @example Using string formats in schema definitions
 * ```typescript
 * import type { StringFormat } from '@skmtc/core/oas/string';
 * 
 * const emailFormat: StringFormat = 'email';
 * const timestampFormat: StringFormat = 'date-time';
 * ```
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
 * This schema validates that string format values conform to the OpenAPI v3
 * specification's standard format identifiers. It includes date/time formats,
 * network address formats, and encoding formats that provide semantic meaning
 * for string validation and UI generation.
 * 
 * @example Validating string formats
 * ```typescript
 * import { stringFormat } from '@skmtc/core/oas/string';
 * import * as v from 'valibot';
 * 
 * const validFormat = v.parse(stringFormat, 'email'); // 'email'
 * const invalidFormat = v.parse(stringFormat, 'invalid'); // Throws ValiError
 * ```
 * 
 * @example Using in schema validation
 * ```typescript
 * const schema = {
 *   type: 'string',
 *   format: 'email',
 *   description: 'User email address'
 * };
 * 
 * // Validate the format field
 * if (schema.format) {
 *   const validatedFormat = v.parse(stringFormat, schema.format);
 *   console.log(`Valid format: ${validatedFormat}`);
 * }
 * ```
 */
export const stringFormat: v.GenericSchema<StringFormat> = v.enum({
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
 * This comprehensive schema validates OpenAPI string schemas according to the
 * OpenAPI v3 specification, including all standard properties like length
 * constraints, pattern validation, format specifiers, enumeration values,
 * and metadata fields. Used throughout the SKMTC pipeline for runtime
 * validation of string schema definitions.
 * 
 * @example Validating a basic string schema
 * ```typescript
 * import { oasStringData } from '@skmtc/core/oas/string';
 * import * as v from 'valibot';
 * 
 * const schema = {
 *   type: 'string',
 *   description: 'User name',
 *   minLength: 1,
 *   maxLength: 100,
 *   pattern: '^[a-zA-Z\\s]+$'
 * };
 * 
 * const validated = v.parse(oasStringData, schema);
 * console.log(validated.minLength); // 1
 * ```
 * 
 * @example Validating formatted strings
 * ```typescript
 * const emailSchema = {
 *   type: 'string',
 *   format: 'email',
 *   title: 'Email Address',
 *   example: 'user@example.com'
 * };
 * 
 * const result = v.parse(oasStringData, emailSchema);
 * console.log(result.format); // 'email'
 * ```
 * 
 * @example Validating enumerated strings
 * ```typescript
 * const statusSchema = {
 *   type: 'string',
 *   enum: ['pending', 'approved', 'rejected'],
 *   default: 'pending',
 *   description: 'Application status'
 * };
 * 
 * const validated = v.parse(oasStringData, statusSchema);
 * console.log(validated.enum); // ['pending', 'approved', 'rejected']
 * ```
 */
export const oasStringData: v.GenericSchema<OasStringData> = v.object({
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
 * Represents the complete structure of OpenAPI string schemas as processed by the
 * SKMTC pipeline. This type includes all standard OpenAPI string schema properties
 * including validation constraints (length, pattern), format specifiers, enumeration
 * values, and metadata fields. It's used throughout the string processing pipeline
 * for type-safe handling of string schema definitions.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Schema parsers to validate incoming string schema data
 * - String processors to transform OpenAPI schemas into OAS objects
 * - Code generators to access string constraints and generate validation code
 * - UI generators to create appropriate form controls based on formats and constraints
 * 
 * @example Basic string schema
 * ```typescript
 * import type { OasStringData } from '@skmtc/core/oas/string';
 * 
 * const nameSchema: OasStringData = {
 *   type: 'string',
 *   title: 'Full Name',
 *   description: 'User full name',
 *   minLength: 1,
 *   maxLength: 200,
 *   example: 'John Doe'
 * };
 * ```
 * 
 * @example Email string with format
 * ```typescript
 * const emailSchema: OasStringData = {
 *   type: 'string',
 *   format: 'email',
 *   title: 'Email Address',
 *   description: 'User email for notifications',
 *   example: 'john.doe@example.com'
 * };
 * ```
 * 
 * @example Enumerated string values
 * ```typescript
 * const roleSchema: OasStringData = {
 *   type: 'string',
 *   title: 'User Role',
 *   description: 'User access level',
 *   enum: ['admin', 'moderator', 'user', 'guest'],
 *   default: 'user'
 * };
 * ```
 * 
 * @example Pattern-constrained string
 * ```typescript
 * const phoneSchema: OasStringData = {
 *   type: 'string',
 *   title: 'Phone Number',
 *   description: 'US phone number',
 *   pattern: '^\\+?1?[2-9]\\d{9}$',
 *   example: '+1234567890',
 *   minLength: 10,
 *   maxLength: 15
 * };
 * ```
 * 
 * @example Nullable string with constraints
 * ```typescript
 * const commentSchema: OasStringData = {
 *   type: 'string',
 *   title: 'Comment',
 *   description: 'Optional user comment',
 *   maxLength: 500,
 *   nullable: true,
 *   default: null
 * };
 * ```
 */
export type OasStringData = {
  /** Human-readable title for the string schema */
  title?: string
  /** Detailed description explaining the string's purpose and usage */
  description?: string
  /** Default value used when no explicit value is provided */
  default?: string
  /** Type identifier (always 'string') */
  type: 'string'
  /** Maximum allowed length in characters */
  maxLength?: number
  /** Minimum required length in characters */
  minLength?: number
  /** Regular expression pattern for validation */
  pattern?: string
  /** Array of valid enumeration values */
  enum?: string[]
  /** Format specifier (email, date-time, uuid, etc.) */
  format?: string
  /** Whether null values are allowed in addition to string values */
  nullable?: boolean
  /** Example value for documentation and testing */
  example?: string
}
