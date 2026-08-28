import type { OpenAPIV3 } from 'openapi-types'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

type Synthesized = {
  raw: OpenAPIV3.SchemaObject
  node: OasSchema | OasRef<'schema'>
}

/**
 * How many nested `allOf` copies (or nested `allOf` eliminations) the parser
 * tolerates before calling the document cyclic. Real inheritance chains are
 * a handful deep; a runaway copy reaches this in milliseconds and is refused
 * with a message that names the chain, instead of overflowing the stack
 * where `mergeCrossProduct`'s catch would swallow it.
 */
const MAX_DEPTH = 64

/**
 * Per-parse record of which schemas are being built, which of them are
 * being COPIED right now, and the schemas the parser named itself.
 *
 * Why it exists: `allOf` is eliminated at parse time by copying each member
 * in, and a union wrapper's keywords are pushed into its `$ref` members the
 * same way. Both copy `$ref` targets inline, and on a cyclic document that
 * copy never bottoms out (skmtc/skmtc#122). The rule that stops it is the
 * one every other generator applies: a schema that is being built resolves
 * to a REFERENCE, never to a copy. Components already have names; an inline
 * `allOf` that turns out to be recursive is given one here, from its
 * location, and registered as a component at the end of the parse (see
 * `ParseContext.parse`).
 *
 * Three sets, because three questions get asked:
 *
 * - **hosts** — components being built (`toSchemasV3`). Asked by the union
 *   wrapper merge: a member that refers to a host cannot have the wrapper's
 *   keywords pushed into it (that would copy the host), so it is kept as a
 *   reference.
 * - **the chain** — schemas whose `allOf` is being merged: a component's own
 *   `allOf`, an inline `allOf` (by node identity), or any `$ref` copied in as
 *   a base along the way. Asked by the resolver: a base's union that names a
 *   chain member is stripped (that member is the branch being built), and a
 *   chain member met again is a cycle to refer to by name, never to copy.
 * - **names** — a memo from raw node to the name it was first built under,
 *   so the same recursive inline `allOf` reached again by another path gets
 *   the same name rather than a second component.
 */
export class SchemaExpansion {
  #document: OpenAPIV3.Document | undefined
  #locations: WeakMap<object, string[]> | undefined
  #hosts = new Map<object, string>()
  #hostNames = new Set<string>()
  #chainNames: string[] = []
  #chainNodes = new Map<object, string>()
  #eliminating = new Set<string>()
  #owners = new WeakMap<object, string>()
  #eliminations = 0
  #names = new Map<object, string>()
  #referenced = new Set<object>()
  #synthesized = new Map<string, Synthesized>()
  #synthesizedNames = new Map<object, string>()

  constructor(document?: OpenAPIV3.Document) {
    this.#document = document
  }

  /** Run `fn` with `raw` recorded as the component `name` being built. */
  enterHost<T>(raw: object, name: string, fn: () => T): T {
    if (this.#hosts.has(raw)) {
      return fn()
    }

    this.#hosts.set(raw, name)
    this.#hostNames.add(name)

    try {
      return fn()
    } finally {
      this.#hosts.delete(raw)
      this.#hostNames.delete(name)
    }
  }

  /** The component name `raw` is the root of, while it is being built. */
  hostNameOf(raw: object): string | undefined {
    return this.#hosts.get(raw)
  }

  /**
   * The name `raw` is known by: a component being built, a name it was
   * given as a recursive inline `allOf`, or the name of the elimination
   * whose merged result it is (see {@link SchemaExpansion.alias}).
   */
  nameOf(raw: object): string | undefined {
    return this.#hosts.get(raw) ?? this.#names.get(raw)
  }

  /** Is a schema with this name being built or copied right now? */
  isActive(name: string): boolean {
    return this.#hostNames.has(name) || this.#chainNames.includes(name)
  }

  /**
   * Is this name a base being copied in right now, or a schema whose `allOf`
   * is being merged? Either way its union, met in a base, is the branch
   * being built.
   */
  onChain(name: string): boolean {
    return this.#chainNames.includes(name) || this.#eliminating.has(name)
  }

  /**
   * Is this name's own `allOf` being merged right now? Copying it in as a
   * base at that moment is a true cycle (`A: allOf [B]`, `B: allOf [A]`).
   * Merely being a sibling base of the same intersection is not — a diamond
   * (`A: allOf [B, C]`, `B: allOf [C]`) copies `C` twice and is fine.
   */
  isEliminating(name: string): boolean {
    return this.#eliminating.has(name)
  }

  /** Run `fn` as the merge of the `allOf` of the schema named `name`. */
  withEliminating<T>(name: string, fn: () => T): T {
    if (this.#eliminating.has(name)) {
      return fn()
    }

    this.#eliminating.add(name)

    try {
      return fn()
    } finally {
      this.#eliminating.delete(name)
    }
  }

  /**
   * Remember which component an `allOf` array belongs to. The merge copies a
   * resolved schema with `{ ...target }`, which keeps the ARRAY by reference,
   * so a copy's `allOf` still says whose it is — and eliminating that copy
   * is eliminating that component (its parent's union names it).
   */
  rememberOwner(allOf: object, name: string): void {
    if (!this.#owners.has(allOf)) {
      this.#owners.set(allOf, name)
    }
  }

  ownerOf(allOf: object): string | undefined {
    return this.#owners.get(allOf)
  }

  /** The name an inline `allOf` node is being merged under, if it is. */
  chainNameOf(raw: object): string | undefined {
    return this.#chainNodes.get(raw)
  }

