import type { RefName } from '../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ReferenceObject } from '../parse/v3-0/_merge-all-of/types.ts'
import { DanglingRefError } from '../oas/ref/DanglingRefError.ts'
import type { OasRefData } from '@/oas/ref/ref-types.ts'
import { toJsonPointer, type JsonPointer } from '@/types/JsonPointer.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'

/** The kind of component a `$ref` points at: `schema`, `parameter`, `response`, and so on. */
type RefType = OasRefData['refType']

/**
 * Where a `$ref` points, in two parts: `refPath`, the JSON pointer before its
 * last segment, as written, and `refName`, that last segment unescaped.
 * `#/components/schemas/Pet` is `refPath` `#/components/schemas` and `refName`
 * `Pet`. `#/components/schemas/__sharedInput/$defs/schema0` is `refPath`
 * `#/components/schemas/__sharedInput/$defs` and `refName` `schema0`.
 */
export type RefParts = {
  /** The last segment of the pointer, unescaped. Empty for a `$ref` that ends in `/`. */
  refName: RefName
  /** The pointer before the last segment, as written, starting with `#`. */
  refPath: string
}

type ToRefPartsArgs = {
  $ref: string
  /** The kind of component the `$ref` is written for. A `$ref` with no `#` reads at its default path. */
  refType: RefType
}

/**
 * Splits a `$ref` into {@link RefParts}.
 *
 * A `$ref` is a URI whose fragment holds a JSON pointer (RFC 6901), so the
 * name is unescaped as one: `%20` is a space, and `~1` and `~0` are `/` and
 * `~`. `#/components/schemas/Foo%20Bar` names the component `Foo Bar`.
 *
 * Only the fragment is read: `other.yml#/components/schemas/A` is read as
 * `#/components/schemas/A`. A `$ref` with no `#` (such as a bare id) is read
 * by its last `/`-separated segment at the default path of its kind, so it
 * looks up a component by that name. Neither throws: a `$ref` that names
 * nothing is found out when it is resolved.
 */
export const toRefParts = ({ $ref, refType }: ToRefPartsArgs): RefParts => {
  const hash = $ref.indexOf('#')
  const pointer = hash === -1 ? `/components/${toComponentsBucket(refType)}/${$ref.split('/').at(-1) ?? ''}` : $ref.slice(hash + 1)
  const cut = pointer.lastIndexOf('/')

  return {
    refName: toUnescapedSegment(pointer.slice(cut + 1)) as RefName,
    refPath: `#${cut === -1 ? '' : pointer.slice(0, cut)}`
  }
}

/** The `components` bucket that holds components of each kind: `schemas`, `parameters`, and so on. */
export const toComponentsBucket = (refType: RefType): string => {
  switch (refType) {
    case 'schema':
      return 'schemas'
    case 'requestBody':
      return 'requestBodies'
    case 'parameter':
      return 'parameters'
    case 'response':
      return 'responses'
    case 'example':
      return 'examples'
    case 'header':
      return 'headers'
    case 'securityScheme':
      return 'securitySchemes'
    case 'link':
      return 'links'
    default: {
      const _exhaustive: never = refType
      throw new Error(`Unhandled ref type: ${_exhaustive}`)
    }
  }
}

/** The segments of a `refPath`, each unescaped. `#` has none. */
export const toRefPathSegments = (refPath: string): string[] => {
  const body = refPath.startsWith('#/') ? refPath.slice(2) : refPath.slice(1)

  return body === '' ? [] : body.split('/').map(toUnescapedSegment)
}

type IsDefaultRefPathArgs = {
  refPath: string
  refType: RefType
}

/**
 * The `components` bucket a `refPath` is, such as `schemas` for
 * `#/components/schemas`, or `undefined` for any other path. A ref whose path
 * is a bucket names a component, of the bucket's kind whatever kind the ref
 * is written for; any other ref points into a document's content.
 */
export const toRefPathBucket = (refPath: string): string | undefined => {
  const [first, bucket, ...rest] = toRefPathSegments(refPath)

  return first === 'components' && rest.length === 0 ? bucket : undefined
}

