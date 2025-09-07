import type { OasContact } from '../contact/Contact.ts'
import type { OasLicense } from '../license/License.ts'

/**
 * Constructor fields for {@link OasInfo}.
 */
export type InfoFields = {
  /** The title of the API */
  title: string
  /** The version of the OpenAPI document */
  version: string
  /** A description of the API */
  description?: string | undefined
  /** A URL to the Terms of Service for the API */
  termsOfService?: string | undefined
  /** The contact information for the exposed API */
  contact?: OasContact | undefined
  /** The license information for the exposed API */
  license?: OasLicense | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents an Info Object in the OpenAPI Specification.
 * 
 * The `OasInfo` class encapsulates metadata about the API including its title,
 * version, description, and contact information. This information is displayed
 * in API documentation and helps developers understand what the API does and
 * how to use it effectively.
 * 
 * This class provides essential API metadata that appears at the top level
 * of OpenAPI documents and drives documentation generation and tooling.
 * 
 * ## Key Features
 * 
 * - **API Identification**: Title and version information for API tracking
 * - **Documentation**: Rich description support for API overview
 * - **Contact Information**: Developer contact details and support resources
 * - **Legal Information**: License and terms of service references
 * - **Extension Support**: Custom fields for additional metadata
 * 
 * @example Basic API information
 * ```typescript
 * import { OasInfo } from '@skmtc/core';
 * 
 * const apiInfo = new OasInfo({
 *   title: 'Pet Store API',
 *   version: '1.0.0',
 *   description: 'A sample API that uses a petstore as an example'
 * });
 * ```
 * 
 * @example Complete API metadata
 * ```typescript
 * const fullApiInfo = new OasInfo({
 *   title: 'E-Commerce Platform API',
 *   version: '2.1.0',
 *   description: 'Comprehensive e-commerce API for managing products, orders, and customers',
 *   termsOfService: 'https://api.example.com/terms',
 *   contact: new OasContact({
 *     name: 'API Support Team',
 *     url: 'https://api.example.com/support',
 *     email: 'api-support@example.com'
 *   }),
 *   license: new OasLicense({
 *     name: 'MIT',
 *     url: 'https://opensource.org/licenses/MIT'
 *   })
 * });
 * ```
 * 
 * @example Versioned API with semantic versioning
 * ```typescript
 * const versionedInfo = new OasInfo({
 *   title: 'User Management Service',
 *   version: '3.2.1',
 *   description: 'RESTful API for user authentication and profile management',
 *   contact: new OasContact({
 *     name: 'Development Team',
 *     email: 'dev@company.com'
 *   })
 * });
 * ```
 */
export class OasInfo {
  /** Type identifier for this OAS info object */
  oasType: 'info' = 'info'
  /** Private storage for all info fields */
  #fields: InfoFields

  /**
   * Creates a new OasInfo instance.
   * 
   * @param fields - API information fields including title, version, description, and contact details
   */
  constructor(fields: InfoFields) {
    this.#fields = fields
  }

  /**
   * Gets the API title.
   * 
   * @returns The title of the API
   */
  get title(): string {
    return this.#fields.title
  }

  /**
   * Gets the API description.
   * 
   * @returns Optional detailed description of the API's purpose and functionality
   */
  get description(): string | undefined {
    return this.#fields.description
  }

  /**
   * Gets the terms of service URL.
   * 
   * @returns Optional URL pointing to the API's terms of service
   */
  get termsOfService(): string | undefined {
    return this.#fields.termsOfService
  }

  /**
   * Gets the contact information.
   * 
   * @returns Optional contact information for API support and inquiries
   */
  get contact(): OasContact | undefined {
    return this.#fields.contact
  }

  /**
   * Gets the license information.
   * 
   * @returns Optional license information governing API usage
   */
  get license(): OasLicense | undefined {
    return this.#fields.license
  }

  /**
   * Gets the API version.
   * 
   * @returns The version string of the API (e.g., '1.0.0', '2.1.3')
   */
  get version(): string {
    return this.#fields.version
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
