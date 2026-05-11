import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { GqlRootTypes } from '@/gql/rootType/GqlRootTypes.ts'
import type { OasInfo } from '@/oas/info/Info.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasUnion } from '@/oas/union/Union.ts'

/**
 * Fields used to construct (or populate) a {@link GqlDocument}.
 */
export type GqlDocumentFields = {
  /** Type registry containing all named GraphQL types as OAS schema objects. */
  registry: GqlRegistry
  /** Root-level fields exposed as Query, Mutation, or Subscription. */
  operations: GqlOperation[]
  /** Names of the root operation types (Query, Mutation, Subscription). */
  rootTypes: GqlRootTypes
  /** Schema-level metadata (title, version, description). Optional. */
  info?: OasInfo
}

/**
 * Top-level container for a parsed GraphQL schema.
 *
 * `GqlDocument` is the GraphQL counterpart to {@link OasDocument}. It owns
 * a {@link GqlRegistry} (the named-type registry, parallel to
 * `OasComponents.schemas`), the list of root-level fields exposed as
 * {@link GqlOperation} entries, and pointers to the schema's root operation
 * types.
 *
 * Both documents are wrapped by {@link SkmtcParsedDocument} so the pipeline
 * can carry either through the same generate phase.
 *
 * ## Empty-at-construction
 *
 * Like {@link OasDocument}, `GqlDocument` is intentionally constructable
 * without fields — the parser creates an empty instance up front, hands
 * out `OasRef`s that resolve through it, then populates
 * `gqlDocument.fields = { ... }` at the end of parsing. See the
 * "forward-declared refs" section on {@link OasDocument} for the full
 * rationale; the short version is that refs need a stable resolution
 * target *before* every target has been parsed, so the document and the
 * refs that point at it must both be constructable up front and tied to
 * the same instance.
 */
export class GqlDocument {
  readonly oasType = 'gqlDocument' as const

  /** @internal Private fields storage — set after parsing. */
  #fields: GqlDocumentFields | undefined

  /**
   * Creates a new GqlDocument instance.
   *
   * The document is typically created without fields and populated later
   * during parsing. See the class-level docstring for why.
   */
  constructor(fields?: GqlDocumentFields) {
    this.#fields = fields
  }

  /**
   * Populates the document's fields after parsing.
   */
  set fields(fields: GqlDocumentFields) {
    this.#fields = fields
  }

  /** Named-type registry. */
  get registry(): GqlRegistry {
    if (!this.#fields) {
      throw new Error(`Accessing 'registry' before fields are set`)
    }
    return this.#fields.registry
  }

  /** Root-field operations. */
  get operations(): GqlOperation[] {
    if (!this.#fields) {
      throw new Error(`Accessing 'operations' before fields are set`)
    }
    return this.#fields.operations
  }

  /** Pointers to the schema's root operation types. */
  get rootTypes(): GqlRootTypes {
    if (!this.#fields) {
      throw new Error(`Accessing 'rootTypes' before fields are set`)
    }
    return this.#fields.rootTypes
  }

  /** Optional schema-level metadata. */
  get info(): OasInfo | undefined {
    if (!this.#fields) {
      throw new Error(`Accessing 'info' before fields are set`)
    }
    return this.#fields.info
  }

  /**
   * Removes the consumer addressed by `stackTrail`. Parallel to
   * {@link OasDocument.removeItem}; used by
   * `ParseContext.removeErroredItems` to prune references whose target
   * type failed to parse.
   *
   * Two consumer shapes are handled today:
   *
   * - `[<RootType>, <fieldName>, …]` where `<RootType>` matches one of
   *   `rootTypes.{query,mutation,subscription}` → the matching
   *   {@link GqlOperation} is removed from `operations`.
   * - `[<ParentType>, <fieldName>, …]` where `<ParentType>` is a
   *   registered object/input/interface → the named field is deleted
   *   from the parent's properties (and from its `required` list if
   *   present). The deeper segments of the stack trail are ignored,
   *   matching `OasDocument.removeItem`'s coarse-grained behaviour.
   * - `[<UnionType>, members, <index>]` where `<UnionType>` is a
   *   registered union or interface union → the indexed member is
   *   removed.
   *
   * Returns the removed entity (`GqlOperation`, the removed property
   * schema, or the removed union member) when removal happened, or
   * `undefined` if no matching consumer was found. The return value
   * acts as the truthy signal `removeErroredItems` uses to decide
   * whether to emit an `INVALID_DEPENDENCY_REF` issue.
   */
  removeItem(stackTrail: StackTrail): unknown {
    if (!this.#fields) {
      // Mirrors OasDocument's behaviour: prune calls before fields are
      // set are a no-op, matching the "empty-at-construction" contract.
      return undefined
    }
    const path = stackTrail.stackTrail
    if (path.length < 2) return undefined

    const [first, second, third] = path
    if (typeof first !== 'string' || typeof second !== 'string') return undefined

    const { registry, operations, rootTypes } = this.#fields

    // Case 1: root-field operation removal.
    const isRootType =
      first === rootTypes.query || first === rootTypes.mutation || first === rootTypes.subscription
    if (isRootType) {
      const index = operations.findIndex(op => op.fieldName === second)
      if (index === -1) return undefined
      const [removed] = operations.splice(index, 1)
      return removed
    }

    // Case 2: union or interface-union member removal at `[Type, members, index]`.
    if (second === 'members' && typeof third === 'string') {
      const parent = registry.schemas[first as keyof typeof registry.schemas]
      if (parent instanceof OasUnion) {
        const idx = Number.parseInt(third, 10)
        if (!Number.isFinite(idx) || idx < 0 || idx >= parent.members.length) return undefined
        const [removed] = parent.members.splice(idx, 1)
        return removed
      }
      return undefined
    }

    // Case 3: field-of-object removal at `[ParentType, fieldName]` (deeper
    // segments ignored).
    const parent = registry.schemas[first as keyof typeof registry.schemas]
    if (parent instanceof OasObject) {
      const properties = parent.properties
      if (!properties || !(second in properties)) return undefined
      const removed = properties[second]
      delete properties[second]
      if (parent.required) {
        const i = parent.required.indexOf(second)
        if (i !== -1) parent.required.splice(i, 1)
      }
      return removed
    }

    return undefined
  }
}
