import type { RefName } from '../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ReferenceObject } from '../parse/v3-0/_merge-all-of/types.ts'
import { DanglingRefError } from '../oas/ref/DanglingRefError.ts'

/**
 * Extracts a reference name from an OpenAPI $ref string.
 *
 * This function parses JSON Pointer references (like '#/components/schemas/User')
 * and extracts the final component as a branded RefName type. It's used throughout
 * the SKMTC system to convert string references into type-safe reference names.
 *
 * A `$ref` is a URI fragment that holds a JSON pointer (RFC 6901), so the name
 * is unescaped as one: `%20` is a space, and `~1` and `~0` are `/` and `~`.
 * `#/components/schemas/Foo%20Bar` names the component `Foo Bar`.
 *
 * @param $ref - The OpenAPI reference string (e.g., '#/components/schemas/User')
 * @returns The extracted reference name as a branded RefName type
 *
 * @throws {Error} When the reference string is invalid or empty
 *
 * @example Basic usage
 * ```typescript
 * import { toRefName } from '@skmtc/core/helpers';
 *
 * const refName = toRefName('#/components/schemas/User');
 * console.log(refName); // 'User' (typed as RefName)
 *
 * const responseRef = toRefName('#/components/responses/ErrorResponse');
 * console.log(responseRef); // 'ErrorResponse' (typed as RefName)
 * ```
 *
 * @example Error cases
 * ```typescript
 * // These will throw errors:
 * toRefName('invalid/ref/'); // Error: 'Invalid reference'
 * toRefName('#/components/schemas/'); // Error: 'Invalid reference'
 * ```
 *
 * @example Integration with OAS processing
 * ```typescript
 * class SchemaProcessor {
 *   processReference(ref: string) {
 *     const refName = toRefName(ref);
 *     const schema = this.document.components.schemas[refName];
 *     return this.processSchema(schema, refName);
 *   }
 * }
 * ```
 */
export const toRefName = ($ref: string): RefName => {
  const segment = $ref.split('/').slice(-1)[0]

  if (!segment) {
    throw new Error('Invalid reference')
  }

  return toUnescapedSegment(segment) as RefName
}

/** A JSON pointer segment of a URI fragment, unescaped: percent escapes first, then `~1` and `~0`. */
const toUnescapedSegment = (segment: string): string => {
  return toPercentDecoded(segment).replaceAll('~1', '/').replaceAll('~0', '~')
}

const toPercentDecoded = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    // A `%` that starts no valid escape is read as written.
    return segment
  }
}

/**
 * Type representing an object with a $ref property.
 */
type Ref = {
  /** The OpenAPI reference string */
  $ref: string
}

/**
 * Type guard function to check if a value is an OpenAPI reference object.
 *
 * This function performs runtime type checking to determine if an unknown value
 * is an OpenAPI Reference Object (contains a $ref property with a string value).
 * It's essential for safely handling mixed schema/reference data during processing.
 *
 * @param value - The value to check for reference properties
 * @returns True if the value is a reference object, false otherwise
 *
 * @example Basic type checking
 * ```typescript
 * import { isRef } from '@skmtc/core/helpers';
 *
 * const schemaOrRef: unknown = { $ref: '#/components/schemas/User' };
 *
 * if (isRef(schemaOrRef)) {
 *   // TypeScript now knows schemaOrRef has a $ref property
 *   console.log(schemaOrRef.$ref); // Safe to access
 *   const refName = toRefName(schemaOrRef.$ref);
 * } else {
 *   // Handle as actual schema object
 *   console.log('Direct schema object');
 * }
 * ```
 *
 * @example Processing mixed data
 * ```typescript
 * function processSchemaOrRef(data: unknown) {
 *   if (isRef(data)) {
 *     // Handle reference
 *     return resolveReference(data.$ref);
 *   } else {
 *     // Handle direct schema
 *     return processSchema(data as SchemaObject);
 *   }
 * }
 * ```
 *
 * @example Array processing
 * ```typescript
 * const mixedArray: unknown[] = [
 *   { type: 'string' },
 *   { $ref: '#/components/schemas/User' },
 *   { type: 'number' }
 * ];
 *
 * const references = mixedArray.filter(isRef);
 * const schemas = mixedArray.filter(item => !isRef(item));
 * ```
 */
export const isRef = (value: unknown): value is Ref => {
  if (value && typeof value === 'object' && '$ref' in value && typeof value.$ref === 'string') {
    return true
  } else {
    return false
  }
}

