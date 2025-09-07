import type { OasRefData } from './ref-types.ts'
import { toRefName } from '../../helpers/refFns.ts'
import { match } from 'npm:ts-pattern@^5.8.0'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasDocument } from '../document/Document.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'

const MAX_LOOKUPS = 10

/**
 * Field data for creating OAS reference objects.
 * 
 * @template T - The type of component being referenced (e.g., 'schema', 'response')
 */
export type RefFields<T extends OasRefData['refType']> = {
  refType: T
  $ref: string
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
export class OasRef<T extends OasRefData['refType']> {
  /** OAS type identifier */
  oasType: 'ref' = 'ref'
  /** Type identifier */
  type: 'ref' = 'ref'
  #fields: RefFields<T>
  #oasDocument: OasDocument

  /**
   * Creates a new OAS reference instance.
   * 
   * @param fields - Reference field data including refType and $ref
   * @param oasDocument - Document containing the referenced component
   */
  constructor(fields: RefFields<T>, oasDocument: OasDocument) {
    this.#fields = fields
    this.#oasDocument = oasDocument
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
   * Resolves this reference one level, potentially returning another reference.
   * 
   * @returns Either the resolved component or another reference in the chain
   */
  resolveOnce(): OasRef<T> | ResolvedRef<T> {
    const c = this.oasDocument.components

    const refName = toRefName(this.$ref)

    const refType: OasRefData['refType'] = this.refType

    const resolved = match(refType)
      .with('schema', () => c?.schemas?.[refName])
      .with('requestBody', () => c?.requestBodies?.[refName])
      .with('parameter', () => c?.parameters?.[refName])
      .with('response', () => c?.responses?.[refName])
      .with('example', () => c?.examples?.[refName])
      .with('header', () => c?.headers?.[refName])
      .with('securityScheme', () => c?.securitySchemes?.[refName])
      .exhaustive()

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

  toRefName(): RefName {
    return toRefName(this.#fields.$ref)
  }

  get $ref(): string {
    return this.#fields.$ref
  }

  get refType(): OasRefData['refType'] {
    return this.#fields.refType
  }

  get oasDocument(): OasDocument {
    return this.#oasDocument
  }

  toJsonSchema({
    resolve
  }: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T> {
    if (resolve) {
      const resolved = this.resolve().toJsonSchema({ resolve })

      return resolved as ResolvedRefJsonType<T>
    }

    const ref: OpenAPIV3.ReferenceObject = {
      $ref: `#/components/${match(this.refType)
        .with('schema', () => 'schemas')
        .with('requestBody', () => 'requestBodies')
        .with('parameter', () => 'parameters')
        .with('response', () => 'responses')
        .with('example', () => 'examples')
        .with('header', () => 'headers')
        .with('securityScheme', () => 'securitySchemes')
        .exhaustive()}/${this.toRefName()}`
    }

    return ref
  }

  toJSON(): object {
    return {
      $ref: `#/components/${match(this.refType)
        .with('schema', () => 'schemas')
        .with('requestBody', () => 'requestBodies')
        .with('parameter', () => 'parameters')
        .with('response', () => 'responses')
        .with('example', () => 'examples')
        .with('header', () => 'headers')
        .with('securityScheme', () => 'securitySchemes')
        .exhaustive()}/${this.toRefName()}`
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
