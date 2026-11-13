import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import type { OasRefData } from './ref-types.ts'
import { toRefName } from '../../helpers/refFns.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasHeader } from '../header/Header.ts'
import type { OasLink } from '../link/Link.ts'
import type { OasDocument } from '../document/Document.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type { RefName } from '../../types/RefName.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'
import { OasBase } from '@/types/OasBase.ts'
import {
  changesValues,
  hasSiblingKeywords,
  mergeSiblingKeywords,
  isInlineLoop,
  type SiblingKeywords,
  toSkippedSiblings
} from '@/oas/schema/siblings.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

const MAX_LOOKUPS = 10

/**
 * Converts a ref type to its plural components path.
 */
function refTypeToPluralPath(refType: OasRefData['refType']): string {
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
 * What a reference reads from the parse context when it is made: the document
 * it resolves through, and the trail it records. `clone` passes them itself.
 */
type RefContext = Pick<ParseContextType, 'parsedDocument' | 'currentStackTrail'>

/**
 * Field data for creating OAS reference objects: the reference, its use-site
 * flags, and the other keywords next to it in a one-member `allOf`
 * (`{ allOf: [{ $ref }], minLength: 3, description: '…' }`), parsed without
 * the target's type (see {@link SiblingKeywords}). {@link OasRef.resolve}
 * applies the keywords to a copy of the target, so the shared target never
 * changes, and the reference stays lazy, so a self-reference still ends.
 *
 * @template T - The type of component being referenced (e.g., 'schema', 'response')
 */
export type RefFields<T extends OasRefData['refType']> = SiblingKeywords & {
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
export class OasRef<T extends OasRefData['refType']> extends OasBase {
  /** OAS type identifier */
  oasType: 'ref' = 'ref'
  /** Type identifier */
  type: 'ref' = 'ref'
  /** The kind of component the reference points to. */
  refType: T
  /** The JSON Reference: `#/components/<bucket>/<name>`. */
  $ref: string
  /**
   * Use-site nullability (see {@link SiblingKeywords.nullable}). Assigned
   * even when `undefined`, so `'nullable' in ref` is always true and the
   * value-function nullable read picks it up uniformly.
   */
  nullable: SiblingKeywords['nullable']
  /** Use-site `readOnly` (see {@link SiblingKeywords.readOnly}). */
  readOnly: SiblingKeywords['readOnly']
  /** Use-site `writeOnly` (see {@link SiblingKeywords.writeOnly}). */
  writeOnly: SiblingKeywords['writeOnly']
  /** The `type` written next to this reference (see {@link SiblingKeywords._type}). */
  _type: SiblingKeywords['_type']
  /** The `title` next to this reference (see {@link SiblingKeywords}). */
  title: SiblingKeywords['title']
  /** The `description` next to this reference (see {@link SiblingKeywords}). */
  description: SiblingKeywords['description']
  /** The `deprecated` next to this reference (see {@link SiblingKeywords}). */
  deprecated: SiblingKeywords['deprecated']
  /** The `example` next to this reference (see {@link SiblingKeywords}). */
  example: SiblingKeywords['example']
  /** The `default` next to this reference (see {@link SiblingKeywords}). */
  default: SiblingKeywords['default']
  /** The `enum` next to this reference (see {@link SiblingKeywords}). */
  enums: SiblingKeywords['enums']
  /** The extensions (`x-*`) next to this reference (see {@link SiblingKeywords}). */
  extensionFields: SiblingKeywords['extensionFields']
  /** The `format` next to this reference (see {@link SiblingKeywords}). */
  format: SiblingKeywords['format']
  /** The `minLength` next to this reference (see {@link SiblingKeywords}). */
  minLength: SiblingKeywords['minLength']
  /** The `maxLength` next to this reference (see {@link SiblingKeywords}). */
  maxLength: SiblingKeywords['maxLength']
  /** The `pattern` next to this reference (see {@link SiblingKeywords}). */
  pattern: SiblingKeywords['pattern']
  /** The `multipleOf` next to this reference (see {@link SiblingKeywords}). */
  multipleOf: SiblingKeywords['multipleOf']
  /** The `minimum` next to this reference (see {@link SiblingKeywords}). */
  minimum: SiblingKeywords['minimum']
  /** The `maximum` next to this reference (see {@link SiblingKeywords}). */
  maximum: SiblingKeywords['maximum']
  /** The `exclusiveMinimum` next to this reference (see {@link SiblingKeywords}). */
  exclusiveMinimum: SiblingKeywords['exclusiveMinimum']
  /** The `exclusiveMaximum` next to this reference (see {@link SiblingKeywords}). */
  exclusiveMaximum: SiblingKeywords['exclusiveMaximum']
  /** The `minItems` next to this reference (see {@link SiblingKeywords}). */
  minItems: SiblingKeywords['minItems']
  /** The `maxItems` next to this reference (see {@link SiblingKeywords}). */
  maxItems: SiblingKeywords['maxItems']
  /** The `uniqueItems` next to this reference (see {@link SiblingKeywords}). */
  uniqueItems: SiblingKeywords['uniqueItems']
  /** The `properties` next to this reference (see {@link SiblingKeywords}). */
  properties: SiblingKeywords['properties']
  /** The `required` next to this reference (see {@link SiblingKeywords}). */
  required: SiblingKeywords['required']
  /** The `additionalProperties` next to this reference (see {@link SiblingKeywords}). */
  additionalProperties: SiblingKeywords['additionalProperties']
  /** The `minProperties` next to this reference (see {@link SiblingKeywords}). */
  minProperties: SiblingKeywords['minProperties']
  /** The `maxProperties` next to this reference (see {@link SiblingKeywords}). */
  maxProperties: SiblingKeywords['maxProperties']
  #document: SkmtcParsedDocument

  /**
   * Creates a new OAS reference instance.
   *
   * @param fields - Reference field data including refType and $ref
   * @param context - The parse context, or what `clone` passes in its place:
   *   the discriminated document containing the referenced component (for
   *   OAS, refs resolve through the document's components; for GQL, through
   *   the document's registry, as GQL only ever creates schema refs) and the
   *   current trail.
   */
  constructor(fields: RefFields<T>, context: RefContext) {
    super(context)
    this.refType = fields.refType
    this.$ref = fields.$ref
    this.nullable = fields.nullable
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this._type = fields._type
    this.title = fields.title
    this.description = fields.description
    this.deprecated = fields.deprecated
    this.example = fields.example
    this.default = fields.default
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
    this.format = fields.format
    this.minLength = fields.minLength
    this.maxLength = fields.maxLength
    this.pattern = fields.pattern
    this.multipleOf = fields.multipleOf
    this.minimum = fields.minimum
    this.maximum = fields.maximum
    this.exclusiveMinimum = fields.exclusiveMinimum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minItems = fields.minItems
    this.maxItems = fields.maxItems
    this.uniqueItems = fields.uniqueItems
    this.properties = fields.properties
    this.required = fields.required
    this.additionalProperties = fields.additionalProperties
    this.minProperties = fields.minProperties
    this.maxProperties = fields.maxProperties
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
   * with protection against infinite loops. A schema reference returns the
   * schema at this site: the keywords next to it, and next to each reference
   * on the chain ({@link SiblingKeywords}), apply to a copy of the target.
   * Without siblings it returns the shared target itself. `resolveOnce()`
   * applies no siblings.
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
    const target = resolved.isRef() ? resolved.resolve(lookupsPerformed + 1) : resolved
    // Widened from the generic ResolvedRef<T>, so `oasType` narrows it.
    const component: OasComponentType = target

    // `oasType` narrows the target and `isSchemaRef()` this reference;
    // resolveOnce() has checked that the two agree.
    if (!this.hasSiblings() || component.oasType !== 'schema' || !this.isSchemaRef()) {
      return target
    }

    // A schema's copy is a schema of the same class. TypeScript cannot relate
    // OasSchema to ResolvedRef<T> for a generic T, as in resolveOnce().
    return component.clone(this) as ResolvedRef<T>
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
      throw new Error(`Ref "${this.$ref}" not found`)
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

  #resolveOasOnce(document: OasDocument, refName: RefName): ResolvedRef<T> | OasRef<T> | undefined {
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
      case 'link':
        return c?.links?.[refName] as ResolvedRef<T> | OasRef<T> | undefined
      default: {
        const _exhaustive: never = refType
        throw new Error(`Unhandled ref type: ${_exhaustive}`)
      }
    }
  }

  #resolveGqlOnce(document: GqlDocument, refName: RefName): ResolvedRef<T> | OasRef<T> | undefined {
    // GraphQL only ever creates schema refs — there's no GQL concept
    // of a response/parameter/header/etc. ref. The refType field is
    // still typed by `T` for the OAS variants; on the GQL branch we
    // always do a schema lookup and let the post-lookup refType-vs-
    // oasType check catch any caller that constructed a non-schema
    // ref pointing at a GQL document.
    return document.registry.schemas[refName] as ResolvedRef<T> | OasRef<T> | undefined
  }

  toRefName(): RefName {
    return toRefName(this.$ref)
  }

  /**
   * Narrows this reference to a schema reference.
   *
   * @returns True when this reference points at a schema component.
   */
  isSchemaRef(): this is OasRef<'schema'> {
    return this.refType === 'schema'
  }

  /**
   * Navigate an {@link SchemaPath} starting from this reference, resolving it
   * to descend through. See {@link traverseSchema}.
   *
   * Available on every `OasRef` so `.traverse()` works on the common
   * `OasSchema | OasRef<'schema'>` value (an object property, array `items`).
   * Schema paths only describe schemas for now, so it throws for non-schema
   * refs (response/parameter/…); {@link isSchemaRef} narrows `this`, keeping the
   * delegation cast-free.
   *
   * @returns The schema at the path (may be an unresolved `$ref`).
   * @throws Error when called on a non-schema ref.
   */
  traverse(path: SchemaPath): OasSchema | OasRef<'schema'> {
    if (!this.isSchemaRef()) {
      throw new Error(
        `Schema path traversal is not yet supported for "${this.refType}" refs (only schema refs)`
      )
    }

    return traverseSchema(this, path)
  }

  /**
   * Whether this reference adds anything at its site: a use-site flag
   * (`nullable`, `readOnly`, `writeOnly`) or another keyword next to it (see
   * {@link RefFields}). {@link resolve} then returns a copy of the target with
   * them applied, not the shared target.
   */
  hasSiblings(): boolean {
    return hasSiblingKeywords(this)
  }

  /**
   * A copy of this reference with what `ref` adds at its site merged in: its
   * flags, and its keywords over this reference's own
   * ({@link mergeSiblingKeywords}). It points at the same target. Each schema
   * class's `clone` does the same for a schema, so one step along a chain of
   * references can carry a site's keywords (`resolveSchemaRefOnce`). This
   * reference does not change.
   */
  clone(ref?: OasRef<'schema'>): OasRef<T> {
    const copy = new OasRef<T>(
      { refType: this.refType, $ref: this.$ref, ...mergeSiblingKeywords(this, ref) },
      { parsedDocument: this.#document, currentStackTrail: undefined }
    )
    copy.stackTrail = this.stackTrail

    return copy
  }

  /**
   * Whether the keywords next to this reference change which values it
   * accepts (`minLength` next to a string, `properties` next to an object),
   * not only how it is described (`description`, `deprecated`, `x-*`). No
   * shared model accepts the same values as such a site, so a generator that
   * refers to models by name renders it from {@link resolve}. See
   * {@link changesValues}.
   */
  hasValueSiblings(): boolean {
    if (!this.hasSiblings()) {
      return false
    }

    const component: OasComponentType = this.resolve()

    return component.oasType === 'schema' && changesValues(component, this)
  }

  /**
   * The keywords next to this reference that {@link resolve} leaves out, by
   * their names in the document: ones the target's type does not take
   * (`minLength` next to an array), a `type` that disagrees, and values that
   * do not fit. The parser cannot tell them while the reference is lazy, so a
   * generator logs them when it renders the site. See {@link toSkippedSiblings}.
   */
  toSkippedSiblings(): string[] {
    if (!this.hasSiblings()) {
      return []
    }

    const component: OasComponentType = this.resolve()

    return component.oasType === 'schema' ? toSkippedSiblings(component, this, component.nullable) : []
  }

  /**
   * Whether rendering this site from {@link resolve} would not end: the copy
   * reaches, through other sites with {@link hasValueSiblings}, a reference
   * to a model already being rendered that way. `false` for a reference to
   * anything but a schema. See {@link isInlineLoop}.
   */
  isSiblingLoop(): boolean {
    return this.isSchemaRef() && isInlineLoop(this)
  }

  /**
   * Whether the value is `readOnly` at this site, as Forge reads it: on this
   * reference (`{ allOf: [{ $ref }], readOnly: true }`), or on what it points
   * to, through any chain of references. A `readOnly: false` does not undo
   * another's `true`. `false` for a reference to anything but a schema.
   *
   * @param lookupsPerformed - Internal counter that stops a chain of references with no schema
   */
  isReadOnly(lookupsPerformed: number = 0): boolean {
    if (this.readOnly === true) {
      return true
    }

    if (lookupsPerformed >= MAX_LOOKUPS) {
      return false
    }

    const resolved = this.resolveOnce()

    return resolved.isRef() ? resolved.isReadOnly(lookupsPerformed + 1) : resolved.isReadOnly()
  }

  /**
   * Whether the value is `writeOnly` at this site: on this reference, or on
   * what it points to, as {@link isReadOnly} reads `readOnly`.
   *
   * @param lookupsPerformed - Internal counter that stops a chain of references with no schema
   */
  isWriteOnly(lookupsPerformed: number = 0): boolean {
    if (this.writeOnly === true) {
      return true
    }

    if (lookupsPerformed >= MAX_LOOKUPS) {
      return false
    }

    const resolved = this.resolveOnce()

    return resolved.isRef() ? resolved.isWriteOnly(lookupsPerformed + 1) : resolved.isWriteOnly()
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

  /**
   * The reference as JSON Schema. With `resolve`, the schema at this site,
   * with the keywords next to the reference applied. Without it, only
   * `{ $ref }`: the keywords next to the reference are not written yet
   * (skmtc/skmtc#338).
   */
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

  /** `{ $ref }` only, as {@link toJsonSchema} without `resolve` (skmtc/skmtc#338). */
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
  | OasLink

/**
 * Type representing a resolved reference to a specific component type.
 *
 * @template T - The type of component being referenced (e.g., 'schema', 'response')
 */
export type ResolvedRef<T extends OasRefData['refType']> = Extract<OasComponentType, { oasType: T }>