/** Whether `refPath` is where components of `refType` live, however its segments are escaped. */
export const isDefaultRefPath = ({ refPath, refType }: IsDefaultRefPathArgs): boolean =>
  toRefPathBucket(refPath) === toComponentsBucket(refType)

/**
 * The whole pointer of a ref, in one spelling: each segment unescaped, then
 * written as RFC 6901 writes it, with no percent escapes. Two `$ref`s that
 * point at the same place give the same pointer, so it keys a ref that does
 * not point at a component.
 */
export const toRefPointer = ({ refName, refPath }: RefParts): JsonPointer =>
  toJsonPointer([...toRefPathSegments(refPath), refName])

type ToModelKeyArgs = {
  refName: RefName
  /** Absent for a component, as `#/components/schemas` is. */
  refPath?: string
}

/**
 * The key a model is known by in the engine: its generator key, its
 * enrichments (`[id][key][variant]`) and its manifest entry. A component
 * (`refPath` `#/components/schemas`, or none) is keyed by its `refName`, as
 * it always was. Any other target is keyed by its whole pointer
 * ({@link toRefPointer}), so two targets that share a `refName` stay apart.
 */
export const toModelKey = ({ refName, refPath }: ToModelKeyArgs): string =>
  refPath === undefined || isDefaultRefPath({ refPath, refType: 'schema' })
    ? refName
    : toRefPointer({ refName, refPath })

/**
 * The value at a ref's pointer in a raw document, or `undefined` when the
 * pointer leads nowhere. It walks objects by key and arrays by index.
 */
export const toRawRefTarget = (document: unknown, { refName, refPath }: RefParts): unknown =>
  [...toRefPathSegments(refPath), refName].reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) {
      return /^\d+$/.test(segment) ? value[Number(segment)] : undefined
    }

    return isPlainObject(value) && Object.hasOwn(value, segment) ? value[segment] : undefined
  }, document)

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
 * The schema at the end of the chain of `$ref`s, each followed by its whole
 * pointer: a component (`#/components/schemas/Pet`) or any other place in
 * the document (`#/components/schemas/Pet/properties/tag`). A `$ref` that
 * names nothing, or a chain that comes back to a place it has passed (`A` is
 * a `$ref` to `B`, and `B` to `A`), gives `onDangling` a `DanglingRefError`,
 * or throws it.
 */
const toTargetSchema = ({ oasDocument, onDangling, $ref, followed }: ToTargetSchemaArgs): OpenAPIV3.SchemaObject => {
  const parts = toRefParts({ $ref, refType: 'schema' })
  const item = parts.refName === '' ? undefined : toRawRefTarget(oasDocument, parts)

  if (!isRawSchema(item)) {
    return toDangling(onDangling, new DanglingRefError($ref))
  }

  if (!isRef(item)) {
    return item
  }

  const passed = [...followed, $ref]
  const toPointer = (each: string): JsonPointer => toRefPointer(toRefParts({ $ref: each, refType: 'schema' }))
  const loopStart = passed.findIndex(each => toPointer(each) === toPointer(item.$ref))

  if (loopStart === -1) {
    return toTargetSchema({ oasDocument, onDangling, $ref: item.$ref, followed: passed })
  }

  // The `$ref`s written in the loop's components: each one after the `$ref`
  // that first named one of them, as `OasRef.toLoop` gives them.
  const loop = [...passed.slice(loopStart + 1), item.$ref]

  return toDangling(onDangling, new DanglingRefError(passed[0] ?? $ref, { loop }))
}

/**
 * Whether a value found at a pointer can be read as a schema: an object. Its
 * keywords are read as the merge reads any member; nothing more is checked
 * here, as for a component.
 */
const isRawSchema = (value: unknown): value is OpenAPIV3.SchemaObject => isPlainObject(value)

const toDangling = (onDangling: OnDangling | undefined, error: DanglingRefError): OpenAPIV3.SchemaObject => {
  if (onDangling) {
    return onDangling(error)
  }

  throw error
}
