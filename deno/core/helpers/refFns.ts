import type { RefName } from '../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ReferenceObject } from '../parse/v3-0/_merge-all-of/types.ts'
import { DanglingRefError } from '../oas/ref/DanglingRefError.ts'
import type { OasRefData } from '@/oas/ref/ref-types.ts'
import { toJsonPointer, unescapeSegment, type JsonPointer } from '@/types/JsonPointer.ts'
import { componentsKeys } from '@/oas/components/Components.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import { camelCase, capitalize } from '@/helpers/strings.ts'

/** The kind of component a `$ref` points at: `schema`, `parameter`, `response`, and so on. */
type RefType = OasRefData['refType']

/**
 * Where a `$ref` points, in two parts: `refPath`, the JSON pointer before its
 * last segment, and `refName`, that last segment unescaped.
 * `#/components/schemas/Pet` is `refPath` `#/components/schemas` and `refName`
 * `Pet`. `#/components/schemas/__sharedInput/$defs/schema0` is `refPath`
 * `#/components/schemas/__sharedInput/$defs` and `refName` `schema0`.
 *
 * `refPath` has one spelling, whatever the `$ref` has: no percent escapes, and
 * `~` and `/` in a segment as `~0` and `~1` (RFC 6901). Two refs to one place
 * have equal parts.
 *
 * The model API takes a model's ref in this shape (`insertModel(Peer, ref)`,
 * `toIdentifierName({ ref, … })`), so the two parts travel together. An
 * `OasRef` has both fields and fits it as it is.
 */
export type RefParts = {
  /** The last segment of the pointer, unescaped. Empty for a `$ref` that ends in `/`. */
  refName: RefName
  /**
   * The pointer before the last segment, starting with `#`, with no percent
   * escapes. A remote `$ref` ({@link isRemoteRefPath}) has the file before the `#`.
   */
  refPath: string
}

type ToRefPartsArgs = {
  $ref: string
}

/**
 * Splits a `$ref` into {@link RefParts}.
 *
 * A `$ref` is a URI whose fragment holds a JSON pointer (RFC 6901), so the
 * name is unescaped as one: `%20` is a space, and `~1` and `~0` are `/` and
 * `~`. `#/components/schemas/Foo%20Bar` names the component `Foo Bar`.
 *
 * A remote `$ref`, one that does not start with `#`, points outside the
 * document, so its `refPath` does not start with `#` and it names nothing
 * here: `other.yml#/components/schemas/A` is `refPath`
 * `other.yml#/components/schemas` and `refName` `A`. This never throws: a
 * `$ref` that names nothing is found out when it is resolved.
 */
export const toRefParts = ({ $ref }: ToRefPartsArgs): RefParts => {
  if (!$ref.startsWith('#')) {
    const cut = $ref.lastIndexOf('/')
    const refName = $ref.slice(cut + 1) as RefName

    return { refName, refPath: cut === -1 ? '.' : $ref.slice(0, cut) }
  }

  const pointer = $ref.slice(1)
  const segments = (pointer.startsWith('/') ? pointer.slice(1) : pointer)
    .split('/')
    .map(segment => unescapeSegment(toPercentDecoded(segment)))

  return toPartsOf(segments)
}

/** The parts of a pointer's segments, each unescaped. */
const toPartsOf = (segments: readonly string[]): RefParts => ({
  refName: (segments.at(-1) ?? '') as RefName,
  refPath: segments.length > 1 ? toJsonPointer(segments.slice(0, -1)) : '#'
})

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

/**
 * Whether a `refPath` is that of a remote `$ref`: one that points outside the
 * document (`other.yml#/components/schemas/A`, `./pet.yaml`, a bare id). Core
 * does not fetch, so a remote `$ref` names nothing. The document is bundled
 * into one before core reads it.
 */
export const isRemoteRefPath = (refPath: string): boolean => !refPath.startsWith('#')

/** The segments of a `refPath` in the document, each unescaped. `#` has none. */
export const toRefPathSegments = (refPath: string): string[] => {
  const body = refPath.startsWith('#/') ? refPath.slice(2) : refPath.slice(1)

  return body === '' ? [] : body.split('/').map(unescapeSegment)
}

type IsDefaultRefPathArgs = {
  refPath: string
  refType: RefType
}

/**
 * The `components` bucket a `refPath` is, such as `schemas` for
 * `#/components/schemas`, or `undefined` for any other path. A ref whose path
 * is a bucket names a component, of the bucket's kind whatever kind the ref
 * is written for; any other ref points into a document's content, as one into
 * an extension of `components` (`#/components/x-shared/Foo`) does. A bucket
 * core does not read (`pathItems`) is still a bucket.
 */
export const toRefPathBucket = (refPath: string): string | undefined => {
  if (isRemoteRefPath(refPath)) {
    return undefined
  }

  const [first, bucket, ...rest] = toRefPathSegments(refPath)

  return first === 'components' && rest.length === 0 && isBucket(bucket) ? bucket : undefined
}

/** The `components` buckets OpenAPI defines that core does not read. */
const unreadBuckets = ['callbacks', 'pathItems', 'mediaTypes']

