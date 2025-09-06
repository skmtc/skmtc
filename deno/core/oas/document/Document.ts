import type { OasTag } from '../tag/Tag.ts'
import type { OasComponents } from '../components/Components.ts'
import type { OasOperation } from '../operation/Operation.ts'
import type { OasInfo } from '../info/Info.ts'
import type { OasServer } from '../server/Server.ts'
import type { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
import type { StackTrail } from '../../context/StackTrail.ts'
import { match } from 'ts-pattern'
import type { RefName } from '../../types/RefName.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'

/**
 * Fields that define the structure of an OpenAPI v3 document.
 * 
 * This type represents the normalized structure of an OpenAPI document after
 * parsing, with operations flattened from the nested paths structure into
 * a simple array for easier processing.
 */
export type DocumentFields = {
  /** OpenAPI specification version (e.g., '3.0.0', '3.1.0') */
  openapi: string
  /** API metadata including title, version, description */
  info: OasInfo
  /** Array of server objects providing connectivity information */
  servers?: OasServer[] | undefined
  /** Flattened array of all operations from all paths */
  operations: OasOperation[]
  /** Container for reusable components (schemas, responses, etc.) */
  components?: OasComponents | undefined
  /** List of tags used by operations with additional metadata */
  tags?: OasTag[] | undefined
  /** Default security requirements that apply to all operations */
  security?: OasSecurityRequirement[] | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a complete OpenAPI v3 document in the SKMTC OAS processing system.
 * 
 * The `OasDocument` class is the root object in the OAS hierarchy, containing all
 * the information needed to describe a complete REST API. It provides normalized
 * access to document properties with built-in validation and error handling.
 * 
 * ## Key Features
 * 
 * - **Normalized Structure**: Operations are flattened from nested paths for easier processing
 * - **Lazy Initialization**: Fields are set after construction during parsing
 * - **Type Safety**: All properties are typed and validated on access
 * - **Extensibility**: Supports OpenAPI extension fields (x-* properties)
 * - **JSON Serialization**: Can be converted back to standard OpenAPI JSON format
 * 
 * @example Basic document access
 * ```typescript
 * import { OasDocument } from '@skmtc/core';
 * 
 * // Document is typically created during parsing
 * const document = new OasDocument();
 * document.fields = {
 *   openapi: '3.0.0',
 *   info: { title: 'My API', version: '1.0.0' },
 *   operations: [
 *     // ... parsed operations
 *   ],
 *   components: {
 *     schemas: {
 *       User: { type: 'object', properties: { id: { type: 'string' } } }
 *     }
 *   }
 * };
 * 
 * console.log(document.info.title); // 'My API'
 * console.log(document.operations.length); // Number of operations
 * ```
 * 
 * @example Iterating over operations
 * ```typescript
 * // Process all operations in the document
 * for (const operation of document.operations) {
 *   console.log(`${operation.method.toUpperCase()} ${operation.path}`);
 *   
 *   if (operation.operationId) {
 *     console.log(`Operation ID: ${operation.operationId}`);
 *   }
 * }
 * ```
 * 
 * @example Working with components
 * ```typescript
 * if (document.components?.schemas) {
 *   const userSchema = document.components.schemas.get('User');
 *   if (userSchema) {
 *     console.log('User schema found:', userSchema);
 *   }
 * }
 * ```
 */
export class OasDocument {
  /** Static identifier property for OasDocument */
  oasType: 'openapi' = 'openapi'
  
  /** @internal Private fields storage */
  #fields: DocumentFields | undefined

  /**
   * Creates a new OasDocument instance.
   * 
   * The document is typically created with undefined fields and populated
   * later during the parsing process. This allows for lazy initialization
   * and proper error handling during document processing.
   * 
   * @param fields - Optional document fields (usually set later during parsing)
   * 
   * @example
   * ```typescript
   * // Usually created without fields during parsing
   * const document = new OasDocument();
   * 
   * // Fields are set later by the parser
   * document.fields = parsedDocumentFields;
   * ```
   */
  constructor(fields?: DocumentFields) {
    this.#fields = fields
  }

  /**
   * Removes an item from the document based on a stack trail path.
   * 
   * This method is used internally during document processing to remove
   * specific operations or schema components. The stack trail indicates
   * the path to the item within the document structure.
   * 
   * @param stackTrail - Path to the item to remove
   * @returns The removed item, or undefined if not found
   * 
   * @internal This method is primarily used by the processing pipeline
   * 
   * @example
   * ```typescript
   * // Remove an operation at /users POST
   * const removed = document.removeItem(new StackTrail(['paths', '/users', 'post']));
   * 
   * // Remove a schema component
   * const removedSchema = document.removeItem(new StackTrail(['components', 'schemas', 'User']));
   * ```
   */
  removeItem(stackTrail: StackTrail): OasOperation | OasSchema | OasRef<'schema'> | undefined {
    const [first, second, third] = stackTrail.stackTrail

    return match(first)
      .with('paths', () => {
        const index = this.#fields!.operations.findIndex(
          ({ path, method }) => path === second && method === third
        )

        if (index === -1) {
          return undefined
        }

        const [removed] = this.#fields!.operations.splice(index, 1)

        return removed
      })
      .with('components', () => {
        if (typeof third !== 'string') {
          throw new Error(`RefName cannot be a number: ${third}`)
        }

        return this.#fields!.components!.removeSchema(third as RefName)
      })
      .otherwise(() => {
        throw new Error(`Unexpected stack trail: ${stackTrail}`)
      })
  }

  /**
   * Sets the document fields after parsing.
   * 
   * This setter is called by the parsing pipeline to populate the document
   * with parsed OpenAPI data. It enables lazy initialization and proper
   * error handling during document processing.
   * 
   * @param fields - The parsed document fields
   * 
   * @example
   * ```typescript
   * const document = new OasDocument();
   * document.fields = {
   *   openapi: '3.0.0',
   *   info: { title: 'API', version: '1.0' },
   *   operations: [],
   *   // ... other fields
   * };
   * ```
   */
  set fields(fields: DocumentFields) {
    this.#fields = fields
  }

  /** OpenAPI specification version */
  get openapi(): string {
    if (!this.#fields) {
      throw new Error(`Accessing 'openapi' before fields are set`)
    }

    return this.#fields.openapi
  }

  /** API metadata */
  get info(): OasInfo {
    if (!this.#fields) {
      throw new Error(`Accessing 'info' before fields are set`)
    }

    return this.#fields.info
  }

  get servers(): OasServer[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'servers' before fields are set`)
    }

    return this.#fields.servers
  }

  /** List of all operations for the API */
  get operations(): OasOperation[] {
    if (!this.#fields) {
      throw new Error(`Accessing 'operations' before fields are set`)
    }

    return this.#fields.operations
  }

  /** Container object for re-usable schema items within the API */
  get components(): OasComponents | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'components' before fields are set`)
    }

    return this.#fields.components
  }

  /** List of tags used by API with additional metadata */
  get tags(): OasTag[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'tags' before fields are set`)
    }

    return this.#fields.tags
  }

  /** List of security requirements for the API */
  get security(): OasSecurityRequirement[] | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'security' before fields are set`)
    }

    return this.#fields.security
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'extensionFields' before fields are set`)
    }

    return this.#fields.extensionFields
  }

  /**
   * Converts the document back to a JSON-serializable OpenAPI object.
   * 
   * This method serializes the document to a standard OpenAPI v3 format,
   * which can be used for output, validation, or further processing. The
   * resulting object follows the OpenAPI specification structure.
   * 
   * @returns A JSON-serializable object representing the OpenAPI document
   * 
   * @example
   * ```typescript
   * // Convert document back to standard OpenAPI format
   * const openApiJson = document.toJSON();
   * 
   * // Can be stringified for output
   * const yamlString = JSON.stringify(openApiJson, null, 2);
   * 
   * // Or used with OpenAPI tools
   * await validateOpenApiDocument(openApiJson);
   * ```
   */
  toJSON(): object {
    return {
      openapi: this.openapi,
      info: this.info,
      servers: this.servers,
      operations: this.operations,
      components: this.components,
      tags: this.tags,
      security: this.security,
      ...this.extensionFields
    }
  }
}
