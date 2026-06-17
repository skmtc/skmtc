import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toArray } from './toArray.ts'
import { assertEquals, assertExists } from '@std/assert'
import { OasArray } from '@/oas/array/Array.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toArray', async (t) => {
  await t.step('basic array parsing', async (t) => {
    await t.step('should parse basic array with empty items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = { type: 'array', items: {} }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertEquals(oasArray.oasType, 'schema')
      assertExists(oasArray.items)
      assertEquals(oasArray.items.type, 'unknown')
    })

    await t.step('should fail open on a missing items field (invalid OAS): unknown items + logged issue', () => {
      // Real-world regression: the Sequence API schema declares a query
      // parameter as `{ "type": "array" }` with NO items — invalid per
      // the spec, but it must produce a parse issue, not a TypeError
      // ("Cannot use 'in' operator to search for 'allOf' in undefined").
      const stackTrail = new StackTrail(['TEST'])
      const schema = { type: 'array' } as OpenAPIV3.ArraySchemaObject
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertExists(oasArray.items)
      assertEquals(oasArray.items.type, 'unknown')
    })

    await t.step('should parse array with string items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertExists(oasArray.items)
      assertEquals(oasArray.items.type, 'string')
    })

    await t.step('should parse array with number items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertExists(oasArray.items)
      assertEquals(oasArray.items.type, 'number')
    })

    await t.step('should parse array with object items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertExists(oasArray.items)
      assertEquals(oasArray.items.type, 'object')
    })
  })

  await t.step('nullable handling', async (t) => {
    await t.step('should handle nullable: true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.nullable, true)
    })

    await t.step('should handle nullable: false', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        nullable: false,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.nullable, false)
    })

    await t.step('should handle nullable: undefined (default)', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.nullable, undefined)
    })

    await t.step('should handle nullable with null example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
        example: null,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.nullable, true)
      assertEquals(oasArray.example, null)
    })
  })

  await t.step('example validation', async (t) => {
    await t.step('should parse valid array example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        example: ['value1', 'value2', 'value3'],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.example, ['value1', 'value2', 'value3'])
    })

    await t.step('should handle null example when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
        nullable: true,
        example: null,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.example, null)
    })

    await t.step('should handle empty array example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        example: [],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.example, [])
    })

    await t.step('should handle array example with complex objects', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'object' },
        example: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.example, [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ])
    })

    await t.step('should return undefined for invalid non-array example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        example: 'not-an-array' as unknown as unknown[],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      // Invalid example should be logged as warning and returned as undefined
      assertEquals(oasArray.example, undefined)
    })

    await t.step('should handle undefined example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.example, undefined)
    })
  })

  await t.step('enum validation', async (t) => {
    await t.step('should parse valid enum with array values', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
        enum: [[1, 2], [3, 4], [5, 6]],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.enums, [[1, 2], [3, 4], [5, 6]])
    })

    await t.step('should handle enum with null when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
        enum: [['a', 'b'], null, ['c', 'd']],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.enums, [['a', 'b'], null, ['c', 'd']])
    })

    await t.step('should handle empty enum array', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        enum: [],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.enums, [])
    })

    await t.step('should return undefined for enum with any invalid non-array value', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
        enum: [[1, 2], 'invalid' as unknown as unknown[], [3, 4]],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      // parseEnum returns undefined if ANY invalid value is found (fail-fast)
      assertEquals(oasArray.enums, undefined)
    })

    await t.step('should handle undefined enum', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.enums, undefined)
    })
  })

  await t.step('default value validation', async (t) => {
    await t.step('should parse valid array default value', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        default: ['default1', 'default2'],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.defaultValue, ['default1', 'default2'])
    })

    await t.step('should handle null default when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
        nullable: true,
        default: null,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.defaultValue, null)
    })

    await t.step('should handle empty array as default', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        default: [],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.defaultValue, [])
    })

    await t.step('should return undefined for invalid non-array default', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        default: 'not-an-array' as unknown as unknown[],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      // Invalid default should be logged as warning and returned as undefined
      assertEquals(oasArray.defaultValue, undefined)
    })

    await t.step('should reject null default when not nullable', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        default: null as unknown as unknown[],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      // null is only a valid default when nullable: true
      assertEquals(oasArray.defaultValue, undefined)
    })

    await t.step('should handle undefined default value', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.defaultValue, undefined)
    })
  })

  await t.step('array-specific properties', async (t) => {
    await t.step('should parse title and description', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        title: 'Tags Array',
        description: 'An array of tag strings',
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.title, 'Tags Array')
      assertEquals(oasArray.description, 'An array of tag strings')
    })

    await t.step('should parse uniqueItems constraint', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.uniqueItems, true)
    })

    await t.step('should parse minItems and maxItems constraints', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 10,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.minItems, 1)
      assertEquals(oasArray.maxItems, 10)
    })

    await t.step('should parse readOnly flag', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        readOnly: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.readOnly, true)
    })

    await t.step('should parse writeOnly flag', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        writeOnly: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.writeOnly, true)
    })

    await t.step('should parse deprecated flag', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        deprecated: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.deprecated, true)
    })

    await t.step('should parse all constraints together', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        title: 'Unique Tags',
        minItems: 1,
        maxItems: 5,
        uniqueItems: true,
        readOnly: false,
        deprecated: false,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.title, 'Unique Tags')
      assertEquals(oasArray.minItems, 1)
      assertEquals(oasArray.maxItems, 5)
      assertEquals(oasArray.uniqueItems, true)
      assertEquals(oasArray.readOnly, false)
      assertEquals(oasArray.deprecated, false)
    })
  })

  await t.step('extension fields and skipped fields', async (t) => {
    await t.step('should handle custom x-* extension properties', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema = {
        type: 'array',
        items: { type: 'string' },
        'x-custom-field': 'custom-value',
        'x-priority': 'high',
      } as OpenAPIV3.ArraySchemaObject

      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertExists(oasArray.extensionFields)
      assertEquals(oasArray.extensionFields['x-custom-field'], 'custom-value')
      assertEquals(oasArray.extensionFields['x-priority'], 'high')
    })

    await t.step('should handle multiple extension fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema = {
        type: 'array',
        items: { type: 'number' },
        'x-field1': 'value1',
        'x-field2': { nested: 'value' },
        'x-field3': [1, 2, 3],
      } as OpenAPIV3.ArraySchemaObject

      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertExists(oasArray.extensionFields)
      assertEquals(oasArray.extensionFields['x-field1'], 'value1')
      assertEquals(oasArray.extensionFields['x-field2'], { nested: 'value' })
      assertEquals(oasArray.extensionFields['x-field3'], [1, 2, 3])
    })

    await t.step('should handle schema with no extension fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.extensionFields, undefined)
    })
  })

  await t.step('integration and edge cases', async (t) => {
    await t.step('should parse complex array with all properties', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        title: 'Complete Array',
        description: 'Array with all possible properties',
        nullable: true,
        uniqueItems: true,
        minItems: 1,
        maxItems: 10,
        example: ['tag1', 'tag2'],
        enum: [['a'], ['b'], null],
        default: ['default'],
        readOnly: false,
        writeOnly: false,
        deprecated: false,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.type, 'array')
      assertEquals(oasArray.title, 'Complete Array')
      assertEquals(oasArray.description, 'Array with all possible properties')
      assertEquals(oasArray.nullable, true)
      assertEquals(oasArray.uniqueItems, true)
      assertEquals(oasArray.minItems, 1)
      assertEquals(oasArray.maxItems, 10)
      assertEquals(oasArray.example, ['tag1', 'tag2'])
      assertEquals(oasArray.enums, [['a'], ['b'], null])
      assertEquals(oasArray.defaultValue, ['default'])
      assertEquals(oasArray.readOnly, false)
      assertEquals(oasArray.writeOnly, false)
      assertEquals(oasArray.deprecated, false)
    })

    await t.step('should handle array with boolean items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'boolean' },
        example: [true, false, true],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.items.type, 'boolean')
      assertEquals(oasArray.example, [true, false, true])
    })

    await t.step('should handle array with integer items', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'integer' },
        minItems: 0,
        maxItems: 100,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.items.type, 'integer')
      assertEquals(oasArray.minItems, 0)
      assertEquals(oasArray.maxItems, 100)
    })

    await t.step('should handle array with missing optional properties', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.title, undefined)
      assertEquals(oasArray.description, undefined)
      assertEquals(oasArray.nullable, undefined)
      assertEquals(oasArray.uniqueItems, undefined)
      assertEquals(oasArray.minItems, undefined)
      assertEquals(oasArray.maxItems, undefined)
      assertEquals(oasArray.example, undefined)
      assertEquals(oasArray.enums, undefined)
      assertEquals(oasArray.defaultValue, undefined)
      assertEquals(oasArray.readOnly, undefined)
      assertEquals(oasArray.writeOnly, undefined)
      assertEquals(oasArray.deprecated, undefined)
    })

    await t.step('should handle zero minItems', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        minItems: 0,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.minItems, 0)
    })
  })

  await t.step('realistic API scenarios', async (t) => {
    await t.step('should handle paginated results array', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'UserList'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        description: 'Paginated list of users',
        minItems: 0,
        maxItems: 50,
        example: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.description, 'Paginated list of users')
      assertEquals(oasArray.minItems, 0)
      assertEquals(oasArray.maxItems, 50)
      assertEquals(oasArray.items.type, 'object')
    })

    await t.step('should handle array of unique tags', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'Tags'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        title: 'Tags',
        description: 'Unique set of tags',
        uniqueItems: true,
        minItems: 1,
        maxItems: 10,
        example: ['typescript', 'deno', 'openapi'],
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.title, 'Tags')
      assertEquals(oasArray.uniqueItems, true)
      assertEquals(oasArray.minItems, 1)
      assertEquals(oasArray.maxItems, 10)
    })

    await t.step('should handle read-only response array', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'Results'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'object' },
        description: 'Read-only results',
        readOnly: true,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.readOnly, true)
      assertEquals(oasArray.writeOnly, undefined)
    })

    await t.step('should handle nullable array response', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'OptionalItems'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
        description: 'Array that may be null',
        example: null,
        default: null,
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.nullable, true)
      assertEquals(oasArray.example, null)
      assertEquals(oasArray.defaultValue, null)
    })

    await t.step('should handle array with enum constraints', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'PredefinedArrays'])
      const schema: OpenAPIV3.ArraySchemaObject = {
        type: 'array',
        items: { type: 'string' },
        enum: [
          ['option1', 'option2'],
          ['option3', 'option4'],
          ['option5'],
        ],
        description: 'One of the predefined array combinations',
      }
      const oasArray = toArray({ value: schema, stackTrail, context: mockParseContext })

      assertEquals(oasArray.enums?.length, 3)
      assertEquals(oasArray.description, 'One of the predefined array combinations')
    })
  })
})
