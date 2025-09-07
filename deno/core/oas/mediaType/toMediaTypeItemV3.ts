import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { OasMediaType } from './MediaType.ts'
import type { MediaTypeFields } from './MediaType.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

/**
 * Arguments for transforming an OpenAPI v3 media type item into an OAS media type.
 */
type ToMediaTypeItemV3Args = {
  /** The OpenAPI v3 media type object to transform */
  mediaTypeItem: OpenAPIV3.MediaTypeObject
  /** The media type string (e.g., 'application/json', 'text/plain') */
  mediaType: string
  /** The parsing context for tracing and processing */
  context: ParseContext
}

/**
 * Transforms an OpenAPI v3 media type object into an internal OAS media type representation.
 * 
 * This function processes OpenAPI v3 MediaType objects, extracting schema definitions,
 * examples, encoding information, and specification extensions. It creates a structured
 * internal representation that can be used by the SKMTC pipeline for code generation
 * and validation.
 * 
 * The transformation handles all standard OpenAPI v3 MediaType properties including
 * schema references, inline schemas, examples, encoding specifications, and custom
 * extension fields that begin with 'x-'.
 * 
 * @param args - Transformation arguments
 * @param args.mediaTypeItem - The OpenAPI v3 media type object to process
 * @param args.mediaType - The media type identifier (MIME type)
 * @param args.context - Parsing context for tracing and error handling
 * @returns Structured OAS media type object for internal processing
 * 
 * @example Transforming JSON media type
 * ```typescript
 * import { toMediaTypeItemV3 } from '@skmtc/core/oas/mediaType';
 * 
 * const jsonMediaType = {
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       name: { type: 'string' },
 *       email: { type: 'string', format: 'email' }
 *     }
 *   },
 *   example: {
 *     name: 'John Doe',
 *     email: 'john@example.com'
 *   }
 * };
 * 
 * const result = toMediaTypeItemV3({
 *   mediaTypeItem: jsonMediaType,
 *   mediaType: 'application/json',
 *   context: parseContext
 * });
 * 
 * console.log(result.mediaType); // 'application/json'
 * console.log(result.schema); // Processed schema object
 * ```
 * 
 * @example Processing form data with encoding
 * ```typescript
 * const formMediaType = {
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       file: { type: 'string', format: 'binary' },
 *       metadata: { type: 'string' }
 *     }
 *   },
 *   encoding: {
 *     file: {
 *       contentType: 'image/png',
 *       headers: {
 *         'X-Rate-Limit': {
 *           schema: { type: 'integer' }
 *         }
 *       }
 *     }
 *   }
 * };
 * 
 * const result = toMediaTypeItemV3({
 *   mediaTypeItem: formMediaType,
 *   mediaType: 'multipart/form-data',
 *   context: parseContext
 * });
 * 
 * console.log(result.encoding); // Processed encoding configuration
 * ```
 * 
 * @example Handling multiple examples
 * ```typescript
 * const mediaTypeWithExamples = {
 *   schema: { type: 'string' },
 *   examples: {
 *     success: {
 *       summary: 'Successful response',
 *       value: 'Operation completed'
 *     },
 *     error: {
 *       summary: 'Error response',
 *       value: 'Operation failed'
 *     }
 *   }
 * };
 * 
 * const result = toMediaTypeItemV3({
 *   mediaTypeItem: mediaTypeWithExamples,
 *   mediaType: 'text/plain',
 *   context: parseContext
 * });
 * 
 * console.log(Object.keys(result.examples)); // ['success', 'error']
 * ```
 */
export const toMediaTypeItemV3 = ({
  mediaTypeItem,
  mediaType,
  context
}: ToMediaTypeItemV3Args): OasMediaType => {
  const { schema, example, examples, encoding, ...skipped } = mediaTypeItem

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: mediaTypeItem,
    context,
    parentType: 'mediaType'
  })

  const fields: MediaTypeFields = {
    mediaType,
    encoding,
    schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
    examples: context.trace('examples', () =>
      toExamplesV3({
        example,
        examples,
        exampleKey: mediaType,
        context
      })
    ),
    extensionFields
  }

  return new OasMediaType(fields)
}

/**
 * Arguments for transforming multiple OpenAPI v3 media type items.
 */
type ToMediaTypeItemsV3Args = {
  /** Map of media type strings to OpenAPI v3 MediaType objects */
  content: Record<string, OpenAPIV3.MediaTypeObject>
  /** The parsing context for tracing and processing */
  context: ParseContext
}

