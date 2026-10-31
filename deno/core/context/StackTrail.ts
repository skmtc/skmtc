import { componentsKeys } from '@/oas/components/Components.ts'
import { toJsonPointer, type JsonPointer } from '@/types/JsonPointer.ts'
import { toDocumentFrames, toTrailString } from '@/context/documentTrail.ts'

export class StackTrail {
  /** Internal stack of traversal frames */
  #stack: string[]

  constructor(stack: string[] = []) {
    this.#stack = stack
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
    return this.#stack.length === 0
  }

  /**
   * Creates a shallow copy of the stack trail.
   *
   * @returns A new StackTrail instance with copied frames
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
    return new StackTrail([...this.#stack])
  }

  /**
   * The live array of stack frames, not a copy: {@link trace} pops it after
   * `fn` returns. Copy it (`[...trail.stackTrail]`) to keep the frames.
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
  get stackTrail(): string[] {
    return this.#stack
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
      this.#stack.push(frame)

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
   */
  trace<T>(key: string | string[], fn: (st: StackTrail) => T): T {
    const stackTrail = this.clone()
    stackTrail.append(key)
    try {
      const result = fn(stackTrail)

      stackTrail.remove(key)

      return result
    } catch (error) {
      stackTrail.remove(key)

      throw error
    }
  }

  /** Async form of {@link trace}. */
  async traceAsync<T>(key: string | string[], fn: (st: StackTrail) => Promise<T>): Promise<T> {
    const stackTrail = this.clone()
    stackTrail.append(key)
    try {
      const result = await fn(stackTrail)

      stackTrail.remove(key)

      return result
    } catch (error) {
      stackTrail.remove(key)

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
    return toJsonPointer(this.#stack)
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
    return toJsonPointer(toDocumentFrames(this.#stack))
  }

  toStackRef(): string | undefined {
    const [first, second, third] = this.stackTrail

    if (first !== 'components') {
      return
    }

    if (typeof second !== 'string' || !componentsKeys.includes(second)) {
      return
    }

    if (typeof third !== 'string') {
      return
    }

    return `#/${first}/${second}/${third}`
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
      const lastItem = this.#stack.pop()

      if (lastItem !== frame) {
        throw new Error(`Expected to remove frame '${frame}' but found '${lastItem}'`)
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
    return toTrailString(this.#stack)
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
