import type { OasRefData } from './ref-types.ts'
import { toRefName } from '../../helpers/refFns.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasDocument } from '../document/Document.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

const MAX_LOOKUPS = 10

/**
 * Converts a ref type to its plural components path.
 */
function refTypeToPluralPath(refType: OasRefData['refType']): string {
  switch (refType) {
    case 'schema':
      return 'schemas';
    case 'requestBody':
      return 'requestBodies';
    case 'parameter':
      return 'parameters';
    case 'response':
      return 'responses';
    case 'example':
      return 'examples';
    case 'header':
      return 'headers';
    case 'securityScheme':
      return 'securitySchemes';
    default: {
      const _exhaustive: never = refType;
      throw new Error(`Unhandled ref type: ${_exhaustive}`);
    }
  }
}

/**
 * Field data for creating OAS reference objects.
 * 
 * @template T - The type of component being referenced (e.g., 'schema', 'response')
 */
export type RefFields<T extends OasRefData['refType']> = {
  refType: T
  $ref: string
  /**
   * Use-site nullability. A `$ref` is a per-reference node: the same
   * refName may be referenced nullable at one site and non-nullable at
   * another, so nullability rides the reference, not the shared referent.
   * Set by the single-member `oneOf`/`anyOf` collapse for the 3.1
   * `oneOf:[{$ref},{type:null}]` idiom; consumed directly by generators
   * (`'nullable' in schema ? schema.nullable`) to render `Foo | null`,
   * while `ModelDriver` builds the un-nullable shared model from the
   * refName.
   */
  nullable?: boolean
}

/**
 * Represents an OpenAPI reference ($ref) in the SKMTC OAS processing system.
 * 
 * The `OasRef` class handles OpenAPI JSON Reference Objects that point to reusable
 * components within the same document. It provides type-safe reference resolution
 * with support for chained references and circular reference detection.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Generic parameter ensures resolved types match the reference type
 * - **Lazy Resolution**: References are resolved on-demand, not during construction
 * - **Chain Resolution**: Handles references that point to other references
 * - **Circular Detection**: Prevents infinite loops with maximum lookup limits
 * - **Type Validation**: Ensures resolved objects match expected reference types
 * 
 * @template T - The type of component this reference points to
 * 
 * @example Basic reference resolution
 * ```typescript
 * import { OasRef } from '@skmtc/core';
 * 
 * // Reference to a schema component
 * const userRef = new OasRef<'schema'>({
 *   refType: 'schema',
 *   $ref: '#/components/schemas/User'
 * }, document);
 * 
 * // Resolve the reference
 * const userSchema = userRef.resolve();
 * console.log(userSchema.properties); // Access resolved schema properties
 * ```
 * 
 * @example Working with different reference types
 * ```typescript
 * // Schema reference
 * const schemaRef = new OasRef<'schema'>({
 *   refType: 'schema',
 *   $ref: '#/components/schemas/Product'
 * }, document);
 * 
 * // Response reference
 * const responseRef = new OasRef<'response'>({
 *   refType: 'response',
 *   $ref: '#/components/responses/ErrorResponse'
 * }, document);
 * 
 * // Parameter reference
 * const paramRef = new OasRef<'parameter'>({
 *   refType: 'parameter',
 *   $ref: '#/components/parameters/PageSize'
 * }, document);
 * ```
 * 
 * @example Reference checking and conditional resolution
 * ```typescript
 * function processSchemaOrRef(schema: OasSchema | OasRef<'schema'>) {
 *   if (schema.isRef()) {
 *     // Handle reference
 *     const refName = schema.toRefName();
 *     console.log(`Processing reference: ${refName}`);
 *     
 *     // Resolve only when needed
 *     const resolved = schema.resolve();
 *     return processed(resolved);
 *   } else {
 *     // Handle direct schema
 *     return process(schema);
 *   }
 * }
 * ```
 * 
 * @example Chained reference handling
 * ```typescript
 * // References can point to other references
 * const chainedRef = new OasRef<'schema'>({
 *   refType: 'schema',
 *   $ref: '#/components/schemas/AliasToUser'
 * }, document);
 * 
 * // resolve() automatically follows the chain
 * const finalSchema = chainedRef.resolve(); // Follows chain to final schema
 * 
 * // resolveOnce() resolves only one step
 * const oneStep = chainedRef.resolveOnce(); // May still be a reference
 * ```
 */
export class OasRef<T extends OasRefData['refType']> extends OasBase {
  /** OAS type identifier */
  oasType: 'ref' = 'ref'
  /** Type identifier */
  type: 'ref' = 'ref'
  #fields: RefFields<T>
  #document: SkmtcParsedDocument

  /**
   * Creates a new OAS reference instance.
   *
   * @param fields - Reference field data including refType and $ref
   * @param document - Discriminated document containing the referenced
   *   component. For OAS, refs resolve through the document's components;
   *   for GQL, through the document's registry (GQL only ever creates
   *   schema refs).
   */
  constructor(fields: RefFields<T>, context: ParseContextType) {
    super(context)
    this.#fields = fields
    this.#document = context.parsedDocument
  }