/**
 * Transforms multiple OpenAPI v3 media type objects into internal OAS representations.
 * 
 * This function processes a complete content map from OpenAPI v3, transforming each
 * media type entry into its internal OAS representation. It's commonly used to process
 * the `content` property of request bodies, responses, and parameters that support
 * multiple media types.
 * 
 * The function maintains the original media type keys while transforming the values
 * into structured OAS media type objects. Each transformation is traced for debugging
 * and error tracking purposes.
 * 
 * @param args - Transformation arguments
 * @param args.content - Map of media types to OpenAPI MediaType objects
 * @param args.context - Parsing context for tracing and error handling
 * @returns Map of media type strings to processed OAS media type objects
 * 
 * @example Processing multiple content types
 * ```typescript
 * import { toMediaTypeItemsV3 } from '@skmtc/core/oas/mediaType';
 * 
 * const content = {
 *   'application/json': {
 *     schema: {
 *       type: 'object',
 *       properties: { message: { type: 'string' } }
 *     }
 *   },
 *   'application/xml': {
 *     schema: {
 *       type: 'string'
 *     }
 *   },
 *   'text/plain': {
 *     schema: {
 *       type: 'string'
 *     },
 *     example: 'Plain text response'
 *   }
 * };
 * 
 * const result = toMediaTypeItemsV3({
 *   content,
 *   context: parseContext
 * });
 * 
 * console.log(Object.keys(result)); // ['application/json', 'application/xml', 'text/plain']
 * console.log(result['application/json'].mediaType); // 'application/json'
 * ```
 * 
 * @example Processing request body content types
 * ```typescript
 * const requestBodyContent = {
 *   'application/json': {
 *     schema: { $ref: '#/components/schemas/CreateUserRequest' }
 *   },
 *   'application/x-www-form-urlencoded': {
 *     schema: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' },
 *         email: { type: 'string' }
 *       }
 *     },
 *     encoding: {
 *       email: {
 *         style: 'form',
 *         explode: false
 *       }
 *     }
 *   }
 * };
 * 
 * const processed = toMediaTypeItemsV3({
 *   content: requestBodyContent,
 *   context: parseContext
 * });
 * 
 * // Each media type is processed with its specific configuration
 * console.log(processed['application/json'].schema); // Reference object
 * console.log(processed['application/x-www-form-urlencoded'].encoding); // Form encoding config
 * ```
 */
export const toMediaTypeItemsV3 = ({
  content,
  context
}: ToMediaTypeItemsV3Args): Record<string, OasMediaType> => {
  return Object.fromEntries(
    Object.entries(content).map(([mediaType, value]) => [
      mediaType,
      context.trace(mediaType, () =>
        toMediaTypeItemV3({
          mediaTypeItem: value,
          mediaType,
          context
        })
      )
    ])
  )
}

/**
 * Arguments for optionally transforming OpenAPI v3 media type items.
 */
type ToOptionalMediaTypeItemsV3Args = {
  /** Optional map of media type strings to OpenAPI v3 MediaType objects */
  content: Record<string, OpenAPIV3.MediaTypeObject> | undefined
  /** The parsing context for tracing and processing */
  context: ParseContext
}

/**
 * Optionally transforms OpenAPI v3 media type objects when content is provided.
 * 
 * This function provides a safe way to process media type content that may or may not
 * be present in the OpenAPI specification. It handles the common pattern where content
 * properties are optional in OpenAPI objects (like responses without bodies or
 * operations without request bodies).
 * 
 * When content is undefined, the function returns undefined without processing.
 * When content is provided, it delegates to `toMediaTypeItemsV3` for full processing.
 * 
 * @param args - Transformation arguments
 * @param args.content - Optional map of media types to OpenAPI MediaType objects
 * @param args.context - Parsing context for tracing and error handling
 * @returns Map of processed media types if content exists, undefined otherwise
 * 
 * @example Handling optional response content
 * ```typescript
 * import { toOptionalMediaTypeItemsV3 } from '@skmtc/core/oas/mediaType';
 * 
 * // Response with content
 * const responseWithContent = {
 *   description: 'Successful response',
 *   content: {
 *     'application/json': {
 *       schema: { type: 'object' }
 *     }
 *   }
 * };
 * 
 * const withContent = toOptionalMediaTypeItemsV3({
 *   content: responseWithContent.content,
 *   context: parseContext
 * });
 * console.log(withContent); // { 'application/json': OasMediaType }
 * 
 * // Response without content (like 204 No Content)
 * const responseNoContent = {
 *   description: 'No content response'
 * };
 * 
 * const noContent = toOptionalMediaTypeItemsV3({
 *   content: responseNoContent.content, // undefined
 *   context: parseContext
 * });
 * console.log(noContent); // undefined
 * ```
 * 
 * @example Processing operations with optional request bodies
 * ```typescript
 * function processOperation(operation: OpenAPIV3.OperationObject) {
 *   const requestBodyContent = toOptionalMediaTypeItemsV3({
 *     content: operation.requestBody?.content,
 *     context: parseContext
 *   });
 * 
 *   if (requestBodyContent) {
 *     console.log('Operation has request body with media types:');
 *     console.log(Object.keys(requestBodyContent));
 *   } else {
 *     console.log('Operation has no request body');
 *   }
 * }
 * ```
 * 
 * @example Safe processing in response handlers
 * ```typescript
 * class ResponseProcessor {
 *   processResponse(response: OpenAPIV3.ResponseObject) {
 *     const mediaTypes = toOptionalMediaTypeItemsV3({
 *       content: response.content,
 *       context: this.context
 *     });
 * 
 *     // Safe to check without worrying about undefined content
 *     const hasJsonResponse = mediaTypes && 'application/json' in mediaTypes;
 *     
 *     if (hasJsonResponse) {
 *       const jsonMediaType = mediaTypes['application/json'];
 *       return this.generateJsonResponseHandler(jsonMediaType);
 *     }
 * 
 *     return this.generateEmptyResponseHandler();
 *   }
 * }
 * ```
 */
export const toOptionalMediaTypeItemsV3 = ({
  content,
  context
}: ToOptionalMediaTypeItemsV3Args): Record<string, OasMediaType> | undefined => {
  if (!content) {
    return
  }

  return toMediaTypeItemsV3({ content, context })
}