/**
 * Creates a reference resolver function for an OpenAPI document.
 *
 * This higher-order function returns a resolver that can dereference OpenAPI
 * JSON Pointer references within the context of a specific document. It handles
 * nested references by recursively resolving reference chains until it reaches
 * an actual schema object.
 *
 * The resolver is particularly useful during schema processing where you need
 * to follow reference chains to get the actual schema definitions.
 *
 * @param oasDocument - The OpenAPI document containing the schemas to resolve against
 * @returns A function that resolves reference objects to schema objects
 *
 * @throws {DanglingRefError} When a reference names no schema in the document,
 * or its chain of references loops, unless `onDangling` reads something in its place
 *
 * @example Basic usage
 * ```typescript
 * import { toGetRef } from '@skmtc/core/helpers';
 *
 * const resolver = toGetRef(openApiDocument);
 *
 * const userSchema = resolver({ $ref: '#/components/schemas/User' });
 * console.log(userSchema.type); // 'object'
 * console.log(userSchema.properties); // User properties
 * ```
 *
 * @example Resolving nested references
 * ```typescript
 * // If User references Address, and Address references Country
 * const resolver = toGetRef(document);
 *
 * // This will follow the chain: User -> Address -> Country
 * const resolvedSchema = resolver({ $ref: '#/components/schemas/User' });
 * // Returns the final resolved schema object
 * ```
 *
 * @example Error handling
 * ```typescript
 * const resolver = toGetRef(document);
 *
 * try {
 *   const schema = resolver({ $ref: '#/components/schemas/NonExistent' });
 * } catch (error) {
 *   console.error('Reference resolution failed:', error.message);
 *   // Ref "#/components/schemas/NonExistent" names nothing in the document
 * }
 * ```
 *
 * @example Integration with schema processing
 * ```typescript
 * class SchemaProcessor {
 *   private resolver = toGetRef(this.document);
 *
 *   processProperty(property: SchemaObject | ReferenceObject) {
 *     if (isRef(property)) {
 *       const resolved = this.resolver(property);
 *       return this.processSchema(resolved);
 *     }
 *     return this.processSchema(property);
 *   }
 * }
 * ```
 */
export const toGetRef =
  (oasDocument: OpenAPIV3.Document, onDangling?: OnDangling) =>
  ({ $ref }: ReferenceObject): OpenAPIV3.SchemaObject =>
    toTargetSchema({ oasDocument, onDangling, $ref, followed: [] })

/**
 * What a resolver reads in place of a `$ref` that names nothing: no schema
 * has its name, or its chain of `$ref`s loops. It may throw `error`.
 */
type OnDangling = (error: DanglingRefError) => OpenAPIV3.SchemaObject

type ToTargetSchemaArgs = {
  oasDocument: OpenAPIV3.Document
  onDangling: OnDangling | undefined
  /** The `$ref` to look up. */
  $ref: string
  /** The `$ref`s followed before `$ref`, from the one asked for. */
  followed: string[]
}

/**
 * The schema at the end of the chain of `$ref`s. A `$ref` that names nothing,
 * or a chain that comes back to a component it has passed (`A` is a `$ref`
 * to `B`, and `B` to `A`), gives `onDangling` a `DanglingRefError`, or throws it.
 */
const toTargetSchema = ({ oasDocument, onDangling, $ref, followed }: ToTargetSchemaArgs): OpenAPIV3.SchemaObject => {
  const item = oasDocument.components?.schemas?.[toRefName($ref)]

  if (!item) {
    return toDangling(onDangling, new DanglingRefError($ref))
  }

  if (!isRef(item)) {
    return item
  }

  const passed = [...followed, $ref]
  const loopStart = passed.findIndex(each => toRefName(each) === toRefName(item.$ref))

  if (loopStart === -1) {
    return toTargetSchema({ oasDocument, onDangling, $ref: item.$ref, followed: passed })
  }

  // The `$ref`s written in the loop's components: each one after the `$ref`
  // that first named one of them, as `OasRef.toLoop` gives them.
  const loop = [...passed.slice(loopStart + 1), item.$ref]

  return toDangling(onDangling, new DanglingRefError(passed[0] ?? $ref, { loop }))
}

const toDangling = (onDangling: OnDangling | undefined, error: DanglingRefError): OpenAPIV3.SchemaObject => {
  if (onDangling) {
    return onDangling(error)
  }

  throw error
}
