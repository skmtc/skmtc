import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'

/**
 * Available component types in an OpenAPI document.
 */
export const componentsKeys = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes'
]

/**
 * Constructor fields for {@link OasComponents}.
 */
export type ComponentsFields = {
  /** Reusable schema components */
  schemas?: Record<RefName, OasSchema | OasRef<'schema'>>
  /** Reusable response components */
  responses?: Record<RefName, OasResponse | OasRef<'response'>>
  /** Reusable parameter components */
  parameters?: Record<RefName, OasParameter | OasRef<'parameter'>>
  /** Reusable example components */
  examples?: Record<RefName, OasExample | OasRef<'example'>>
  /** Reusable request body components */
  requestBodies?: Record<RefName, OasRequestBody | OasRef<'requestBody'>>
  /** Reusable header components */
  headers?: Record<RefName, OasHeader | OasRef<'header'>>
  /** Reusable security scheme components */
  securitySchemes?: Record<string, OasSecurityScheme | OasRef<'securityScheme'>>
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents the OpenAPI Components Object in the SKMTC OAS processing system.
 * 
 * The `OasComponents` class manages the reusable components section of an OpenAPI
 * document, providing centralized access to shared schemas, responses, parameters,
 * and other reusable elements that can be referenced throughout the API specification.
 * 
 * This class serves as the central registry for all reusable components, enabling
 * efficient reference resolution and reducing duplication in OpenAPI documents.
 * 
 * ## Key Features
 * 
 * - **Schema Management**: Central repository for reusable data schemas
 * - **Response Reuse**: Common response definitions for consistent API responses
 * - **Parameter Standardization**: Shared parameter definitions across operations
 * - **Reference Resolution**: Support for internal references ($ref) to components
 * - **Type Safety**: Strongly typed access to different component categories
 * - **Extension Support**: Custom OpenAPI extension field handling
 * 
 * @example Basic component access
 * ```typescript
 * import { OasComponents } from '@skmtc/core';
 * 
 * // Typically created during document parsing
 * const components = new OasComponents({
 *   schemas: {
 *     User: new OasObject({
 *       properties: {
 *         id: new OasString(),
 *         name: new OasString()
 *       }
 *     }),
 *     Product: new OasObject({
 *       properties: {
 *         id: new OasString(),
 *         price: new OasNumber()
 *       }
 *     })
 *   },
 *   responses: {
 *     NotFound: new OasResponse({
 *       description: '404 - Resource not found'
 *     })
 *   }
 * });
 * 
 * // Access schemas
 * const userSchema = components.schemas?.['User'];
 * const productSchema = components.schemas?.['Product'];
 * 
 * // Access responses
 * const notFoundResponse = components.responses?.['NotFound'];
 * ```
 * 
 * @example Schema management
 * ```typescript
 * // Get all schema reference names
 * const schemaNames = components.toSchemasRefNames();
 * console.log(schemaNames); // ['User', 'Product', 'Order']
 * 
 * // Remove a schema (useful for processing)
 * const removedSchema = components.removeSchema('ObsoleteSchema');
 * console.log('Removed:', removedSchema);
 * 
 * // Check remaining schemas
 * const remainingSchemas = components.toSchemasRefNames();
 * console.log('Remaining:', remainingSchemas);
 * ```
 * 
 * @example Parameter reuse
 * ```typescript
 * const components = new OasComponents({
 *   parameters: {
 *     PageSize: new OasParameter({
 *       name: 'pageSize',
 *       in: 'query',
 *       schema: new OasInteger({ minimum: 1, maximum: 100, default: 20 })
 *     }),
 *     PageNumber: new OasParameter({
 *       name: 'page',
 *       in: 'query',
 *       schema: new OasInteger({ minimum: 1, default: 1 })
 *     })
 *   }
 * });
 * 
 * // These parameters can be referenced in operations:
 * // $ref: '#/components/parameters/PageSize'
 * // $ref: '#/components/parameters/PageNumber'
 * ```
 * 
 * @example Response standardization
 * ```typescript
 * const components = new OasComponents({
 *   responses: {
 *     Success: new OasResponse({
 *       description: 'Successful operation',
 *       content: {
 *         'application/json': {
 *           schema: new OasObject({
 *             properties: {
 *               success: new OasBoolean({ default: true }),
 *               data: new OasObject({ additionalProperties: true })
 *             }
 *           })
 *         }
 *       }
 *     }),
 *     ValidationError: new OasResponse({
 *       description: 'Validation failed',
 *       content: {
 *         'application/json': {
 *           schema: new OasObject({
 *             properties: {
 *               error: new OasString(),
 *               details: new OasArray({
 *                 items: new OasString()
 *               })
 *             }
 *           })
 *         }
 *       }
 *     })
 *   }
 * });
 * 
 * // Standardized responses across all operations
 * ```
 * 
 * @example Processing components in generators
 * ```typescript
 * class ComponentProcessor {
 *   processDocument(document: OasDocument) {
 *     const components = document.components;
 *     if (!components) return;
 * 
 *     // Process all schemas
 *     if (components.schemas) {
 *       Object.entries(components.schemas).forEach(([name, schema]) => {
 *         if (schema.isRef()) {
 *           console.log(`Schema ${name} is a reference to ${schema.$ref}`);
 *         } else {
 *           console.log(`Schema ${name} is a direct definition`);
 *         }
 *       });
 *     }
 * 
 *     // Process parameters
 *     if (components.parameters) {
 *       Object.keys(components.parameters).forEach(paramName => {
 *         console.log(`Reusable parameter: ${paramName}`);
 *       });
 *     }
 *   }
 * }
 * ```
 */
export class OasComponents {
  /** Static identifier property for OasComponents */
  oasType = 'components' as const
  /** @internal */
  #fields: ComponentsFields

  /**
   * Creates a new OasComponents instance.
   * 
   * @param fields - Component definitions (defaults to empty object)
   * 
   * @example
   * ```typescript
   * const components = new OasComponents({
   *   schemas: {
   *     User: userSchema,
   *     Product: productSchema
   *   },
   *   responses: {
   *     NotFound: notFoundResponse
   *   }
   * });
   * ```
   */
  constructor(fields: ComponentsFields = {}) {
    this.#fields = fields
  }

  /**
   * Gets all schema reference names.
   * 
   * This method extracts the keys from the schemas object and returns them
   * as an array of RefName types. Useful for iterating over all available
   * schemas or checking schema availability.
   * 
   * @returns Array of reference names for all schemas
   * 
   * @example
   * ```typescript
   * const components = new OasComponents({
   *   schemas: {
   *     User: userSchema,
   *     Product: productSchema,
   *     Order: orderSchema
   *   }
   * });
   * 
   * const schemaNames = components.toSchemasRefNames();
   * console.log(schemaNames); // ['User', 'Product', 'Order']
   * 
   * // Use for processing
   * schemaNames.forEach(name => {
   *   const schema = components.schemas?.[name];
   *   console.log(`Processing schema: ${name}`);
   * });
   * ```
   */
  toSchemasRefNames(): RefName[] {
    return Object.keys(this.#fields.schemas ?? {}) as RefName[]
  }

  /** Record holding re-usable {@link OasSchema} objects or Refs  */
  get schemas(): Record<RefName, OasSchema | OasRef<'schema'>> | undefined {
    return this.#fields.schemas
  }

  /**
   * Removes a schema from the components and returns it.
   * 
   * This method permanently removes a schema from the components object
   * and returns the removed schema. This is useful during processing when
   * you need to extract and handle specific schemas separately.
   * 
   * @param refName - The reference name of the schema to remove
   * @returns The removed schema object or reference
   * 
   * @throws {Error} When the schema doesn't exist or schemas object is undefined
   * 
   * @example
   * ```typescript
   * const components = new OasComponents({
   *   schemas: {
   *     User: userSchema,
   *     Product: productSchema,
   *     Internal: internalSchema
   *   }
   * });
   * 
   * // Remove internal schema that shouldn't be exposed
   * const internalSchema = components.removeSchema('Internal');
   * console.log('Removed internal schema');
   * 
   * // Check remaining schemas
   * const remainingSchemas = components.toSchemasRefNames();
   * console.log(remainingSchemas); // ['User', 'Product']
   * 
   * // Process removed schema separately
   * if (!internalSchema.isRef()) {
   *   console.log('Processing internal schema privately');
   * }
   * ```
   */
  removeSchema(refName: RefName): OasSchema | OasRef<'schema'> {
    const { [refName]: removed, ...rest } = this.#fields.schemas!

    this.#fields.schemas = rest

    return removed
  }

  /** Record holding re-usable {@link OasResponse} objects or Refs  */
  get responses(): Record<RefName, OasResponse | OasRef<'response'>> | undefined {
    return this.#fields.responses
  }

  /** Record holding re-usable {@link OasParameter} objects or Refs  */
  get parameters(): Record<RefName, OasParameter | OasRef<'parameter'>> | undefined {
    return this.#fields.parameters
  }

  /** Record holding re-usable {@link OasExample} objects or Refs  */
  get examples(): Record<RefName, OasExample | OasRef<'example'>> | undefined {
    return this.#fields.examples
  }

  /** Record holding re-usable {@link OasRequestBody} objects or Refs  */
  get requestBodies(): Record<RefName, OasRequestBody | OasRef<'requestBody'>> | undefined {
    return this.#fields.requestBodies
  }

  /** Record holding re-usable {@link OasHeader} objects or Refs  */
  get headers(): Record<RefName, OasHeader | OasRef<'header'>> | undefined {
    return this.#fields.headers
  }

  /** Record holding re-usable {@link OasSecurityScheme} objects or Refs  */
  get securitySchemes(): Record<string, OasSecurityScheme | OasRef<'securityScheme'>> | undefined {
    return this.#fields.securitySchemes
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
  }
}
