/**
 * Constructor fields for {@link OasContact}.
 * 
 * Defines the configuration options for creating contact information,
 * including name, URL, email, and extension fields.
 */
export type ContactFields = {
  name?: string
  url?: string
  email?: string
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Contact Object in the OpenAPI Specification.
 * 
 * The `OasContact` class encapsulates contact information for the API,
 * providing details about who to contact for support, questions, or issues.
 * This information is typically displayed in API documentation.
 * 
 * @example Basic contact information
 * ```typescript
 * import { OasContact } from '@skmtc/core';
 * 
 * const contact = new OasContact({
 *   name: 'API Support Team',
 *   email: 'support@example.com'
 * });
 * ```
 * 
 * @example Complete contact details
 * ```typescript
 * const fullContact = new OasContact({
 *   name: 'John Doe',
 *   url: 'https://example.com/contact',
 *   email: 'john@example.com'
 * });
 * ```
 */
export class OasContact {
  /** Type identifier for this OAS contact object */
  oasType = 'contact' as const

  /** The identifying name of the contact person/organization */
  name: string | undefined
  /** URL pointing to the contact information */
  url: string | undefined
  /** Email address of the contact person/organization */
  email: string | undefined
  /** Custom extension fields (x-* properties) for additional contact metadata */
  extensionFields: Record<string, unknown> | undefined

  /**
   * Creates a new OasContact instance.
   * 
   * @param fields - Contact information fields including name, URL, and email
   */
  constructor(fields: ContactFields = {}) {
    this.name = fields.name
    this.url = fields.url
    this.email = fields.email
    this.extensionFields = fields.extensionFields
  }
}
