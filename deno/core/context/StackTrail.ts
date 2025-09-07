import { componentsKeys } from '../oas/components/Components.ts'

/**
 * Represents a stack-based trail for tracking document traversal in OpenAPI processing.
 * 
 * The `StackTrail` class maintains a stack of string frames that represent the current
 * path through an OpenAPI document structure. It's used throughout the SKMTC pipeline
 * for tracking context during parsing, generating, and debugging schema processing.
 * 
 * This class is essential for error reporting, debugging, and maintaining context
 * when processing nested OpenAPI structures like schemas, operations, and components.
 * 
 * ## Key Features
 * 
 * - **Path Tracking**: Maintains a trail of traversed document elements
 * - **Context Preservation**: Preserves parsing context for error reporting
 * - **Stack Operations**: Supports push, pop, clone, and manipulation operations
 * - **Reference Resolution**: Can generate OpenAPI reference strings from trails
 * - **Serialization**: Supports string serialization and parsing for persistence
 * 
 * @example Basic usage
 * ```typescript
 * import { StackTrail } from '@skmtc/core';
 * 
 * // Start with empty trail
 * const trail = new StackTrail();
 * 
 * // Build a path through document structure
 * trail.append('components')
 *      .append('schemas')
 *      .append('User')
 *      .append('properties')
 *      .append('name');
 * 
 * console.log(trail.toString()); // 'components:schemas:User:properties:name'
 * ```
 * 
 * @example Schema reference generation
 * ```typescript
 * const schemaTrail = new StackTrail(['components', 'schemas', 'User']);
 * const ref = schemaTrail.toStackRef(); 
 * console.log(ref); // '#/components/schemas/User'
 * ```
 * 
 * @example Error context tracking
 * ```typescript
 * class SchemaProcessor {
 *   processSchema(schema: OasSchema, trail: StackTrail) {
 *     try {
 *       // Process schema logic
 *       return this.transformSchema(schema);
 *     } catch (error) {
 *       throw new Error(`Error at ${trail.toString()}: ${error.message}`);
 *       // Error at components:schemas:User:properties:email: Invalid format
 *     }
 *   }
 * }
 * ```
 * 
 * @example Cloning and manipulation
 * ```typescript
 * const baseTrail = new StackTrail(['components', 'schemas']);
 * 
 * // Clone for processing different schemas
 * const userTrail = baseTrail.clone().append('User');
 * const productTrail = baseTrail.clone().append('Product');
 * 
 * console.log(userTrail.toString());    // 'components:schemas:User'
 * console.log(productTrail.toString()); // 'components:schemas:Product'
 * console.log(baseTrail.toString());    // 'components:schemas' (unchanged)
 * ```
 */
export class StackTrail {
  /** Internal stack of traversal frames */
  #stack: string[]

  /**
   * Creates a new StackTrail instance.
   * 
   * @param stack - Initial stack frames (defaults to empty array)
   * 
   * @example
   * ```typescript
   * // Empty trail
   * const trail1 = new StackTrail();
   * 
   * // Pre-populated trail
   * const trail2 = new StackTrail(['components', 'schemas', 'User']);
   * ```
   */
  constructor(stack: string[] = []) {
    this.#stack = stack
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
   * Creates a new trail from a slice of the current trail.
   * 
   * @param start - Starting index (inclusive)
   * @param end - Ending index (exclusive, optional)
   * @returns A new StackTrail with sliced frames
   * 
   * @example
   * ```typescript
   * const trail = new StackTrail(['a', 'b', 'c', 'd', 'e']);
   * 
   * const slice1 = trail.slice(1, 3);
   * console.log(slice1.toString()); // 'b:c'
   * 
   * const slice2 = trail.slice(2);
   * console.log(slice2.toString()); // 'c:d:e'
   * ```
   */
  slice(start: number, end?: number): StackTrail {
    return new StackTrail(this.#stack.slice(start, end))
  }

  /**
   * Checks if all specified frames exist in the trail.
   * 
   * @param frames - Array of frames to check for
   * @returns True if all frames are present in the trail
   * 
   * @example
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User', 'properties']);
   * 
   * console.log(trail.includes(['schemas', 'User'])); // true
   * console.log(trail.includes(['schemas', 'Product'])); // false
   * console.log(trail.includes(['components'])); // true
   * ```
   */
  includes(frames: string[]): boolean {
    return frames.every(frame => this.#stack.includes(frame))
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

  /**
   * Gets the parent name of a property frame.
   * 
   * This method is specifically designed to find parent object names
   * for property trails in schema processing.
   * 
   * @param frame - The frame name to find the parent of
   * @returns Parent name if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const trail = new StackTrail(['components', 'schemas', 'User', 'properties', 'email']);
   * const parent = trail.getParentOf('email');
   * console.log(parent); // 'User'
   * ```
   */
  getParentOf(frame: string): string | undefined {
    const lastItemIndex = this.stackTrail.length - 1
    if (
      this.stackTrail?.[lastItemIndex] === frame &&
      this.stackTrail?.[lastItemIndex - 1] === 'properties'
    ) {
      const parentName = this.stackTrail?.[lastItemIndex - 2]
      return typeof parentName === 'string' ? parentName : undefined
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
      const lastItem = this.#stack[this.#stack.length - 1]

      if (lastItem !== frame) {
        throw new Error(`Expected to remove frame '${frame}' but found '${lastItem}'`)
      }

      this.#stack.pop()

      return this
    }

    if (Array.isArray(frame)) {
      frame.toReversed().forEach(p => this.remove(p))

      return this
    }

    throw new Error(`Unexpected stack frame: ${frame}`)
  }

  /**
   * Joins multiple stacks or strings into a single colon-separated string.
   * 
   * @param stacks - Array of StackTrail instances or strings to join
   * @returns Joined string with colon separators
   * 
   * @example
   * ```typescript
   * const trail1 = new StackTrail(['components', 'schemas']);
   * const trail2 = new StackTrail(['User', 'properties']);
   * 
   * const joined = StackTrail.join(trail1, 'separator', trail2);
   * console.log(joined); // 'components:schemas:separator:User:properties'
   * ```
   */
  static join(...stacks: (StackTrail | string)[]): string {
    return stacks.map(stack => stack.toString()).join(':')
  }

  /**
   * Parses a colon-separated string into a StackTrail instance.
   * 
   * @param value - Colon-separated string to parse
   * @returns New StackTrail instance
   * 
   * @throws {Error} When the string contains empty tokens
   * 
   * @example
   * ```typescript
   * const trail = StackTrail.parse('components:schemas:User:properties:name');
   * console.log(trail.stackTrail); // ['components', 'schemas', 'User', 'properties', 'name']
   * 
   * // Handles escaped colons
   * const escapedTrail = StackTrail.parse('components:schemas:User%3AType');
   * console.log(escapedTrail.stackTrail); // ['components', 'schemas', 'User:Type']
   * ```
   */
  static parse(value: string): StackTrail {
    const stack = value.split(':').map(item => {
      if (!item) {
        throw new Error(`Empty stack trail token in: ${value}`)
      }

      return item.replaceAll('%3A', ':')
    })

    return new StackTrail(stack)
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
