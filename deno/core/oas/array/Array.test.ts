import { assertEquals, assertExists } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { OasArray } from './Array.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'

Deno.test('OasArray', async t => {
  await t.step('constructor and property initialization', async t => {
    await t.step('should initialize with all properties provided', () => {
      const items = new OasUnknown()
      const array = new OasArray({
        items,
        title: 'User Array',
        description: 'An array of user objects',
        nullable: true,
        uniqueItems: true,
        extensionFields: { 'x-custom': 'metadata' },
        example: [{ id: 1 }, { id: 2 }],
        maxItems: 100,
        minItems: 1,
        enums: [[{ id: 1 }], [{ id: 2 }]],
        defaultValue: [{ id: 0 }],
        readOnly: true,
        writeOnly: false,
        deprecated: false
      })

      assertEquals(array.oasType, 'schema')
      assertEquals(array.type, 'array')
      assertEquals(array.items, items)
      assertEquals(array.title, 'User Array')
      assertEquals(array.description, 'An array of user objects')
      assertEquals(array.nullable, true)
      assertEquals(array.uniqueItems, true)
      assertEquals(array.extensionFields, { 'x-custom': 'metadata' })
      assertEquals(array.example, [{ id: 1 }, { id: 2 }])
      assertEquals(array.maxItems, 100)
      assertEquals(array.minItems, 1)
      assertEquals(array.enums, [[{ id: 1 }], [{ id: 2 }]])
      assertEquals(array.defaultValue, [{ id: 0 }])
      assertEquals(array.readOnly, true)
      assertEquals(array.writeOnly, false)
      assertEquals(array.deprecated, false)
    })

    await t.step('should initialize with minimal required properties (just items)', () => {
      const items = new OasUnknown()
      const array = new OasArray({ items })

      assertEquals(array.oasType, 'schema')
      assertEquals(array.type, 'array')
      assertEquals(array.items, items)
      assertEquals(array.title, undefined)
      assertEquals(array.description, undefined)
      assertEquals(array.nullable, undefined)
      assertEquals(array.uniqueItems, undefined)
      assertEquals(array.extensionFields, undefined)
      assertEquals(array.example, undefined)
      assertEquals(array.maxItems, undefined)
      assertEquals(array.minItems, undefined)
      assertEquals(array.enums, undefined)
      assertEquals(array.defaultValue, undefined)
      assertEquals(array.readOnly, undefined)
      assertEquals(array.writeOnly, undefined)
      assertEquals(array.deprecated, undefined)
    })

    await t.step('should handle optional properties correctly', () => {
      const items = new OasUnknown()
      const array = new OasArray({
        items,
        title: 'String Array',
        maxItems: 10
      })

      assertEquals(array.items, items)
      assertEquals(array.title, 'String Array')
      assertEquals(array.maxItems, 10)
      assertEquals(array.description, undefined)
      assertEquals(array.nullable, undefined)
    })

    await t.step('should set oasType to schema and type to array', () => {
      const items = new OasUnknown()
      const array = new OasArray({ items })

      assertEquals(array.oasType, 'schema')
      assertEquals(array.type, 'array')
    })

    await t.step('should handle extension fields (x-* properties)', () => {
      const extensionFields = {
        'x-category': 'collection',
        'x-priority': 'high',
        'x-metadata': { nested: { deep: 'value' } }
      }

      const array = new OasArray({
        items: new OasUnknown(),
        extensionFields
      })

      assertEquals(array.extensionFields, extensionFields)
      assertEquals(array.extensionFields?.['x-category'], 'collection')
      assertEquals(array.extensionFields?.['x-priority'], 'high')
    })

    await t.step('should handle nullable arrays with null example', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        nullable: true,
        example: null
      })

      assertEquals(array.nullable, true)
      assertEquals(array.example, null)
    })

    await t.step('should handle uniqueItems constraint', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        uniqueItems: true
      })

      assertEquals(array.uniqueItems, true)
    })
  })

  await t.step('isRef() method', async t => {
    await t.step('should return false for OasArray instance (not a reference)', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Test Array'
      })

      assertEquals(array.isRef(), false)
    })

    await t.step('should work correctly with type narrowing', () => {
      const array = new OasArray({ items: new OasUnknown() })

      if (!array.isRef()) {
        // Type should be OasArray here, not OasRef<'schema'>
        assertEquals(array.oasType, 'schema')
        assertEquals(array.type, 'array')
      }
    })

    await t.step('should always return false regardless of properties', () => {
      const arrays = [
        new OasArray({ items: new OasUnknown() }),
        new OasArray({ items: new OasUnknown(), title: 'Array' }),
        new OasArray({ items: new OasUnknown(), nullable: true }),
        new OasArray({ items: new OasUnknown(), maxItems: 10, minItems: 1 })
      ]

      arrays.forEach(array => {
        assertEquals(array.isRef(), false)
      })
    })
  })

  await t.step('resolve() method', async t => {
    await t.step('should return self when called on OasArray instance', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Items Array',
        description: 'Array of items'
      })

      const resolved = array.resolve()

      assertEquals(resolved, array)
      assertEquals(resolved.title, 'Items Array')
      assertEquals(resolved.description, 'Array of items')
    })

    await t.step('should not throw errors', () => {
      const array = new OasArray({ items: new OasUnknown() })
      const resolved = array.resolve()
      assertEquals(resolved, array)
    })

    await t.step('should maintain all properties after resolve', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Product Array',
        description: 'Array of products',
        nullable: true,
        uniqueItems: true,
        maxItems: 50,
        minItems: 5,
        extensionFields: { 'x-version': '2.0' }
      })

      const resolved = array.resolve()

      assertEquals(resolved.title, 'Product Array')
      assertEquals(resolved.description, 'Array of products')
      assertEquals(resolved.nullable, true)
      assertEquals(resolved.uniqueItems, true)
      assertEquals(resolved.maxItems, 50)
      assertEquals(resolved.minItems, 5)
      assertEquals(resolved.extensionFields, { 'x-version': '2.0' })
    })
  })

  await t.step('resolveOnce() method', async t => {
    await t.step('should return self when called on OasArray instance', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        example: [1, 2, 3]
      })

      const resolved = array.resolveOnce()

      assertEquals(resolved, array)
      assertEquals(resolved.example, [1, 2, 3])
    })

    await t.step('should behave identically to resolve() for non-reference arrays', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Test Array',
        description: 'Test description'
      })

      const resolved = array.resolve()
      const resolvedOnce = array.resolveOnce()

      assertEquals(resolved, resolvedOnce)
      assertEquals(resolved, array)
    })

    await t.step('should maintain all properties after resolveOnce', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Tags',
        description: 'Array of tags',
        example: ['tag1', 'tag2', 'tag3'],
        uniqueItems: true,
        extensionFields: { 'x-tags': ['meta', 'collection'] }
      })

      const resolved = array.resolveOnce()

      assertEquals(resolved.title, 'Tags')
      assertEquals(resolved.description, 'Array of tags')
      assertEquals(resolved.example, ['tag1', 'tag2', 'tag3'])
      assertEquals(resolved.uniqueItems, true)
      assertEquals(resolved.extensionFields, { 'x-tags': ['meta', 'collection'] })
    })
  })

  await t.step('toJsonSchema() method', async t => {
    await t.step('should convert array to OpenAPI v3 JSON format', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Simple Array',
        description: 'A simple array'
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.type, 'array')
      assertEquals(result.title, 'Simple Array')
      assertEquals(result.description, 'A simple array')
      assertExists(result.items)
    })

    await t.step('should include all standard properties when provided', () => {
      const array = new OasArray({
        items: new OasUnknown({ title: 'Item' }),
        title: 'Complete Array',
        description: 'Array with all properties',
        nullable: true,
        uniqueItems: true,
        maxItems: 100,
        minItems: 1,
        example: [{ id: 1 }],
        enums: [[{ a: 1 }], [{ b: 2 }]],
        defaultValue: [{ default: true }],
        readOnly: true,
        writeOnly: false
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.type, 'array')
      assertEquals(result.title, 'Complete Array')
      assertEquals(result.description, 'Array with all properties')
      assertEquals(result.nullable, true)
      assertEquals(result.uniqueItems, true)
      assertEquals(result.maxItems, 100)
      assertEquals(result.minItems, 1)
      assertEquals(result.example, [{ id: 1 }])
      assertEquals(result.enum, [[{ a: 1 }], [{ b: 2 }]])
      assertEquals(result.default, [{ default: true }])
      assertEquals(result.readOnly, true)
      assertEquals(result.writeOnly, false)
    })

    await t.step('should recursively convert items schema', () => {
      const itemsSchema = new OasUnknown({ title: 'User', description: 'User object' })
      const array = new OasArray({
        items: itemsSchema,
        title: 'Users'
      })

      const result = array.toJsonSchema({ resolve: false })

      assertExists(result.items)
      // Items is a SchemaObject, not a ReferenceObject
      const items = result.items as OpenAPIV3.SchemaObject
      assertEquals(items.title, 'User')
      assertEquals(items.description, 'User object')
    })

    await t.step('should handle arrays with only items', () => {
      const array = new OasArray({ items: new OasUnknown() })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.type, 'array')
      assertExists(result.items)
      assertEquals(result.title, undefined)
      assertEquals(result.description, undefined)
    })

    await t.step('should handle nullable arrays', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        nullable: true
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.nullable, true)
    })

    await t.step('should handle example values', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        example: ['value1', 'value2', 'value3']
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.example, ['value1', 'value2', 'value3'])
    })

    await t.step('should handle enum arrays', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        enums: [
          ['a', 'b'],
          ['c', 'd'],
          ['e', 'f']
        ]
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.enum, [
        ['a', 'b'],
        ['c', 'd'],
        ['e', 'f']
      ])
    })

    await t.step('should handle default values', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        defaultValue: ['default1', 'default2']
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.default, ['default1', 'default2'])
    })

    await t.step('should handle minItems and maxItems constraints', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        minItems: 1,
        maxItems: 10
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.minItems, 1)
      assertEquals(result.maxItems, 10)
    })

    await t.step('should handle readOnly, writeOnly, and deprecated flags', () => {
      const readOnlyArray = new OasArray({
        items: new OasUnknown(),
        readOnly: true
      })

      const writeOnlyArray = new OasArray({
        items: new OasUnknown(),
        writeOnly: true
      })

      const result1 = readOnlyArray.toJsonSchema({ resolve: false })
      const result2 = writeOnlyArray.toJsonSchema({ resolve: false })

      assertEquals(result1.readOnly, true)
      assertEquals(result2.writeOnly, true)
    })

    await t.step('should handle uniqueItems constraint', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        uniqueItems: true
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.uniqueItems, true)
    })

    await t.step('should handle undefined optional fields', () => {
      const array = new OasArray({
        items: new OasUnknown()
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.title, undefined)
      assertEquals(result.description, undefined)
      assertEquals(result.nullable, undefined)
      assertEquals(result.uniqueItems, undefined)
      assertEquals(result.maxItems, undefined)
      assertEquals(result.minItems, undefined)
    })
  })

  await t.step('property handling and edge cases', async t => {
    await t.step('should handle items with OasUnknown schema', () => {
      const items = new OasUnknown({ title: 'Unknown Type' })
      const array = new OasArray({ items })

      assertEquals(array.items, items)
      assertEquals(array.items.type, 'unknown')
    })

    await t.step('should handle empty example array', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        example: []
      })

      assertEquals(array.example, [])
    })

    await t.step('should handle empty enums array', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        enums: []
      })

      assertEquals(array.enums, [])
    })

    await t.step('should handle empty defaultValue array', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        defaultValue: []
      })

      assertEquals(array.defaultValue, [])
    })

    await t.step('should handle zero minItems', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        minItems: 0
      })

      assertEquals(array.minItems, 0)
    })

    await t.step('should handle maxItems equal to minItems', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        minItems: 5,
        maxItems: 5
      })

      assertEquals(array.minItems, 5)
      assertEquals(array.maxItems, 5)
    })

    await t.step('should handle nullable with null in enums', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        nullable: true,
        enums: [['a'], null, ['b']]
      })

      assertEquals(array.nullable, true)
      assertEquals(array.enums, [['a'], null, ['b']])
    })

    await t.step('should handle nullable with null default value', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        nullable: true,
        defaultValue: null
      })

      assertEquals(array.nullable, true)
      assertEquals(array.defaultValue, null)
    })

    await t.step('should handle deprecated flag', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        deprecated: true
      })

      assertEquals(array.deprecated, true)
    })

    await t.step('should handle complex nested extension fields', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        extensionFields: {
          'x-custom': {
            nested: {
              deeply: {
                value: 'test',
                array: [1, 2, 3]
              }
            }
          }
        }
      })

      assertExists(array.extensionFields)
      assertEquals(array.extensionFields['x-custom'], {
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3]
          }
        }
      })
    })
  })

  await t.step('realistic API scenarios', async t => {
    await t.step('should handle array of strings with constraints', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Tags',
        description: 'Array of tag strings',
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
        example: ['typescript', 'deno', 'openapi']
      })

      assertEquals(array.title, 'Tags')
      assertEquals(array.minItems, 1)
      assertEquals(array.maxItems, 10)
      assertEquals(array.uniqueItems, true)
    })

    await t.step('should handle array of numbers with validation', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Scores',
        description: 'Array of numeric scores',
        minItems: 0,
        maxItems: 100,
        example: [95, 87, 92, 88],
        defaultValue: []
      })

      assertEquals(array.title, 'Scores')
      assertEquals(array.example, [95, 87, 92, 88])
      assertEquals(array.defaultValue, [])
    })

    await t.step('should handle array of objects (entities)', () => {
      const array = new OasArray({
        items: new OasUnknown({ title: 'User' }),
        title: 'Users',
        description: 'List of user objects',
        example: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.title, 'Users')
      assertExists(result.items)
      const items = result.items as OpenAPIV3.SchemaObject
      assertEquals(items.title, 'User')
      assertEquals(result.example, [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
    })

    await t.step('should handle read-only array response', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Results',
        description: 'Read-only results array',
        readOnly: true
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.readOnly, true)
      assertEquals(result.writeOnly, undefined)
    })

    await t.step('should handle write-only array input', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Permissions',
        description: 'Write-only permissions array',
        writeOnly: true
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.writeOnly, true)
      assertEquals(result.readOnly, undefined)
    })

    await t.step('should handle nullable array response', () => {
      const array = new OasArray({
        items: new OasUnknown(),
        title: 'Optional Items',
        description: 'Array that can be null',
        nullable: true,
        example: null
      })

      const result = array.toJsonSchema({ resolve: false })

      assertEquals(result.nullable, true)
      assertEquals(result.example, null)
    })

    await t.step('should handle paginated results array', () => {
      const array = new OasArray({
        items: new OasUnknown({ title: 'Item' }),
        title: 'Page Items',
        description: 'Paginated array of items',
        minItems: 0,
        maxItems: 50,
        example: [{ id: 1 }, { id: 2 }, { id: 3 }]
      })

      assertEquals(array.minItems, 0)
      assertEquals(array.maxItems, 50)
      assertEquals(array.example?.length, 3)
    })
  })
})