const isBucket = (key: string): boolean => componentsKeys.includes(key) || unreadBuckets.includes(key)

/** Whether `refPath` is where components of `refType` live, as `toRefParts` spells it. */
export const isDefaultRefPath = ({ refPath, refType }: IsDefaultRefPathArgs): boolean =>
  toRefPathBucket(refPath) === toComponentsBucket(refType)

/**
 * The whole pointer of a ref, with no percent escapes. Two `$ref`s that point
 * at the same place give the same pointer, so it keys a ref that does not
 * point at a component. A remote `$ref` is given as written.
 */
export const toRefPointer = ({ refName, refPath }: RefParts): string =>
  isRemoteRefPath(refPath) ? `${refPath}/${refName}` : toJsonPointer([...toRefPathSegments(refPath), refName])

/**
 * The ref of the schema component named `refName`: `refPath`
 * `#/components/schemas`. For code that holds a component's name but no
 * `OasRef`, such as the engine's sweep over `components.schemas`.
 */
export const toSchemaComponentRef = (refName: RefName): RefParts => ({
  refName,
  refPath: `#/components/${toComponentsBucket('schema')}`
})

/**
 * The key a model is known by in the engine: its generator key, its
 * enrichments (`[id][key][variant]`) and its manifest entry. A component
 * (`refPath` `#/components/schemas`) is keyed by its `refName`, as it always
 * was. Any other target is keyed by its whole pointer ({@link toRefPointer}),
 * so two targets that share a `refName` stay apart.
 */
export const toModelKey = ({ refName, refPath }: RefParts): string =>
  isDefaultRefPath({ refPath, refType: 'schema' }) ? refName : toRefPointer({ refName, refPath })

/**
 * A name for a model that differs between targets with one `refName`
 * (`…/properties/disk` under two schemas). A component is named by its
 * `refName`, through `toComponentName`. Any other target is named by its whole
 * pointer, its segments joined by `_`: `Order_items`, `Pet_properties_tag`.
 * A segment that is not alphanumeric gets a hash, so `@type` and `type` differ.
 */
export const toModelName = (
  { refName, refPath }: RefParts,
  toComponentName: (refName: string) => string = name => name
): string => {
  if (isDefaultRefPath({ refPath, refType: 'schema' })) {
    return toComponentName(refName)
  }

  const segments = [...(isRemoteRefPath(refPath) ? [refPath] : toRefPathSegments(refPath)), refName]
  const [first, second, ...rest] = segments
  const named = first === 'components' && second === 'schemas' ? rest : segments

  return capitalize(
    named.map(segment => (/^[a-zA-Z0-9]+$/.test(segment) ? segment : `${camelCase(segment)}${toShortHash(segment)}`)).join('_')
  )
}

/** A 32-bit FNV-1a hash, in base 36. */
const toShortHash = (value: string): string =>
  [...value]
    .reduce((hash, char) => Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0, 0x811c9dc5)
    .toString(36)

/** Whether a model key ({@link toModelKey}) is a whole pointer, and not a component's `refName`. */
export const isPointerKey = (key: string): boolean => key.startsWith('#/')

/**
 * Reverses {@link toModelKey}, for a key read back out of a generator key.
 * A pointer starts with `#/`; any other key is a component's `refName`. A key
 * has no percent escapes, so a `%` in it is read as written.
 */
export const fromModelKey = (key: string): RefParts =>
  isPointerKey(key) ? toPartsOf(key.slice(2).split('/').map(unescapeSegment)) : toSchemaComponentRef(key as RefName)

/**
 * The value at a ref's pointer in a raw document, or `undefined` when the
 * pointer leads nowhere, or out of the document. It walks objects by key and arrays by index.
 */
export const toRawRefTarget = (document: unknown, { refName, refPath }: RefParts): unknown =>
  isRemoteRefPath(refPath) ? undefined : [...toRefPathSegments(refPath), refName].reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) {
      return /^\d+$/.test(segment) ? value[Number(segment)] : undefined
    }

    return isPlainObject(value) && Object.hasOwn(value, segment) ? value[segment] : undefined
  }, document)

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
 *   const { refName, refPath } = toRefParts({ $ref: schemaOrRef.$ref });
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
 * names nothing, one to a component that is not a schema, or a chain that
 * comes back to a place it has passed (`A` is a `$ref` to `B`, and `B` to
 * `A`), gives `onDangling` a `DanglingRefError`, or throws it.
 */
const toTargetSchema = ({ oasDocument, onDangling, $ref, followed }: ToTargetSchemaArgs): OpenAPIV3.SchemaObject => {
  const parts = toRefParts({ $ref })
  const bucket = toRefPathBucket(parts.refPath)
  const namesSchema = parts.refName !== '' && (bucket === undefined || bucket === toComponentsBucket('schema'))
  const item = namesSchema ? toRawRefTarget(oasDocument, parts) : undefined

  if (!isRawSchema(item)) {
    return toDangling(onDangling, new DanglingRefError($ref, { remote: isRemoteRefPath(parts.refPath) }))
  }

  if (!isRef(item)) {
    return item
  }

  const passed = [...followed, $ref]
  const toPointer = (each: string): string => toRefPointer(toRefParts({ $ref: each }))
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
