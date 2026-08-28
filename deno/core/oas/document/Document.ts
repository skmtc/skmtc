import type { OasTag } from '@/oas/tag/Tag.ts'
import type { OasComponents } from '@/oas/components/Components.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { OasInfo } from '@/oas/info/Info.ts'
import type { OasServer } from '@/oas/server/Server.ts'
import type { OasSecurityRequirement } from '@/oas/securityRequirement/SecurityRequirement.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasExternalDocs } from '@/oas/externalDocs/ExternalDocs.ts'

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
  /**
   * Flattened array of all 3.1 webhooks. Kept SEPARATE from `operations`
   * so existing client/SDK generators (which iterate `operations`) never
   * receive a webhook — webhook semantics are inverted (handler/receiver,
   * not client call).
   *
   * Optional in the type (the `webhooks` getter defaults to `[]` when
   * unset): most construction sites — 3.0 documents, GQL, test fixtures —
   * have none, and the OAS parser (`toDocumentFieldsV3`) always sets it.
   */
  webhooks?: OasWebhook[]
  /** Container for reusable components (schemas, responses, etc.) */
  components?: OasComponents | undefined
  /** List of tags used by operations with additional metadata */
  tags?: OasTag[] | undefined
  /** Default security requirements that apply to all operations */
  security?: OasSecurityRequirement[] | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** External documentation for the API */
  externalDocs?: OasExternalDocs | undefined
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
 * - **Lazy Initialization**: Fields are set after construction during parsing — see
 *   "Why empty-at-construction" below for the architectural reason.
 * - **Type Safety**: All properties are typed and validated on access
 * - **Extensibility**: Supports OpenAPI extension fields (x-* properties)
 * - **JSON Serialization**: Can be converted back to standard OpenAPI JSON format
 *
 * ## Why empty-at-construction (forward-declared refs)
 *
 * `OasDocument` is intentionally constructable without fields, with
 * `oasDocument.fields = ...` assigned later by the parser. This is not a
 * convenience for tests — it's load-bearing for ref resolution.
 *
 * `OasRef` resolves through an `OasDocument` instance (by reaching into its
 * `components.schemas` etc.). During parsing, refs are encountered *before*
 * the targets they point at have been parsed:
 *
 *   1. The parser walks `paths./users.get.responses.200.content...schema` and
 *      sees `$ref: '#/components/schemas/User'`.
 *   2. It constructs an `OasRef` that resolves through the in-flight
 *      `oasDocument` — but at this moment `oasDocument.components.schemas`
 *      hasn't been populated yet (components are parsed in a later pass, or
 *      the same pass at a different node).
 *   3. The ref must still be constructable now; resolution can wait.
 *
 * By creating an empty `OasDocument` in `ParseContext`'s constructor and
 * filling its fields after the walk completes, every `OasRef` constructed
 * during parsing points at the *same instance*. Once `parse()` finishes and
 * sets `oasDocument.fields`, every previously-issued ref becomes resolvable
 * retroactively. If `OasDocument` were a value object populated at
 * construction time, refs couldn't exist until every component had been
 * parsed — but the components can't be parsed until the refs that point into
 * them are constructable. Chicken-and-egg.
 *
 * The same pattern recurs in `GqlRegistry.#refDocument`: an empty
 * `OasDocument` mirror that `createRef()` hands out refs against, populated
 * as types are registered. If you find yourself reaching for the same trick
 * elsewhere, that's the pattern.
 *
 * Consequence for code touching `OasDocument`: accessors throw when `#fields`
 * is unset, on the assumption that no production code reads the document
 * outside the parse flow. Test code that needs to inspect mid-parse state
 * should call `parse()` first; defensive callers (e.g. `removeItem`) should
 * either parse-then-inspect or check the field's setness.
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
  removeItem(
    stackTrail: StackTrail
  ): OasOperation | OasWebhook | OasSchema | OasRef<'schema'> | undefined {
    const [first, second, third] = stackTrail.stackTrail

    switch (first) {
      case 'paths': {
        const index = this.#fields!.operations.findIndex(
          ({ path, method }) => path === second && method === third
        )

        if (index === -1) {
          return undefined
        }

        const [removed] = this.#fields!.operations.splice(index, 1)

        return removed
      }

      case 'webhooks': {
        const webhooks = this.#fields!.webhooks

        if (!webhooks) {
          return undefined
        }

        const index = webhooks.findIndex(({ name, method }) => name === second && method === third)

        if (index === -1) {
          return undefined
        }

        const [removed] = webhooks.splice(index, 1)

        return removed
      }

      case 'components': {
        if (typeof third !== 'string') {
          throw new Error(`RefName cannot be a number: ${third}`)
        }

        return this.#fields!.components!.removeSchema(third as RefName)
      }

      default:
        throw new Error(`Unexpected stack trail: ${stackTrail}`)
    }
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

  /** The parsed fields; throws before {@link OasDocument.fields} is set. */
  get fields(): DocumentFields {
    if (!this.#fields) {
      throw new Error(`Accessing 'fields' before fields are set`)
    }

    return this.#fields
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

  /** List of all 3.1 webhooks for the API (kept separate from operations) */
  get webhooks(): OasWebhook[] {
    if (!this.#fields) {
      throw new Error(`Accessing 'webhooks' before fields are set`)
    }

    return this.#fields.webhooks ?? []
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

  /** External documentation for the API */
  get externalDocs(): OasExternalDocs | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'externalDocs' before fields are set`)
    }

    return this.#fields.externalDocs
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
      webhooks: this.webhooks,
      components: this.components,
      tags: this.tags,
      security: this.security,
      ...this.extensionFields
    }
  }
}