  /**
   * Type guard to check if this instance is a reference.
   *
   * @returns Always true for OasRef instances
   */
  isRef(): this is OasRef<T> {
    return true
  }

  /**
   * Recursively resolves this reference to its final target component.
   *
   * Follows reference chains until reaching a non-reference component,
   * with protection against infinite loops.
   *
   * @param lookupsPerformed - Internal counter to prevent infinite recursion
   * @returns The resolved component
   * @throws Error if maximum lookup depth is exceeded
   */
  resolve(lookupsPerformed: number = 0): ResolvedRef<T> {
    if (lookupsPerformed >= MAX_LOOKUPS) {
      throw new Error('Max lookups reached')
    }

    const resolved = this.resolveOnce()

    return resolved.isRef() ? resolved.resolve(lookupsPerformed + 1) : resolved
  }

  /**
   * Resolves this reference one level. Dispatches on the document's
   * protocol — OAS reads from `document.components.<bucket>`; GQL
   * reads from `document.registry.schemas`.
   *
   * @returns Either the resolved component or another reference in the chain
   */
  resolveOnce(): OasRef<T> | ResolvedRef<T> {
    const refName = toRefName(this.$ref)

    const resolved =
      this.#document.type === 'oas'
        ? this.#resolveOasOnce(this.#document.value, refName)
        : this.#resolveGqlOnce(this.#document.value, refName)

    if (!resolved) {
      throw new Error(`Ref "${this.#fields.$ref}" not found`)
    }

    if (resolved.isRef()) {
      if (resolved.refType !== this.refType) {
        throw new Error(
          `Ref type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.refType}"`
        )
      }
    } else {
      if (resolved.oasType !== this.refType) {
        throw new Error(
          `Type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.oasType}"`
        )
      }
    }

    return resolved as OasRef<T> | ResolvedRef<T>
  }

  #resolveOasOnce(
    document: OasDocument,
    refName: RefName
  ): ResolvedRef<T> | OasRef<T> | undefined {
    const c = document.components
    const refType: OasRefData['refType'] = this.refType
    switch (refType) {
      case 'schema':
        return c?.schemas?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'requestBody':
        return c?.requestBodies?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'parameter':
        return c?.parameters?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'response':
        return c?.responses?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'example':
        return c?.examples?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'header':
        return c?.headers?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      case 'securityScheme':
        return c?.securitySchemes?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      default: {
        const _exhaustive: never = refType
        throw new Error(`Unhandled ref type: ${_exhaustive}`)
      }
    }
  }

  #resolveGqlOnce(
    document: GqlDocument,
    refName: RefName
  ): ResolvedRef<T> | OasRef<T> | undefined {
    // GraphQL only ever creates schema refs — there's no GQL concept
    // of a response/parameter/header/etc. ref. The refType field is
    // still typed by `T` for the OAS variants; on the GQL branch we
    // always do a schema lookup and let the post-lookup refType-vs-
    // oasType check catch any caller that constructed a non-schema
    // ref pointing at a GQL document.
    return document.registry.schemas[refName] as
      | ResolvedRef<T>
      | OasRef<T>
      | undefined
  }

  toRefName(): RefName {
    return toRefName(this.#fields.$ref)
  }

  get $ref(): string {
    return this.#fields.$ref
  }

  get refType(): OasRefData['refType'] {
    return this.#fields.refType
  }

  /**
   * Use-site nullability of this reference (see {@link RefFields.nullable}).
   * The getter exists on the prototype, so `'nullable' in ref` is always
   * true and the value-function nullable read picks it up uniformly.
   */
  get nullable(): boolean | undefined {
    return this.#fields.nullable
  }

  /**
   * Returns the discriminated parsed document this ref resolves
   * through. OAS variant carries the parent `OasDocument`; GQL variant
   * carries the parent `GqlDocument` (whose registry holds the
   * schemas).
   */
  get document(): SkmtcParsedDocument {
    return this.#document
  }

  toJsonSchema({
    resolve
  }: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T> {
    if (resolve) {
      const resolved = this.resolve().toJsonSchema({ resolve })

      return resolved as ResolvedRefJsonType<T>
    }

    const ref: OpenAPIV3.ReferenceObject = {
      $ref: `#/components/${refTypeToPluralPath(this.refType)}/${this.toRefName()}`
    }

    return ref
  }

  toJSON(): object {
    return {
      $ref: `#/components/${refTypeToPluralPath(this.refType)}/${this.toRefName()}`
    }
  }
}

/**
 * Type representing the JSON schema result from resolving a reference.
 * 
 * @template T - The type of component being referenced
 */
export type ResolvedRefJsonType<T extends OasRefData['refType']> = ReturnType<
  ResolvedRef<T>['toJsonSchema']
>

/**
 * Union type of all OAS component types that can be referenced.
 * 
 * Includes all OpenAPI component types that support $ref resolution.
 */
export type OasComponentType =
  | OasSchema
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader
  | OasSecurityScheme

/**
 * Type representing a resolved reference to a specific component type.
 * 
 * @template T - The type of component being referenced (e.g., 'schema', 'response')
 */
export type ResolvedRef<T extends OasRefData['refType']> = Extract<OasComponentType, { oasType: T }>
