import type { OasRef } from '../oas/ref/Ref.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import { isEmpty } from './isEmpty.ts'
import { isObjectValue } from '@/oas/schema/siblings.ts'
import { DanglingRefError } from '@/oas/ref/DanglingRefError.ts'

/**
 * Arguments for collating examples from OpenAPI schemas.
 */
type CollatedExampleArgs = {
  /** The OpenAPI schema or reference to extract examples from */
  objectSchema: OasSchema | OasRef<'schema'> | undefined
  /** Current recursion depth. A schema deeper than 15 has no example. */
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
 * references. The part of a schema past the depth limit of 15 is left out, and the
 * rest of the example is kept.
 *
 * The function prioritizes explicit examples when available and falls back to
 * generating examples from nested schemas. It's particularly useful for creating
 * realistic test data, API documentation examples, and mock responses.
 *
 * @param args - Configuration for example collation
 * @param args.objectSchema - The schema to extract examples from
 * @param args.depth - Current recursion depth, 0 for the first call
 * @returns Collated example value matching the schema structure, or undefined if no examples
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
 * @example Depth limit and missing schemas
 * ```typescript
 * // `id` is at depth 15 and `name` is at depth 16, past the limit
 * const deepSchema = new OasObject({
 *   properties: {
 *     id: new OasInteger({ example: 123 }),
 *     owner: new OasObject({ properties: { name: new OasString({ example: 'Jane' }) } })
 *   }
 * });
 *
 * const deepExample = collateExamples({ objectSchema: deepSchema, depth: 14 });
 * console.log(deepExample); // { id: 123 }
 *
 * // A missing schema has no example
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
    return undefined
  }

  switch (objectSchema.type) {
    case 'ref': {
      // A schema that reaches itself has no finite example, so the recursive
      // key is omitted and collation continues around it.
      //
      // Without this the example would repeat the cycle until the depth limit,
      // and a cycle of intersection members, which add no depth, would not end.
      return collateRef({ ref: objectSchema, depth: depth + 1, seen })
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

    case 'intersection': {
      if (objectSchema.example) {
        return objectSchema.example
      }

      // A value matches every member, so the examples of objects are one object.
      // Its members are as deep as the intersection: they are one value.
      const examples = objectSchema.members
        .map(member =>
          member.isRef()
            ? collateRef({ ref: member, depth, seen })
            : collateExamples({ objectSchema: member, depth, seen })
        )
        .filter(example => Boolean(example))

      return examples.every(isObjectValue) ? toMergedExample(examples) : examples[0]
    }

    default: {
      const _exhaustive: never = objectSchema
      throw new Error(`Unhandled schema type: ${(_exhaustive as any).type}`)
    }
  }
}

type CollateRefArgs = {
  ref: OasRef<'schema'>
  /** The depth of the schema that the reference resolves to. */
  depth: number
  seen: ReadonlySet<string> | undefined
}

/** The example of what a reference resolves to. A reference on the path to itself, or one that names nothing, has none. */
const collateRef = ({ ref, depth, seen }: CollateRefArgs): unknown => {
  if (seen?.has(ref.$ref)) {
    return undefined
  }

  try {
    return collateExamples({
      objectSchema: ref.resolve(),
      depth,
      seen: new Set(seen ?? []).add(ref.$ref)
    })
  } catch (error) {
    if (DanglingRefError.is(error)) {
      return undefined
    }

    throw error
  }
}

const toMergedExample = (examples: Record<string, unknown>[]): Record<string, unknown> | undefined =>
  examples.length === 0 ? undefined : Object.assign({}, ...examples)
