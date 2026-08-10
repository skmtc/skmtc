import type { OasRef } from '../oas/ref/Ref.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import { isEmpty } from './isEmpty.ts'

/**
 * Arguments for collating examples from OpenAPI schemas.
 */
type CollatedExampleArgs = {
  /** The OpenAPI schema or reference to extract examples from */
  objectSchema: OasSchema | OasRef<'schema'> | undefined
  /** Current recursion depth (used to prevent infinite loops) */
  depth: number
  /**
   * The `$ref` pointers already entered on THIS path, used to cut reference
   * cycles. Callers start collation without it; the function threads it.
   *
   * Path-scoped rather than global on purpose. A global set would also stop a
   * cycle, and would additionally drop the example for the SECOND of two
   * sibling uses of the same schema — silently emptying samples on every
   * document that reuses a type, which is most of them.
   */
  seen?: ReadonlySet<string>
}

/**
 * Recursively collates and builds example values from OpenAPI schemas.
 *
 * This function traverses OpenAPI schema structures and generates comprehensive
 * example values based on the schema definitions and any explicit examples provided.
 * It handles complex nested structures including objects, arrays, unions, and
 * references while preventing infinite recursion through depth limiting.
 *
 * The function prioritizes explicit examples when available and falls back to
 * generating examples from nested schemas. It's particularly useful for creating
 * realistic test data, API documentation examples, and mock responses.
 *
 * @param args - Configuration for example collation
 * @param args.objectSchema - The schema to extract examples from
 * @param args.depth - Current recursion depth (prevents infinite loops)
 * @returns Collated example value matching the schema structure, or undefined if no examples
 *
 * @throws {Error} When recursion depth exceeds 15 levels (prevents stack overflow)
 *
 * @example Basic schema examples
 * ```typescript
 * import { collateExamples } from '@skmtc/core';
 *
 * // String schema with example
 * const stringSchema = new OasString({ example: 'john.doe@example.com' });
 * const example = collateExamples({ objectSchema: stringSchema, depth: 0 });
 * console.log(example); // 'john.doe@example.com'
 *
 * // Number schema with example
 * const numberSchema = new OasNumber({ example: 42 });
 * const numExample = collateExamples({ objectSchema: numberSchema, depth: 0 });
 * console.log(numExample); // 42
 * ```
 *
 * @example Object schema examples
 * ```typescript
 * // Object schema with nested properties
 * const userSchema = new OasObject({
 *   properties: {
 *     id: new OasInteger({ example: 123 }),
 *     name: new OasString({ example: 'John Doe' }),
 *     email: new OasString({ example: 'john@example.com' }),
 *     age: new OasInteger({ example: 30 })
 *   }
 * });
 *
 * const userExample = collateExamples({ objectSchema: userSchema, depth: 0 });
 * console.log(userExample);
 * // {
 * //   id: 123,
 * //   name: 'John Doe',
 * //   email: 'john@example.com',
 * //   age: 30
 * // }
 * ```
 *
 * @example Array schema examples
 * ```typescript
 * // Array of objects
 * const usersArraySchema = new OasArray({
 *   items: new OasObject({
 *     properties: {
 *       id: new OasInteger({ example: 1 }),
 *       name: new OasString({ example: 'Jane Smith' })
 *     }
 *   })
 * });
 *
 * const arrayExample = collateExamples({ objectSchema: usersArraySchema, depth: 0 });
 * console.log(arrayExample);
 * // [
 * //   {
 * //     id: 1,
 * //     name: 'Jane Smith'
 * //   }
 * // ]
 * ```
 *
 * @example Union schema examples
 * ```typescript
 * // Union of string and number
 * const unionSchema = new OasUnion({
 *   members: [
 *     new OasString({ example: 'text-value' }),
 *     new OasNumber({ example: 99 })
 *   ]
 * });
 *
 * const unionExample = collateExamples({ objectSchema: unionSchema, depth: 0 });
 * console.log(unionExample); // 'text-value' (first member with example)
 * ```
 *
 * @example Reference resolution
 * ```typescript
 * // Schema with reference to another schema
 * const addressRef = new OasRef({
 *   $ref: '#/components/schemas/Address',
 *   resolve: () => new OasObject({
 *     properties: {
 *       street: new OasString({ example: '123 Main St' }),
 *       city: new OasString({ example: 'Springfield' })
 *     }
 *   })
 * });
 *
 * const refExample = collateExamples({ objectSchema: addressRef, depth: 0 });
 * console.log(refExample);
 * // {
 * //   street: '123 Main St',
 * //   city: 'Springfield'
 * // }
 * ```
 *
 * @example Depth limiting and error handling
 * ```typescript
 * // Deep nesting detection
 * try {
 *   const deepExample = collateExamples({ objectSchema: someSchema, depth: 16 });
 * } catch (error) {
 *   console.error('Depth limit exceeded:', error.message); // 'Depth limit reached'
 * }
 *
 * // Handling missing schemas
 * const emptyExample = collateExamples({ objectSchema: undefined, depth: 0 });
 * console.log(emptyExample); // undefined
 * ```
 *
 * @example Using in API documentation generation
 * ```typescript
 * class ApiDocGenerator {
 *   generateExampleResponse(responseSchema: OasSchema) {
 *     const example = collateExamples({ objectSchema: responseSchema, depth: 0 });
 *
 *     if (example) {
 *       return {
 *         description: 'Example response',
 *         value: example
 *       };
 *     }
 *
 *     return { description: 'No example available' };
 *   }
 * }
 * ```
 */
