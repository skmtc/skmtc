import { componentsKeys } from '@/oas/components/Components.ts'
import { toJsonPointer, type JsonPointer } from '@/types/JsonPointer.ts'
import { escapeTrailFrame, isPhaseFrame } from '@/context/documentTrail.ts'

/**
 * One frame of a trail, linked to the frame before it. Frames are never
 * changed after they are made, so trails share them: a trail made by
 * {@link StackTrail.clone} or {@link StackTrail.trace} points at the same
 * frames as its source and adds no copy.
 */
type TrailFrame = {
  readonly frame: string
  readonly parent: TrailFrame | undefined
  /** Number of frames from the root up to and including this one. */
  readonly depth: number
}

const toTrailFrame = (parent: TrailFrame | undefined, frame: string): TrailFrame => ({
  frame,
  parent,
  depth: (parent?.depth ?? 0) + 1
})

const asIs = (frame: string): string => frame

export class StackTrail {
  /**
   * Last frame of the trail; `undefined` for the empty trail. A parsed
   * document holds one trail per node, so the frames are a shared linked
   * list and not one array per trail.
   */
  #last: TrailFrame | undefined

  constructor(stack: readonly string[] = []) {
    this.#last = stack.reduce<TrailFrame | undefined>(toTrailFrame, undefined)
  }

  /**
   * The canonical empty trail — used for nodes that were synthesized
   * programmatically rather than parsed from a source document (they
   * have no position). Distinct from any parsed position: no parsed
   * `OasBase` node ever sits at the empty trail.
   */
  static empty(): StackTrail {
    return new StackTrail([])
  }

  /** True when the trail holds no frames (a synthetic / positionless node). */
  isEmpty(): boolean {
    return this.#last === undefined
  }

  /**
   * Creates an independent trail with the same frames. The frames are
   * shared, not copied.
   *
   * @returns A new StackTrail instance with the same frames
   *
   * @example
   * ```typescript
   * const original = new StackTrail(['components', 'schemas']);
   * const copy = original.clone();
   *
   * copy.append('User');
   * console.log(original.toString()); // 'components:schemas'
   * console.log(copy.toString());     // 'components:schemas:User'
   * ```
   */
  clone(): StackTrail {
    const copy = new StackTrail()
    copy.#last = this.#last

    return copy
  }

  /**
   * The frames of the trail as a new read-only array, built on each read.
   * Change the trail with {@link append}, {@link remove} or {@link trace},
   * not through this array. The trail itself is live: {@link trace}
   * removes its frame after `fn` returns, so read the frames inside `fn`
   * to keep them.
   *
   * @returns Array of stack frames in order
   *
   * @example
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User']);
   * const frames = trail.stackTrail;
   * console.log(frames); // ['components', 'schemas', 'User']
   * ```
   */
  get stackTrail(): readonly string[] {
    return this.#mapFrames(asIs)
  }

  /**
   * The frames from the root to the last frame, each passed through `fn`,
   * in one walk of the list. With `above`, that frame and every frame
   * before it are left out.
   */
  #mapFrames(fn: (frame: string) => string, above?: TrailFrame): string[] {
    // Pushed and then reversed, so the array stays packed. An array made
    // with `new Array(n)` stays holey in V8 after it is filled.
    const frames: string[] = []

    for (let node = this.#last; node !== undefined && node !== above; node = node.parent) {
      frames.push(fn(node.frame))
    }

