import type { OasRef } from '../ref/Ref.ts'

/**
 * Constructor fields for {@link OasVoid}.
 */
export type VoidFields = {
  /** A short summary of the void schema */
  title?: string
  /** A description of what the void represents */
  description?: string
}

/**
 * Represents a void (empty) schema in the OpenAPI Specification.
 * 
 * The `OasVoid` class represents the absence of a value or content, commonly used
 * in scenarios where operations don't return any content (like HTTP 204 No Content
 * responses), optional properties that might not be present, or fallback cases
 * in schema processing where no specific type is defined.
 * 
 * This class serves as a type-safe representation of "nothing" in the OpenAPI
 * type system, enabling proper handling of void responses and empty schemas
 * throughout the SKMTC pipeline.
 * 
 * ## Key Features
 * 
 * - **Empty Content Representation**: Models operations that return no content
 * - **Type Safety**: Provides a concrete type for void/empty scenarios  
 * - **Schema Processing**: Handles missing or undefined schema definitions
 * - **Factory Pattern**: Convenient `empty()` static method for common usage
 * - **Pipeline Integration**: Works seamlessly with the SKMTC processing pipeline
 * 
 * @example Basic void schema for empty responses
 * ```typescript
 * import { OasVoid } from '@skmtc/core';
 * 
 * const emptyResponse = new OasVoid({
 *   title: 'No Content',
 *   description: 'Operation completed successfully with no response body'
 * });
 * 
 * // Used for HTTP 204 No Content responses
 * ```
 * 
 * @example Using the empty factory method
 * ```typescript
 * const voidSchema = OasVoid.empty();
 * 
 * // Equivalent to new OasVoid({})
 * // Commonly used as a fallback or placeholder
 * ```
 * 
 * @example In operation responses
 * ```typescript
 * const deleteOperation = new OasOperation({
 *   path: '/users/{id}',
 *   method: 'delete',
 *   responses: {
 *     '204': new OasResponse({
 *       description: 'User deleted successfully',
 *       content: {
 *         // No content for successful deletion
 *       }
 *     }),
 *     '404': new OasResponse({
 *       description: 'User not found'
 *     })
 *   }
 * });
 * 
 * // The void response indicates successful deletion with no return value
 * ```
 * 
 * @example As a schema fallback
 * ```typescript
 * function processSchema(schema: OasSchema | undefined): OasSchema {
 *   if (!schema) {
 *     return OasVoid.empty(); // Fallback for missing schemas
 *   }
 *   return schema;
 * }
 * 
 * // Ensures type safety even when schemas are missing
 * ```
 * 
 * @example In optional object properties
 * ```typescript
 * const userProfile = new OasObject({
 *   properties: {
 *     name: new OasString({ description: 'User name' }),
 *     avatar: new OasString({ 
 *       description: 'Avatar URL',
 *       nullable: true 
 *     }),
 *     // Some properties might be processed as void if not defined
 *     metadata: processOptionalSchema(rawSchema.metadata) // might return OasVoid
 *   }
 * });
 * ```
 * 
 * @example HTTP operations with void responses
 * ```typescript
 * // Common HTTP operations that return void/empty content:
 * 
 * // DELETE - Resource removal
 * const deleteResponse = new OasVoid({
 *   title: 'Deletion Successful',
 *   description: 'Resource was successfully deleted'
 * });
 * 
 * // PUT - Update with no response body
 * const updateResponse = new OasVoid({
 *   title: 'Update Successful', 
 *   description: 'Resource was successfully updated'
 * });
 * 
 * // POST - Action with no return value
 * const actionResponse = new OasVoid({
 *   title: 'Action Completed',
 *   description: 'Action was successfully performed'
 * });
 * ```
 * 
 * @example In code generation
 * ```typescript
 * class TypeScriptGenerator extends ModelBase {
 *   generateType(schema: OasSchema): string {
 *     if (schema.type === 'void') {
 *       return 'void'; // TypeScript void type
 *     }
 *     // Handle other types...
 *     return 'unknown';
 *   }
 * }
 * 
 * // Generates: 
 * // async function deleteUser(id: string): Promise<void>
 * ```
 */
export class OasVoid {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'void' useful for type narrowing and tagged unions.
   */
  type = 'void' as const
  /**
   * A short summary of the value.
   */
  title: string | undefined
  /**
   * A description of the value.
   */
  description: string | undefined

  constructor(fields: VoidFields = {}) {
    this.title = fields.title
    this.description = fields.description
  }

  static empty(): OasVoid {
    return new OasVoid()
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasVoid {
    return this
  }

  resolveOnce(): OasVoid {
    return this
  }
}