export const collateExamples = ({ objectSchema, depth, seen }: CollatedExampleArgs): unknown => {
  if (!objectSchema) {
    return undefined
  }

  if (depth > 15) {
    throw new Error('Depth limit reached')
  }

  switch (objectSchema.type) {
    case 'ref': {
      // A schema that reaches itself has no finite example, so the recursive
      // key is omitted and collation continues around it.
      //
      // Without this the cycle simply pads the path until the depth limit
      // throws, roughly sixteen steps in — so a self-referential schema and a
      // legitimately deep one fail identically, and a caller that only wanted a
      // sample body gets an exception instead. Cutting the cycle here is what
      // makes the depth limit mean what it says.
      if (seen?.has(objectSchema.$ref)) {
        return undefined
      }

      return collateExamples({
        objectSchema: objectSchema.resolve(),
        depth: depth + 1,
        seen: new Set(seen ?? []).add(objectSchema.$ref)
      })
    }

    case 'object': {
      if (objectSchema.example) {
        return objectSchema.example
      }

      const output: Record<string, unknown> = {}

      Object.entries(objectSchema.properties ?? {}).forEach(([key, value]) => {
        if (value.type === 'custom') {
          return
        }

        const propertyExample = collateExamples({
          objectSchema: value,
          depth: depth + 1,
          seen
        })

        if (propertyExample) {
          output[key] = propertyExample
        }
      })

      return isEmpty(output) ? undefined : output
    }

    case 'array': {
      if (objectSchema.example) {
        return objectSchema.example
      }

      const itemsExample = collateExamples({
        objectSchema: objectSchema.items,
        depth: depth + 1,
        seen
      })

      return itemsExample ? [itemsExample] : undefined
    }

    case 'string':
      return objectSchema.example

    case 'number':
      return objectSchema.example

    case 'integer':
      return objectSchema.example

    case 'boolean':
      return objectSchema.example

    case 'unknown':
      return objectSchema.example

    case 'union': {
      for (const member of objectSchema.members) {
        const unionExample = collateExamples({
          objectSchema: member,
          depth: depth + 1,
          seen
        })

        if (unionExample) {
          return unionExample
        }
      }
      return undefined
    }

    default: {
      const _exhaustive: never = objectSchema
      throw new Error(`Unhandled schema type: ${(_exhaustive as any).type}`)
    }
  }
}
