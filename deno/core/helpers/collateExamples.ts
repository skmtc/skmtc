import type { OasRef } from '../oas/ref/Ref.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import { match } from 'ts-pattern'
import { isEmpty } from './isEmpty.ts'

/**
 * Arguments for collating examples from OpenAPI schemas.
 */
type CollatedExampleArgs = {
  /** The OpenAPI schema or reference to extract examples from */
  objectSchema: OasSchema | OasRef<'schema'> | undefined
  /** Current recursion depth (used to prevent infinite loops) */
  depth: number
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
export const collateExamples = ({ objectSchema, depth }: CollatedExampleArgs): unknown => {
  if (!objectSchema) {
    return undefined
  }

  if (depth > 15) {
    throw new Error('Depth limit reached')
  }

  const result = match(objectSchema)
    .with({ type: 'ref' }, matched => {
      return collateExamples({
        objectSchema: matched.resolve(),
        depth: depth + 1
      })
    })
    .with({ type: 'object' }, matched => {
      if (matched.example) {
        return matched.example
      }

      const output: Record<string, unknown> = {}

      Object.entries(matched.properties ?? {}).forEach(([key, value]) => {
        if (value.type === 'custom') {
          return
        }

        const propertyExample = collateExamples({
          objectSchema: value,
          depth: depth + 1
        })

        if (propertyExample) {
          output[key] = propertyExample
        }
      })

      return isEmpty(output) ? undefined : output
    })
    .with({ type: 'array' }, matched => {
      if (matched.example) {
        return matched.example
      }

      const itemsExample = collateExamples({
        objectSchema: matched.items,
        depth: depth + 1
      })

      return itemsExample ? [itemsExample] : undefined
    })
    .with({ type: 'string' }, ({ example }) => example)
    .with({ type: 'number' }, ({ example }) => example)
    .with({ type: 'integer' }, ({ example }) => example)
    .with({ type: 'boolean' }, ({ example }) => example)
    .with({ type: 'unknown' }, ({ example }) => example)
    .with({ type: 'union' }, ({ members }) => {
      for (const member of members) {
        const unionExample = collateExamples({
          objectSchema: member,
          depth: depth + 1
        })

        if (unionExample) {
          return unionExample
        }
      }
    })
    .exhaustive()

  return result
}
