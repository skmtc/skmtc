import type { OasSchema } from '@/oas/schema/Schema.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

/**
 * Fields used to construct a {@link GqlRegistry}.
 */
export type GqlRegistryFields = {
  /**
   * Initial set of named-type entries. The registry holds a live reference
   * to this record — additions made via {@link GqlRegistry.add} are visible
   * to anything that reads `registry.schemas` later.
   */
  schemas?: Record<RefName, OasSchema | OasRef<'schema'>>
}

/**
 * The named-type registry for a {@link GqlDocument}.
 *
 * `GqlRegistry` mirrors the schemas bucket of `OasComponents` — it is the
 * registry side of the lingua franca that both protocols share. Model
 * generators read from it via the discriminated dispatch in
 * `GenerateContext`.
 *
 * Refs resolve through the parent {@link GqlDocument} via
 * {@link SkmtcParsedDocument}'s GQL variant — no fake `OasDocument`
 * mirror needed. `createRef` takes the document at call time so the
 * resulting `OasRef` points at the same instance that will eventually
 * carry the populated registry. See the forward-declared-refs notes on
 * `OasDocument` / `GqlDocument` for why the document must exist (empty)
 * before any ref is constructed.
 */
export class GqlRegistry {
  readonly schemas: Record<RefName, OasSchema | OasRef<'schema'>>

  constructor(fields: GqlRegistryFields = {}) {
    this.schemas = fields.schemas ?? {}
  }

  /**
   * Returns all RefNames currently registered, in insertion order.
   *
   * Mirrors `OasComponents.toSchemasRefNames()` so model generators can
   * iterate the registry uniformly across protocols.
   */
  toSchemasRefNames(): RefName[] {
    return Object.keys(this.schemas) as RefName[]
  }

  /**
   * Adds (or replaces) a schema entry under `refName`.
   *
   * The mutation is visible to any previously constructed `OasRef` that
   * resolves through this registry, because resolution reads through the
   * shared `schemas` record by reference.
   */
  add(refName: RefName, schema: OasSchema | OasRef<'schema'>): void {
    this.schemas[refName] = schema
  }

  /**
   * Returns true if `refName` is currently registered.
   */
  has(refName: RefName): boolean {
    return refName in this.schemas
  }

  /**
   * Constructs an `OasRef<'schema'>` that resolves to the entry registered
   * under `refName`. Use this to build cross-type references during
   * GraphQL parsing instead of constructing `OasRef` directly.
   *
   * The ref resolves through the context's `parsedDocument` (the parent
   * `GqlDocument` wrapped as `SkmtcParsedDocument`). The document can be
   * empty-at-construction; the ref resolves correctly once the document's
   * fields are populated at the end of parsing.
   */
  createRef(refName: RefName, context: ParseContextType): OasRef<'schema'> {
    return new OasRef<'schema'>(
      { refType: 'schema', $ref: `#/components/schemas/${refName}` },
      context
    )
  }

  /**
   * Removes a schema entry by name. Returns `true` if removed.
   */
  removeSchema(refName: RefName): boolean {
    if (refName in this.schemas) {
      delete this.schemas[refName]
      return true
    }
    return false
  }
}