  /**
   * Run `fn` with `names` on the chain — the `$ref` bases an `allOf` is
   * copying in. Nested past {@link MAX_DEPTH} the document is cyclic in a
   * way nothing above caught; refuse it with the chain spelled out.
   */
  withChain<T>(names: string[], fn: () => T): T {
    const added = names.filter(name => !this.#chainNames.includes(name))
    this.#chainNames.push(...added)

    try {
      this.#assertDepth()
      return fn()
    } finally {
      this.#chainNames.splice(this.#chainNames.length - added.length, added.length)
    }
  }

  /**
   * Run `fn` as the elimination of the `allOf` at `raw`, known as `name`.
   * Puts both the name and the node on the chain for the duration.
   */
  withElimination<T>(name: string, raw: object, fn: () => T): T {
    this.#chainNodes.set(raw, name)
    this.#eliminations += 1

    try {
      return this.withChain([name], () =>
        this.withEliminating(name, () => {
          this.#assertDepth()
          return fn()
        })
      )
    } finally {
      this.#eliminations -= 1
      this.#chainNodes.delete(raw)
    }
  }

  /**
   * The name for the inline `allOf` at `raw`: the one it was first built
   * under, or a new one from `stackTrail`. First name wins, for the life of
   * the parse, so a node reached by several paths is one schema.
   */
  nameFor(raw: object, stackTrail: StackTrail): string {
    const existing = this.#names.get(raw)

    if (existing !== undefined) {
      return existing
    }

    // Name the node from where the AUTHOR put it, not from the path of the
    // visit that happened to reach it first — a copy of its host, parsed
    // earlier, would otherwise decide the name, and component order would
    // change it.
    const frames = this.#locate(raw) ?? stackTrail.stackTrail
    const name = toSynthesizedName(frames)
    this.#names.set(raw, name)

    return name
  }

  #locate(raw: object): string[] | undefined {
    if (this.#document === undefined) {
      return undefined
    }

    if (this.#locations === undefined) {
      this.#locations = new WeakMap()
      const schemas = this.#document.components?.schemas ?? {}

      for (const [key, schema] of Object.entries(schemas)) {
        indexNodes(schema, ['components', 'schemas', key], this.#locations)
      }

      indexNodes(this.#document.paths, ['paths'], this.#locations)
    }

    return this.#locations.get(raw)
  }

  /** Let `raw` (a merge result) answer to `name` — the schema it was built from. */
  alias(raw: object, name: string): void {
    this.#names.set(raw, name)
  }

  /** Record that a re-entry emitted a `$ref` to this node's name. */
  markReferenced(raw: object): void {
    this.#referenced.add(raw)
  }

  wasReferenced(raw: object): boolean {
    return this.#referenced.has(raw)
  }

  /** Register a parser-named schema so refs to `name` resolve. */
  synthesize(name: string, raw: OpenAPIV3.SchemaObject, node: OasSchema | OasRef<'schema'>): void {
    this.#synthesized.set(name, { raw, node })
    this.#synthesizedNames.set(raw, name)
  }

  /** The name `raw` was already synthesized under, if it was. */
  synthesizedNameFor(raw: object): string | undefined {
    return this.#synthesizedNames.get(raw)
  }

  /** The raw document node behind a synthesized name, for the merge layer's resolver. */
  synthesizedRaw(name: string): OpenAPIV3.SchemaObject | undefined {
    return this.#synthesized.get(name)?.raw
  }

  /** Every synthesized schema, for registration into `components.schemas`. */
  synthesizedEntries(): [string, OasSchema | OasRef<'schema'>][] {
    return [...this.#synthesized].map(([name, { node }]) => [name, node])
  }

  /** Forget a synthesized schema that turned out to depend on a failed one. */
  dropSynthesized(name: string): void {
    const entry = this.#synthesized.get(name)

    if (entry) {
      this.#synthesized.delete(name)
      this.#synthesizedNames.delete(entry.raw)
    }
  }

  #assertDepth(): void {
    if (this.#chainNames.length > MAX_DEPTH || this.#eliminations > MAX_DEPTH) {
      throw new Error(`Cyclic composition: ${this.#chainNames.join(' -> ')}`)
    }
  }
}

const PHASE_FRAMES = new Set(['parse', 'generate', 'render', 'post-pass'])

/** Record the document path of every object node under `value`; first path wins. */
const indexNodes = (value: unknown, frames: string[], into: WeakMap<object, string[]>): void => {
  if (value === null || typeof value !== 'object') {
    return
  }

  if (into.has(value)) {
    return
  }

  into.set(value, frames)

  const entries = Array.isArray(value)
    ? value.map((item, index): [string, unknown] => [`${index}`, item])
    : Object.entries(value)

  for (const [key, child] of entries) {
    indexNodes(child, [...frames, key], into)
  }
}

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
 * toSynthesizedName(['components', 'schemas', 'matches-json-path-pattern',
 *   'properties', 'matchesJsonPath', 'oneOf', '1'])
 * // 'matches-json-path-pattern~properties~matchesJsonPath~oneOf~1'
 * ```
 */
export const toSynthesizedName = (frames: string[]): string => {
  const phaseIndex = frames.findIndex(frame => PHASE_FRAMES.has(frame))
  const documentFrames = phaseIndex === -1 ? frames : frames.slice(phaseIndex + 1)
  const [first, second, ...rest] = documentFrames
  const named = first === 'components' && second === 'schemas' ? rest : documentFrames

  return named.map(frame => frame.replaceAll(/[~/]/g, '-')).join('~')
}