    return frames.reverse()
  }

  /** The phase frame nearest the root, or `undefined` when the trail has none. */
  #rootPhaseFrame(): TrailFrame | undefined {
    let found: TrailFrame | undefined

    for (let node = this.#last; node !== undefined; node = node.parent) {
      if (isPhaseFrame(node.frame)) {
        found = node
      }
    }

    return found
  }

  /** The frame at `depth` (1 is the root), or `undefined` when the trail is shorter. */
  #frameAtDepth(depth: number): TrailFrame | undefined {
    let node = this.#last

    while (node !== undefined && node.depth > depth) {
      node = node.parent
    }

    return node?.depth === depth ? node : undefined
  }

  /**
   * Appends frame(s) to the end of the trail.
   *
   * @param frame - Single frame string or array of frames to append
   * @returns This StackTrail instance for chaining
   *
   * @throws {Error} When frame is not a string or string array
   *
   * @example Single frame
   * ```typescript
   * const trail = new StackTrail(['components']);
   * trail.append('schemas').append('User');
   * console.log(trail.toString()); // 'components:schemas:User'
   * ```
   *
   * @example Multiple frames
   * ```typescript
   * const trail = new StackTrail();
   * trail.append(['components', 'schemas', 'User']);
   * console.log(trail.toString()); // 'components:schemas:User'
   * ```
   */
  append(frame: string | string[]): StackTrail {
    if (typeof frame === 'string') {
      this.#last = toTrailFrame(this.#last, frame)

      return this
    }

    if (Array.isArray(frame)) {
      frame.forEach(p => this.append(p))

      return this
    }

    throw new Error(`Unexpected stack frame: ${frame}`)
  }

  /**
   * Runs `fn` on a copy of the trail with `key` appended: one frame for a
   * string, one frame per element for an array.
   *
   * When `fn` returns, `key` is removed and must be the last frame. When
   * `fn` throws, the copy goes back to the frames it started with and the
   * error from `fn` is rethrown: a frame check there would replace it.
   */
  trace<T>(key: string | string[], fn: (st: StackTrail) => T): T {
    const start = this.#last
    const stackTrail = this.clone()
    stackTrail.append(key)
    try {
      const result = fn(stackTrail)

      stackTrail.remove(key)

      return result
    } catch (error) {
      stackTrail.#last = start

      throw error
    }
  }

  /** Async form of {@link trace}. */
  async traceAsync<T>(key: string | string[], fn: (st: StackTrail) => Promise<T>): Promise<T> {
    const start = this.#last
    const stackTrail = this.clone()
    stackTrail.append(key)
    try {
      const result = await fn(stackTrail)

      stackTrail.remove(key)

      return result
    } catch (error) {
      stackTrail.#last = start

      throw error
    }
  }

  /**
   * Converts the trail to an OpenAPI reference string if applicable.
   *
   * Only trails that represent valid OpenAPI component references
   * (starting with 'components') can be converted to reference strings.
   *
   * @returns OpenAPI reference string or undefined if not a valid reference trail
   *
   * @example Valid reference trail
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User']);
   * const ref = trail.toStackRef();
   * console.log(ref); // '#/components/schemas/User'
   * ```
   *
   * @example Invalid trail
   * ```typescript
   * const trail = new StackTrail(['paths', '/users', 'get']);
   * const ref = trail.toStackRef();
   * console.log(ref); // undefined
   * ```
   */
  /**
   * Converts the trail to an RFC 6901 JSON Pointer (URI fragment form).
   *
   * Unlike {@link toStackRef}, this works for *any* visitor path — not
   * just components-rooted references. Used by the gen-maps system to
   * attach a `location` field to every parsed OAS schema, recording
   * exactly where in the document the schema lives.
   *
   * Special characters in stack frames (`/`, `~`) are escaped per
   * RFC 6901.
   *
   * @returns A JSON Pointer string starting with `#/`
   *
   * @example Components-rooted
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User'])
   * trail.toJsonPointer() // '#/components/schemas/User'
   * ```
   *
   * @example Path-rooted (escapes slashes in path segments)
   * ```typescript
   * const trail = new StackTrail(['paths', '/users/{id}', 'get'])
   * trail.toJsonPointer() // '#/paths/~1users~1{id}/get'
   * ```
   */
  toJsonPointer(): JsonPointer {
    return toJsonPointer(this.stackTrail)
  }

  /**
   * The **document-relative** JSON Pointer for a parsed node, with the
   * run's operational prefix stripped — the resolvable form used as a
   * schema pointer in gen-maps.
   *
   * A parsed node's trail is seeded with operational frames before any
   * document traversal: the worker pushes `[traceId, spanId]` and
   * `CoreContext.toArtifacts` wraps each phase in `.trace('parse', …)` /
   * `.trace('generate', …)` etc. The document path
   * (`components/schemas/Pet/properties/name`) is appended on top. Unlike
   * {@link toJsonPointer} — which serializes the *whole* trail and so does
   * NOT resolve against the input document — this drops everything up to
   * and including the phase frame, leaving only the document-relative path.
   *
   * Protocol-agnostic: the remaining frames are the input document's own
   * keys (`components`, `paths`, … for OAS), never an `oas:`/`gql:` scheme.
   *
   * Falls back to the full trail when no phase frame is present (a trail
   * seeded empty — e.g. in tests — is already document-relative). Returns
   * `#/` (document root) for the empty trail.
   *
   * @example
   * ```typescript
   * new StackTrail(['trace-1', 'span-1', 'parse', 'components', 'schemas', 'Pet'])
   *   .toSchemaPointer() // '#/components/schemas/Pet'
   *
   * new StackTrail(['components', 'schemas', 'User']) // already doc-relative
   *   .toSchemaPointer() // '#/components/schemas/User'
   * ```
   */
  toSchemaPointer(): JsonPointer {
    return toJsonPointer(this.#mapFrames(asIs, this.#rootPhaseFrame()))
  }

  toStackRef(): string | undefined {
    // Reads the first three frames only, without building the whole array.
    const third = this.#frameAtDepth(3)
    const second = third?.parent
    const first = second?.parent

    if (third === undefined || second === undefined || first?.frame !== 'components') {
      return
    }

    if (!componentsKeys.includes(second.frame)) {
      return
    }

    return `#/${first.frame}/${second.frame}/${third.frame}`
  }

  /**
   * Removes frame(s) from the end of the trail.
   *
   * @param frame - Single frame string or array of frames to remove
   * @returns This StackTrail instance for chaining
   *
   * @throws {Error} When trying to remove a frame that doesn't match the last frame
   * @throws {Error} When frame is not a string or string array
   *
   * @example Single frame removal
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User', 'properties']);
   * trail.remove('properties');
   * console.log(trail.toString()); // 'components:schemas:User'
   * ```
   *
   * @example Multiple frame removal
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User', 'properties', 'name']);
   * trail.remove(['name', 'properties']);
   * console.log(trail.toString()); // 'components:schemas:User'
   * ```
   */
  remove(frame: string | string[]): StackTrail {
    if (typeof frame === 'string') {
      const last = this.#last

      // The last frame leaves the trail whether or not it matches, as
      // `Array.pop` did before the check.
      this.#last = last?.parent

      if (last?.frame !== frame) {
        throw new Error(`Expected to remove frame '${frame}' but found '${last?.frame}'`)
      }

      return this
    }

    if (Array.isArray(frame)) {
      frame.toReversed().forEach(p => this.remove(p))

      return this
    }

    throw new Error(`Unexpected stack frame: ${frame}`)
  }

  /**
   * Converts the trail to JSON representation.
   *
   * Used for serialization in JSON contexts. Returns the same
   * as toString() method.
   *
   * @returns String representation of the trail
   *
   * @example
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User']);
   * const json = JSON.stringify({ path: trail });
   * console.log(json); // '{"path":"components:schemas:User"}'
   * ```
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Converts the trail to a colon-separated string.
   *
   * Inside a frame, `%` is escaped as `%25` and `:` as `%3A`, so
   * {@link StackTrail.fromString} reads the same frames back.
   *
   * @example
   * ```typescript
   * new StackTrail(['components', 'schemas', 'User']).toString()
   * // 'components:schemas:User'
   *
   * new StackTrail(['paths', '/pets/{id}:archive', '100%']).toString()
   * // 'paths:/pets/{id}%3Aarchive:100%25'
   * ```
   */
  toString(): string {
    return this.#mapFrames(escapeTrailFrame).join(':')
  }

  /**
   * Reads a string written by {@link StackTrail.toString} back into a trail.
   *
   * Splits on `:` and decodes `%25` and `%3A` in each frame. The empty
   * string gives the empty trail, so a trail of one empty frame is the one
   * trail that does not round-trip.
   *
   * @example
   * ```typescript
   * StackTrail.fromString('paths:/pets/{id}%3Aarchive:post').stackTrail
   * // ['paths', '/pets/{id}:archive', 'post']
   * ```
   */
  static fromString(value: string): StackTrail {
    if (value === '') {
      return new StackTrail([])
    }

    return new StackTrail(
      value.split(':').map(frame => frame.replace(/%(25|3A)/g, (_, code: string) => decodes[code]))
    )
  }
}

const decodes: Record<string, string> = { '25': '%', '3A': ':' }
