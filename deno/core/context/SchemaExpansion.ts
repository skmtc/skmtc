import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

/**
 * A schema whose composition is being eliminated right now — a named
 * component while `toSchemasV3` builds it, or an inline multi-member
 * `allOf` while `toSchemaV3` merges it. Keyed by the RAW document node, so
 * the same node reached again through a copied property (the merge copies
 * property values by reference) is recognised as a re-entry.
 */
type Entry = {
  /** The component key, or the synthesized name for an inline `allOf`. */
  name: string
  /** True once the `allOf` branch has started merging this node. */
  building: boolean
  /** True once a re-entry has emitted a `$ref` to `name`. */
  referenced: boolean
}

type Synthesized = {
  raw: OpenAPIV3.SchemaObject
  node: OasSchema | OasRef<'schema'>
}

/**
 * Per-parse record of which schemas are currently being expanded, and of
 * the schemas the parser had to name itself.
 *
 * Why it exists: `allOf` is eliminated at parse time by copying each member
 * in, and a wrapper's keywords are pushed into its union members the same
 * way. Both copy `$ref` targets inline, and on a cyclic document that copy
 * never bottoms out (skmtc/skmtc#122). The fix is the one every other
 * generator applies: a recursive structure gets a NAME, and the recursion
 * becomes a reference to that name. Components already have names; an
 * inline `allOf` that turns out to be recursive is given one here, derived
 * from its location, and registered as a component at the end of the parse
 * (see `ParseContext.parse`).
 */
export class SchemaExpansion {
  #entries = new Map<object, Entry>()
  #byName = new Map<string, Entry>()
  #synthesized = new Map<string, Synthesized>()

  /** Run `fn` with `raw` recorded as the schema named `name` being built. */
  enter<T>(raw: object, name: string, fn: () => T): T {
    const existing = this.#entries.get(raw)

    if (existing) {
      return fn()
    }

    const entry: Entry = { name, building: false, referenced: false }
    this.#entries.set(raw, entry)
    this.#byName.set(name, entry)

    try {
      return fn()
    } finally {
      this.#entries.delete(raw)
      this.#byName.delete(name)
    }
  }

  /** The name `raw` is being built under, if it is being built at all. */
  nameOf(raw: object): string | undefined {
    return this.#entries.get(raw)?.name
  }

  /** Is a schema with this component name currently being built? */
  isActive(name: string): boolean {
    return this.#byName.has(name)
  }

  /**
   * Is the schema with this name currently having its own `allOf`
   * eliminated? Copying it in as a base at that moment is a true cycle
   * (`A: allOf [B]`, `B: allOf [A]`); copying it in while it is merely
   * being built — say, while its union's members are parsed — is the
   * legitimate recursion a named component resolves.
   */
  isBuildingName(name: string): boolean {
    return this.#byName.get(name)?.building === true
  }

  /**
   * Has the `allOf` branch already started merging `raw`? A second visit
   * while this is true is a re-entry.
   */
  isBuilding(raw: object): boolean {
    return this.#entries.get(raw)?.building === true
  }

  startBuilding(raw: object): void {
    const entry = this.#entries.get(raw)

    if (entry) {
      entry.building = true
    }
  }

  /** Record that a re-entry emitted a `$ref` to this node's name. */
  markReferenced(raw: object): void {
    const entry = this.#entries.get(raw)

    if (entry) {
      entry.referenced = true
    }
  }

  wasReferenced(raw: object): boolean {
    return this.#entries.get(raw)?.referenced === true
  }

  /** Register a parser-named schema so refs to `name` resolve. */
  synthesize(name: string, raw: OpenAPIV3.SchemaObject, node: OasSchema | OasRef<'schema'>): void {
    this.#synthesized.set(name, { raw, node })
  }

  /** The raw document node behind a synthesized name, for the merge layer's resolver. */
  synthesizedRaw(name: string): OpenAPIV3.SchemaObject | undefined {
    return this.#synthesized.get(name)?.raw
  }

  /** Every synthesized schema, for registration into `components.schemas`. */
  synthesizedEntries(): [string, OasSchema | OasRef<'schema'>][] {
    return [...this.#synthesized].map(([name, { node }]) => [name, node])
  }
}

const expansions = new WeakMap<object, SchemaExpansion>()

/**
 * The expansion record for a parse. Stored beside the context rather than
 * on it so the many hand-rolled `ParseContextType` stubs in tests keep
 * working unchanged; one record per context object for its lifetime.
 */
export const toSchemaExpansion = (context: ParseContextType): SchemaExpansion => {
  const existing = expansions.get(context)

  if (existing) {
    return existing
  }

  const created = new SchemaExpansion()
  expansions.set(context, created)

  return created
}

const PHASE_FRAMES = new Set(['parse', 'generate', 'render', 'post-pass'])

/**
 * The name given to a recursive inline `allOf`, from where it sits in the
 * document: the document-relative frames joined with `~`, minus a leading
 * `components/schemas` (so a schema under `Foo` reads as `Foo~…`). Stable
 * across parses of the same document, which matters because enrichments and
 * generated identifiers key on it. `~` is chosen because authors do not use
 * it in component names and `camelCase` treats it as a word break.
 *
 * @example
 * ```typescript
 * toSynthesizedName(new StackTrail(['components', 'schemas', 'matches-json-path-pattern',
 *   'properties', 'matchesJsonPath', 'oneOf', '1']))
 * // 'matches-json-path-pattern~properties~matchesJsonPath~oneOf~1'
 * ```
 */
export const toSynthesizedName = (stackTrail: StackTrail): string => {
  const frames = stackTrail.stackTrail
  const phaseIndex = frames.findIndex(frame => PHASE_FRAMES.has(frame))
  const documentFrames = phaseIndex === -1 ? frames : frames.slice(phaseIndex + 1)
  const [first, second, ...rest] = documentFrames
  const named = first === 'components' && second === 'schemas' ? rest : documentFrames

  return named.map(frame => frame.replaceAll(/[~/]/g, '-')).join('~')
}
