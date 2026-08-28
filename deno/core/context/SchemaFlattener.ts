import type { OpenAPIV3 } from 'openapi-types'
import { isRef, toGetRef, toRefName } from '@/helpers/refFns.ts'

type SchemaObject = OpenAPIV3.SchemaObject
type Resolve = (ref: OpenAPIV3.ReferenceObject) => SchemaObject
type MergeIntersection = (args: {
  schema: SchemaObject
  getRef: Resolve
}) => SchemaObject | OpenAPIV3.ReferenceObject

/**
 * Flattens each component's `allOf` once, by name, and hands the merge
 * layer the flattened form of every schema it copies in.
 *
 * Three things, each one sentence:
 *
 * - **Memo.** A component is flattened at most once per parse; every later
 *   copy of it reuses the result (a diamond, `A: allOf [B, C]` with
 *   `B: allOf [C]`, copies `C` twice and is fine).
 * - **Grey set.** A component whose flattening is in progress and is asked
 *   for again is a cycle with no finite reading (`A: allOf [B]`,
 *   `B: allOf [A]`); it is refused with the chain named.
 * - **Base.** A component whose union lists its own subclasses is copied in
 *   as the base `normalizeComposition` set aside for it — its keywords minus
 *   that list: the schema being built IS one of the branches.
 *
 * Inline `allOf`s that would loop are given names before the parser runs,
 * so everything recursive arrives here by name. Until
 * {@link SchemaFlattener.use} is called (a context built for a test double,
 * say) nothing is eliminated.
 */
export class SchemaFlattener {
  #resolve: Resolve = () => ({})
  #mergeIntersection: MergeIntersection | undefined
  #bases = new Map<string, SchemaObject>()
  #flattened = new Map<string, SchemaObject>()
  #grey: string[] = []

  /** Bind the document, the subclass-list bases, and the parser tree's merge layer for this parse. */
  use(
    document: OpenAPIV3.Document,
    bases: Map<string, SchemaObject>,
    mergeIntersection: MergeIntersection
  ): void {
    this.#resolve = toGetRef(document)
    this.#bases = bases
    this.#mergeIntersection = mergeIntersection
    this.#flattened.clear()
  }

  /** The merge layer's resolver: a schema arrives flattened; a parent that lists its subclasses arrives as its base. */
  readonly getRef: Resolve = ref => {
    const name = toRefName(ref.$ref)

    return this.#bases.get(name) ?? this.flatten(name)
  }

  /**
   * The component with its own multi-member `allOf` eliminated, memoised.
   * `raw` is the component's schema when the caller has it (the components
   * walk does); otherwise it is looked up by name.
   */
  flatten(name: string, raw?: SchemaObject): SchemaObject {
    const done = this.#flattened.get(name)

    if (done !== undefined) {
      return done
    }

    if (this.#grey.includes(name)) {
      throw new Error(`Cyclic allOf: ${[...this.#grey, name].join(' -> ')}`)
    }

    const schema = raw ?? this.#resolve({ $ref: `#/components/schemas/${name}` })
    this.#grey.push(name)

    try {
      const result = this.#eliminate(schema)
      this.#flattened.set(name, result)

      return result
    } finally {
      this.#grey.pop()
    }
  }

  #eliminate(raw: SchemaObject): SchemaObject {
    const merge = this.#mergeIntersection

    if (merge === undefined || !Array.isArray(raw.allOf) || raw.allOf.length < 2) {
      return raw
    }

    const merged = merge({ schema: raw, getRef: this.getRef })

    return isRef(merged) ? this.getRef(merged) : merged
  }
}
