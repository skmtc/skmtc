import { componentsKeys } from '@/oas/components/Components.ts'
import { toJsonPointer, type JsonPointer } from '@/types/JsonPointer.ts'

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
   * Gets a copy of the current stack frames.
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

  trace<T>(key: string, fn: (st: StackTrail) => T): T {
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

  async traceAsync<T>(key: string, fn: (st: StackTrail) => Promise<T>): Promise<T> {
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
   * Converts the trail to a colon-separated string representation.
   *
   * Colons within frame names are escaped as '%3A' to avoid conflicts
   * with the separator character.
   *
   * @returns String representation of the trail
   *
   * @example
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User']);
   * console.log(trail.toString()); // 'components:schemas:User'
   *
   * // With colon in frame name
   * const trailWithColon = new StackTrail(['components', 'schemas', 'User:Type']);
   * console.log(trailWithColon.toString()); // 'components:schemas:User%3AType'
   * ```
   */
  toString(): string {
    return this.#stack
      .map(item => {
        return typeof item === 'string' ? item.replaceAll(':', '%3A') : item
      })
      .join(':')
  }
}
