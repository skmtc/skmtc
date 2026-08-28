import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toGetRef, toRefName } from '@/helpers/refFns.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type Resolve = (ref: OpenAPIV3.ReferenceObject) => SchemaObject
type MergeIntersection = (args: {
  schema: SchemaObject
  getRef: Resolve
}) => SchemaObject | OpenAPIV3.ReferenceObject

/**
 * The one place a multi-member `allOf` is eliminated. The `allOf` branch of
 * `toSchemaV3` calls {@link SchemaFlattener.eliminate}; the merge layer,
 * copying a base in, calls {@link SchemaFlattener.getRef}, which arrives
 * back here by name. Both paths share one memo, so a component's `allOf`
 * is merged once per parse however many times it is copied.
 *
 * Three things, each one sentence:
 *
 * - **Memo.** A schema node is eliminated at most once per parse; every
 *   later copy of it reuses the result (a diamond, `A: allOf [B, C]` with
 *   `B: allOf [C]`, copies `C` twice and is fine).
 * - **Grey set.** A component whose elimination is in progress and is
 *   copied in again is a cycle with no finite reading (`A: allOf [B]`,
 *   `B: allOf [A]`); it is refused with the chain named.
 * - **Base.** A component whose union lists its own subclasses is copied
 *   in as the base `normalizeComposition` set aside for it — its keywords
 *   minus that list: the schema being built IS one of the branches.
 *
 * Inline `allOf`s that would loop are given names before the parser runs,
 * so everything recursive arrives here by name.
 */
export class SchemaFlattener {
  #resolve: Resolve = () => ({})
  #names = new WeakMap<object, string>()
  #bases = new Map<string, SchemaObject>()
  #merge: MergeIntersection | undefined
  #done = new WeakMap<object, SchemaObject>()
  #grey: string[] = []

  /** Bind the document and the subclass-list bases for this parse. */
  use(document: OpenAPIV3.Document, bases: Map<string, SchemaObject>): void {
    this.#resolve = toGetRef(document)
    this.#bases = bases
    this.#names = new WeakMap()
    this.#done = new WeakMap()

    for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
      if (schema !== null && typeof schema === 'object') {
        this.#names.set(schema, name)
      }
    }
  }

  /**
   * `schema` with its multi-member `allOf` merged away, using the parser
   * tree's own merge layer. A component root is marked grey by name while
   * it merges, so a base that leads back to it is refused as a cycle.
   */
  eliminate(schema: SchemaObject, merge: MergeIntersection): SchemaObject {
    this.#merge = merge

    const done = this.#done.get(schema)

    if (done !== undefined) {
      return done
    }

    const name = this.#names.get(schema)

    if (name !== undefined && this.#grey.includes(name)) {
      throw new Error(`Cyclic allOf: ${[...this.#grey, name].join(' -> ')}`)
    }

    if (name !== undefined) {
      this.#grey.push(name)
    }

    try {
      const merged = merge({ schema, getRef: this.getRef })
      const result = isRef(merged) ? this.getRef(merged) : merged
      this.#done.set(schema, result)

      return result
    } finally {
      if (name !== undefined) {
        this.#grey.pop()
      }
    }
  }

  /** The merge layer's resolver: a schema arrives eliminated; a parent that lists its subclasses arrives as its base. */
  readonly getRef: Resolve = ref => {
    const name = toRefName(ref.$ref)
    const base = this.#bases.get(name)

    if (base !== undefined) {
      return base
    }

    const raw = this.#resolve(ref)
    const merge = this.#merge

    if (merge === undefined || !Array.isArray(raw.allOf) || raw.allOf.length < 2) {
      return raw
    }

    return this.eliminate(raw, merge)
  }
}
