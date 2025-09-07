import * as v from 'valibot'

/**
 * Data type for OpenAPI contact information objects.
 * 
 * This type represents contact information as specified in the OpenAPI v3 specification's
 * Info Object. Contact information provides details about the person or organization
 * responsible for the API, including optional name, website URL, and email address.
 * 
 * The contact information is typically displayed in API documentation and used by
 * developers to reach out for support, questions, or feedback about the API.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Info processors to validate and structure contact information
 * - Documentation generators to display API maintainer information
 * - Client generators to embed support contact details in generated code
 * - Validation systems to ensure contact information completeness
 * 
 * @example Basic contact information
 * ```typescript
 * import type { OasContactData } from '@skmtc/core/oas/contact';
 * 
 * const apiContact: OasContactData = {
 *   oasType: 'contact',
 *   name: 'API Support Team',
 *   url: 'https://company.com/support',
 *   email: 'api-support@company.com'
 * };
 * ```
 * 
 * @example Minimal contact with only email
 * ```typescript
 * const minimalContact: OasContactData = {
 *   oasType: 'contact',
 *   email: 'support@api-company.com'
 * };
 * ```
 * 
 * @example Contact with name and URL
 * ```typescript
 * const teamContact: OasContactData = {
 *   oasType: 'contact',
 *   name: 'Development Team',
 *   url: 'https://github.com/company/api-repo'
 * };
 * ```
 * 
 * @example Integration in OpenAPI Info object
 * ```typescript
 * const apiInfo = {
 *   title: 'My API',
 *   version: '1.0.0',
 *   description: 'A comprehensive API for managing resources',
 *   contact: {
 *     oasType: 'contact',
 *     name: 'Jane Doe',
 *     url: 'https://janedoe.dev',
 *     email: 'jane@company.com'
 *   }
 * };
 * ```
 * 
 * @example Empty contact (valid but not recommended)
 * ```typescript
 * const emptyContact: OasContactData = {
 *   oasType: 'contact'
 *   // All fields are optional, but at least one should be provided
 * };
 * ```
 */
export type OasContactData = {
  /** Type identifier for SKMTC internal processing */
  oasType: 'contact'
  /** The identifying name of the contact person or organization */
  name?: string
  /** The URL pointing to the contact information (website, GitHub, etc.) */
  url?: string
  /** The email address of the contact person or organization */
  email?: string
}

/**
 * Valibot schema for validating OpenAPI contact data objects.
 * 
 * This schema validates OpenAPI contact information according to the OpenAPI v3
 * specification. All contact fields are optional, allowing for flexible contact
 * information configurations. The schema ensures proper string formatting for
 * name, URL, and email fields while maintaining the required `oasType` identifier.
 * 
 * Note that while all fields are optional according to the OpenAPI specification,
 * it's recommended to provide at least one contact method for practical API usage.
 * 
 * @example Validating complete contact information
 * ```typescript
 * import { oasContactData } from '@skmtc/core/oas/contact';
 * import * as v from 'valibot';
 * 
 * const contact = {
 *   oasType: 'contact',
 *   name: 'API Support',
 *   url: 'https://api.company.com/support',
 *   email: 'support@company.com'
 * };
 * 
 * const validated = v.parse(oasContactData, contact);
 * console.log(validated.name); // 'API Support'
 * console.log(validated.email); // 'support@company.com'
 * ```
 * 
 * @example Validating partial contact information
 * ```typescript
 * const partialContact = {
 *   oasType: 'contact',
 *   email: 'help@api.com'
 *   // name and url are optional and omitted
 * };
 * 
 * const result = v.parse(oasContactData, partialContact);
 * console.log(result.email); // 'help@api.com'
 * console.log(result.name); // undefined
 * console.log(result.url); // undefined
 * ```
 * 
 * @example Validation error handling
 * ```typescript
 * const invalidContact = {
 *   oasType: 'contact',
 *   name: 123, // Invalid: should be string
 *   email: 'valid@email.com'
 * };
 * 
 * try {
 *   v.parse(oasContactData, invalidContact);
 * } catch (error) {
 *   console.error('Contact validation failed:', error.message);
 *   // Handle validation errors appropriately
 * }
 * ```
 * 
 * @example Usage in OpenAPI document processing
 * ```typescript
 * function processApiInfo(infoObject: unknown) {
 *   // Validate the info object structure
 *   const info = parseInfoObject(infoObject);
 *   
 *   // If contact information exists, validate it
 *   if (info.contact) {
 *     const validatedContact = v.parse(oasContactData, {
 *       oasType: 'contact',
 *       ...info.contact
 *     });
 *     
 *     console.log(`API maintained by: ${validatedContact.name || 'Unknown'}`);
 *     console.log(`Support: ${validatedContact.email || 'No email provided'}`);
 *   }
 * }
 * ```
 * 
 * @example Integration with documentation generators
 * ```typescript
 * class DocumentationGenerator {
 *   generateContactSection(contactData: OasContactData): string {
 *     const validated = v.parse(oasContactData, contactData);
 *     
 *     let contactSection = '## Contact Information\n\n';
 *     
 *     if (validated.name) {
 *       contactSection += `**Maintainer:** ${validated.name}\n\n`;
 *     }
 *     
 *     if (validated.email) {
 *       contactSection += `**Email:** [${validated.email}](mailto:${validated.email})\n\n`;
 *     }
 *     
 *     if (validated.url) {
 *       contactSection += `**Website:** [${validated.url}](${validated.url})\n\n`;
 *     }
 *     
 *     return contactSection;
 *   }
 * }
 * ```
 */
export const oasContactData: v.GenericSchema<OasContactData> = v.object({
  oasType: v.literal('contact'),
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  email: v.optional(v.string())
})
