import type { OasSchema } from '@/oas/schema/Schema.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasInfo } from '@/oas/info/Info.ts'

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
 * Internally the registry owns an `OasDocument` mirror that exists solely
 * to back `OasRef` resolution. Cross-type references in a parsed GraphQL
 * schema are constructed via {@link GqlRegistry.createRef} and resolve
 * through the internal mirror; consumers never see the mirror, they just
 * see `registry.schemas`. This keeps the public registry surface narrow
 * while reusing OAS's well-tested ref machinery untouched.
 */
export class GqlRegistry {
  readonly schemas: Record<RefName, OasSchema | OasRef<'schema'>>

  /**
   * Internal `OasDocument` whose `components.schemas` is the same record
   * as {@link GqlRegistry.schemas}. Used by {@link GqlRegistry.createRef}
   * to construct refs that resolve through this registry.
   */
  readonly #refDocument: OasDocument

  constructor(fields: GqlRegistryFields = {}) {
    this.schemas = fields.schemas ?? {}

    this.#refDocument = new OasDocument({
      openapi: '3.0.0',
      info: new OasInfo({ title: '__gql_registry__', version: '0.0.0' }),
      operations: [],
      components: new OasComponents({ schemas: this.schemas })
    })
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
   * GraphQL parsing instead of constructing `OasRef` directly — the
   * registry's internal `OasDocument` mirror is wired in for you.
   */
  createRef(refName: RefName): OasRef<'schema'> {
    return new OasRef<'schema'>(
      { refType: 'schema', $ref: `#/components/schemas/${refName}` },
      this.#refDocument
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
