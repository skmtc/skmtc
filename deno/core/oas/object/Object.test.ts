import { assert, assertEquals, assertStrictEquals } from '@std/assert'
import { OasObject, type OasObjectFields, type AddPropertyArgs } from './Object.ts'
import { OasString } from '../string/String.ts'
import { OasNumber } from '../number/Number.ts'
import { OasInteger } from '../integer/Integer.ts'
import { OasBoolean } from '../boolean/Boolean.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'

const mockOptions: ToJsonSchemaOptions = { resolve: false }

Deno.test('OasObject', async (t) => {
  await t.step('constructor and property initialization', async (t) => {
    await t.step('should initialize with all properties provided', () => {
      const obj = new OasObject({
        title: 'User',
        description: 'A user object',
        properties: {
          id: new OasString(),
          name: new OasString()
        },
        required: ['id'],
        additionalProperties: false,
        nullable: false,
        maxProperties: 10,
        minProperties: 1,
        example: { id: '123', name: 'John' },
        default: { id: '0', name: 'Guest' },
        readOnly: true,
        writeOnly: false,
        deprecated: true,
        extensionFields: { 'x-custom': 'value' },
        enums: [{ status: 'active' }, { status: 'inactive' }]
      })

      assertEquals(obj.oasType, 'schema')
      assertEquals(obj.type, 'object')
      assertEquals(obj.title, 'User')
      assertEquals(obj.description, 'A user object')
      assertEquals(Object.keys(obj.properties ?? {}).length, 2)
      assertEquals(obj.required, ['id'])
      assertEquals(obj.additionalProperties, false)
      assertEquals(obj.nullable, false)
      assertEquals(obj.maxProperties, 10)
      assertEquals(obj.minProperties, 1)
      assertEquals(obj.example, { id: '123', name: 'John' })
      assertEquals(obj.default, { id: '0', name: 'Guest' })
      assertEquals(obj.readOnly, true)
      assertEquals(obj.writeOnly, undefined)
      assertEquals(obj.deprecated, true)
      assertEquals(obj.extensionFields, { 'x-custom': 'value' })
      assertEquals(obj.enums?.length, 2)
    })

    await t.step('should initialize with minimal/empty fields', () => {
      const obj = new OasObject()

      assertEquals(obj.oasType, 'schema')
      assertEquals(obj.type, 'object')
      assertEquals(obj.title, undefined)
      assertEquals(obj.description, undefined)
      assertEquals(obj.properties, undefined)
      assertEquals(obj.required, undefined)
      assertEquals(obj.additionalProperties, undefined)
      assertEquals(obj.nullable, undefined)
      assertEquals(obj.extensionFields, undefined)
    })

    await t.step('should initialize with nullable=true', () => {
      const obj = new OasObject<true>({
        nullable: true,
        default: null,
        example: null,
        enums: [{ status: 'active' }, null]
      })

      assertEquals(obj.nullable, true)
      assertEquals(obj.default, null)
      assertEquals(obj.example, null)
      assertEquals(obj.enums, [{ status: 'active' }, null])
    })

    await t.step('should initialize with nullable=false', () => {
      const obj = new OasObject<false>({
        nullable: false,
        default: { value: 'test' },
        example: { value: 'example' }
      })

      assertEquals(obj.nullable, false)
      assertEquals(obj.default, { value: 'test' })
      assertEquals(obj.example, { value: 'example' })
    })

    await t.step('should initialize properties with various schema types', () => {
      const obj = new OasObject({
        properties: {
          name: new OasString(),
          age: new OasInteger(),
          score: new OasNumber(),
          active: new OasBoolean()
        }
      })

      assertEquals(Object.keys(obj.properties ?? {}).length, 4)
      assert(obj.properties?.name instanceof OasString)
      assert(obj.properties?.age instanceof OasInteger)
      assert(obj.properties?.score instanceof OasNumber)
      assert(obj.properties?.active instanceof OasBoolean)
    })

    await t.step('should initialize with empty properties and required arrays', () => {
      const obj = new OasObject({
        properties: {},
        required: []
      })

      assertEquals(obj.properties, {})
      assertEquals(obj.required, [])
    })

    await t.step('should initialize with extension fields', () => {
      const obj = new OasObject({
        extensionFields: {
          'x-internal': true,
          'x-custom-field': 'custom value',
          'x-metadata': { key: 'value' }
        }
      })

      assertEquals(obj.extensionFields?.['x-internal'], true)
      assertEquals(obj.extensionFields?.['x-custom-field'], 'custom value')
      assertEquals(obj.extensionFields?.['x-metadata'], { key: 'value' })
    })

    await t.step('should initialize with complex nested schema properties', () => {
      const obj = new OasObject({
        properties: {
          user: new OasObject({
            properties: {
              name: new OasString(),
              email: new OasString()
            }
          }),
          tags: new OasObject({
            additionalProperties: new OasString()
          })
        }
      })

      assertEquals(Object.keys(obj.properties ?? {}).length, 2)
      assert(obj.properties?.user instanceof OasObject)
      assert(obj.properties?.tags instanceof OasObject)
    })

    await t.step('should initialize with nested object properties', () => {
      const obj = new OasObject({
        properties: {
          nested: new OasObject({
            properties: {
              innerField: new OasString()
            }
          })
        }
      })

      assertEquals(Object.keys(obj.properties ?? {}).length, 1)
      assert(obj.properties?.nested instanceof OasObject)
    })

    await t.step('should initialize with validation constraints', () => {
      const obj = new OasObject({
        maxProperties: 5,
        minProperties: 1,
        required: ['id', 'name']
      })

      assertEquals(obj.maxProperties, 5)
      assertEquals(obj.minProperties, 1)
      assertEquals(obj.required, ['id', 'name'])
    })
  })

  await t.step('OasObject.empty() static factory', async (t) => {
    await t.step('should create proper empty object', () => {
      const obj = OasObject.empty()

      assertEquals(obj.oasType, 'schema')
      assertEquals(obj.type, 'object')
      assertEquals(obj.properties, {})
      assertEquals(obj.required, [])
      assertEquals(obj.nullable, false)
    })

    await t.step('should return non-nullable object', () => {
      const obj = OasObject.empty()

      assertEquals(obj.nullable, false)
    })

    await t.step('should have empty properties and required arrays', () => {
      const obj = OasObject.empty()

      assertEquals(Object.keys(obj.properties ?? {}).length, 0)
      assertEquals(obj.required?.length, 0)
    })
  })

  await t.step('addProperty() method', async (t) => {
    await t.step('should add property without required flag', () => {
      const obj = OasObject.empty()
      const result = obj.addProperty({
        name: 'username',
        schema: new OasString()
      })

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assert(result.properties?.username instanceof OasString)
      assertEquals(result.required, [])
    })

    await t.step('should add property with required=true', () => {
      const obj = OasObject.empty()
      const result = obj.addProperty({
        name: 'userId',
        schema: new OasString(),
        required: true
      })

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.required, ['userId'])
    })

    await t.step('should add property with required=false', () => {
      const obj = OasObject.empty()
      const result = obj.addProperty({
        name: 'optionalField',
        schema: new OasString(),
        required: false
      })

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.required, [])
    })

    await t.step('should chain multiple addProperty calls', () => {
      const result = OasObject.empty()
        .addProperty({ name: 'id', schema: new OasInteger(), required: true })
        .addProperty({ name: 'name', schema: new OasString(), required: true })
        .addProperty({ name: 'age', schema: new OasInteger(), required: false })

      assertEquals(Object.keys(result.properties ?? {}).length, 3)
      assertEquals(result.required, ['id', 'name'])
    })

    await t.step('should return same instance when schema is undefined', () => {
      const obj = OasObject.empty()
      const result = obj.addProperty({
        name: 'test',
        schema: undefined
      })

      assertStrictEquals(result, obj)
    })

    await t.step('should return new instance (immutability)', () => {
      const obj = OasObject.empty()
      const result = obj.addProperty({
        name: 'field',
        schema: new OasString()
      })

      assert(result !== obj)
      assertEquals(Object.keys(obj.properties ?? {}).length, 0)
      assertEquals(Object.keys(result.properties ?? {}).length, 1)
    })

    await t.step('should preserve existing properties', () => {
      const obj = new OasObject({
        properties: {
          existing: new OasString()
        },
        required: ['existing']
      })

      const result = obj.addProperty({
        name: 'newField',
        schema: new OasNumber(),
        required: true
      })

      assertEquals(Object.keys(result.properties ?? {}).length, 2)
      assert(result.properties?.existing instanceof OasString)
      assert(result.properties?.newField instanceof OasNumber)
      assertEquals(result.required, ['existing', 'newField'])
    })

    await t.step('should preserve other object properties when adding', () => {
      const obj = new OasObject({
        title: 'TestObject',
        description: 'Test description',
        additionalProperties: false,
        nullable: false,
        extensionFields: { 'x-custom': 'value' }
      })

      const result = obj.addProperty({
        name: 'field',
        schema: new OasString()
      })

      assertEquals(result.title, 'TestObject')
      assertEquals(result.description, 'Test description')
      assertEquals(result.additionalProperties, false)
      assertEquals(result.nullable, false)
      assertEquals(result.extensionFields, { 'x-custom': 'value' })
    })
  })

  await t.step('removeProperty() method', async (t) => {
    await t.step('should remove existing property', () => {
      const obj = new OasObject({
        properties: {
          field1: new OasString(),
          field2: new OasNumber()
        }
      })

      const result = obj.removeProperty('field1')

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.properties?.field1, undefined)
      assert(result.properties?.field2 instanceof OasNumber)
    })

    await t.step('should return same instance for non-existent property', () => {
      const obj = OasObject.empty()
      const result = obj.removeProperty('nonExistent')

      assertStrictEquals(result, obj)
    })

    await t.step('should remove required property and update required array', () => {
      const obj = new OasObject({
        properties: {
          id: new OasString(),
          name: new OasString()
        },
        required: ['id', 'name']
      })

      const result = obj.removeProperty('id')

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.required, ['name'])
    })

    await t.step('should remove non-required property without affecting required array', () => {
      const obj = new OasObject({
        properties: {
          id: new OasString(),
          optional: new OasString()
        },
        required: ['id']
      })

      const result = obj.removeProperty('optional')

      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.required, ['id'])
    })

    await t.step('should return new instance (immutability)', () => {
      const obj = new OasObject({
        properties: {
          field: new OasString()
        }
      })

      const result = obj.removeProperty('field')

      assert(result !== obj)
      assertEquals(Object.keys(obj.properties ?? {}).length, 1)
      assertEquals(Object.keys(result.properties ?? {}).length, 0)
    })

    await t.step('should preserve other properties when removing', () => {
      const obj = new OasObject({
        title: 'TestObject',
        description: 'Test description',
        properties: {
          field1: new OasString(),
          field2: new OasString()
        },
        additionalProperties: false,
        nullable: false,
        extensionFields: { 'x-custom': 'value' }
      })

      const result = obj.removeProperty('field1')

      assertEquals(result.title, 'TestObject')
      assertEquals(result.description, 'Test description')
      assertEquals(result.additionalProperties, false)
      assertEquals(result.nullable, false)
      assertEquals(result.extensionFields, { 'x-custom': 'value' })
    })
  })

  await t.step('isRef() method', async (t) => {
    await t.step('should always return false', () => {
      const obj1 = OasObject.empty()
      const obj2 = new OasObject({ title: 'Test' })
      const obj3 = new OasObject({ nullable: true })

      assertEquals(obj1.isRef(), false)
      assertEquals(obj2.isRef(), false)
      assertEquals(obj3.isRef(), false)
    })

    await t.step('should return false for objects with properties', () => {
      const obj = new OasObject({
        properties: {
          field: new OasString()
        }
      })

      assertEquals(obj.isRef(), false)
    })
  })

  await t.step('resolve() method', async (t) => {
    await t.step('should return itself', () => {
      const obj = new OasObject({ title: 'Test' })
      const result = obj.resolve()

      assertStrictEquals(result, obj)
    })

    await t.step('should maintain properties after resolve', () => {
      const obj = new OasObject({
        title: 'User',
        properties: {
          id: new OasString()
        }
      })

      const result = obj.resolve()

      assertEquals(result.title, 'User')
      assertEquals(Object.keys(result.properties ?? {}).length, 1)
    })
  })

  await t.step('resolveOnce() method', async (t) => {
    await t.step('should return itself', () => {
      const obj = new OasObject({ description: 'Test object' })
      const result = obj.resolveOnce()

      assertStrictEquals(result, obj)
    })

    await t.step('should maintain properties after resolveOnce', () => {
      const obj = new OasObject({
        description: 'User object',
        properties: {
          name: new OasString()
        },
        required: ['name']
      })

      const result = obj.resolveOnce()

      assertEquals(result.description, 'User object')
      assertEquals(Object.keys(result.properties ?? {}).length, 1)
      assertEquals(result.required, ['name'])
    })
  })

  await t.step('toJsonSchema() method', async (t) => {
    await t.step('should convert basic object with properties', () => {
      const obj = new OasObject({
        title: 'User',
        description: 'A user object',
        properties: {
          id: new OasString(),
          name: new OasString()
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.type, 'object')
      assertEquals(json.title, 'User')
      assertEquals(json.description, 'A user object')
      assertEquals(Object.keys(json.properties ?? {}).length, 2)
      assertEquals(json.additionalProperties, false)
    })

    await t.step('should handle additionalProperties as boolean true', () => {
      const obj = new OasObject({
        additionalProperties: true
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.additionalProperties, true)
    })

    await t.step('should handle additionalProperties as boolean false', () => {
      const obj = new OasObject({
        additionalProperties: false
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.additionalProperties, false)
    })

    await t.step('should handle additionalProperties as schema', () => {
      const obj = new OasObject({
        additionalProperties: new OasString()
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(typeof json.additionalProperties, 'object')
      assertEquals((json.additionalProperties as any).type, 'string')
    })

    await t.step('should default additionalProperties to false when undefined', () => {
      const obj = new OasObject({
        properties: {
          id: new OasString()
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.additionalProperties, false)
    })

    await t.step('should default additionalProperties to false when null', () => {
      const obj = new OasObject({
        properties: {
          id: new OasString()
        },
        additionalProperties: null as any
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.additionalProperties, false)
    })

    await t.step('should include required fields', () => {
      const obj = new OasObject({
        properties: {
          id: new OasString(),
          name: new OasString()
        },
        required: ['id', 'name']
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.required, ['id', 'name'])
    })

    await t.step('should include min/max properties constraints', () => {
      const obj = new OasObject({
        minProperties: 1,
        maxProperties: 10
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.minProperties, 1)
      assertEquals(json.maxProperties, 10)
    })

    await t.step('should include nullable flag', () => {
      const obj = new OasObject<true>({
        nullable: true
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.nullable, true)
    })

    await t.step('should include example value', () => {
      const obj = new OasObject({
        example: { id: '123', name: 'John' }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.example, { id: '123', name: 'John' })
    })

    await t.step('should include enums', () => {
      const obj = new OasObject({
        enums: [
          { status: 'active' },
          { status: 'inactive' }
        ]
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.enum, [{ status: 'active' }, { status: 'inactive' }])
    })

    await t.step('should exclude extensionFields from JSON schema', () => {
      const obj = new OasObject({
        extensionFields: {
          'x-custom': 'value',
          'x-internal': true
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.hasOwnProperty('extensionFields'), false)
      assertEquals((json as any)['x-custom'], undefined)
      assertEquals((json as any)['x-internal'], undefined)
    })

    await t.step('should include readOnly and deprecated flags', () => {
      const obj = new OasObject({
        readOnly: true,
        deprecated: true
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.readOnly, true)
      assertEquals(json.deprecated, true)
    })

    await t.step('should handle undefined properties', () => {
      const obj = new OasObject()

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.type, 'object')
      assertEquals(json.properties, undefined)
      assertEquals(json.required, undefined)
    })

    await t.step('should handle empty properties object', () => {
      const obj = new OasObject({
        properties: {}
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.properties, {})
    })
  })

  await t.step('property handling', async (t) => {
    await t.step('should handle properties with various schema types', () => {
      const obj = new OasObject({
        properties: {
          stringField: new OasString(),
          numberField: new OasNumber(),
          integerField: new OasInteger(),
          booleanField: new OasBoolean()
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals((json.properties as any).stringField.type, 'string')
      assertEquals((json.properties as any).numberField.type, 'number')
      assertEquals((json.properties as any).integerField.type, 'integer')
      assertEquals((json.properties as any).booleanField.type, 'boolean')
    })

    await t.step('should handle nested object properties in toJsonSchema', () => {
      const obj = new OasObject({
        properties: {
          nested: new OasObject({
            properties: {
              innerField: new OasString()
            }
          })
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals((json.properties as any).nested.type, 'object')
    })

    await t.step('should handle complex nested object properties', () => {
      const obj = new OasObject({
        properties: {
          address: new OasObject({
            properties: {
              street: new OasString(),
              city: new OasString()
            },
            required: ['street']
          })
        }
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals((json.properties as any).address.type, 'object')
      assertEquals(Object.keys((json.properties as any).address.properties).length, 2)
      assertEquals((json.properties as any).address.required, ['street'])
    })

    await t.step('should handle empty properties object', () => {
      const obj = new OasObject({
        properties: {}
      })

      assertEquals(Object.keys(obj.properties ?? {}).length, 0)
    })

    await t.step('should handle additionalProperties as boolean', () => {
      const obj1 = new OasObject({ additionalProperties: true })
      const obj2 = new OasObject({ additionalProperties: false })

      assertEquals(obj1.additionalProperties, true)
      assertEquals(obj2.additionalProperties, false)
    })

    await t.step('should handle additionalProperties as schema', () => {
      const obj = new OasObject({
        additionalProperties: new OasString({ minLength: 1 })
      })

      assert(obj.additionalProperties instanceof OasString)
    })

    await t.step('should handle additionalProperties as nested object', () => {
      const obj = new OasObject({
        additionalProperties: new OasObject({
          properties: {
            value: new OasString()
          }
        })
      })

      assert(obj.additionalProperties instanceof OasObject)
    })
  })

  await t.step('nullable type support', async (t) => {
    await t.step('should allow null default when nullable=true', () => {
      const obj = new OasObject<true>({
        nullable: true,
        default: null
      })

      assertEquals(obj.nullable, true)
      assertEquals(obj.default, null)
    })

    await t.step('should allow null example when nullable=true', () => {
      const obj = new OasObject<true>({
        nullable: true,
        example: null
      })

      assertEquals(obj.nullable, true)
      assertEquals(obj.example, null)
    })

    await t.step('should allow null in enums when nullable=true', () => {
      const obj = new OasObject<true>({
        nullable: true,
        enums: [{ status: 'active' }, null]
      })

      assertEquals(obj.nullable, true)
      assertEquals(obj.enums, [{ status: 'active' }, null])
    })

    await t.step('should not allow null when nullable=false', () => {
      const obj = new OasObject<false>({
        nullable: false,
        default: { value: 'test' },
        example: { value: 'example' }
      })

      assertEquals(obj.nullable, false)
      assertEquals(obj.default, { value: 'test' })
      assertEquals(obj.example, { value: 'example' })
    })

    await t.step('should handle nullable in toJsonSchema', () => {
      const objNullable = new OasObject<true>({ nullable: true })
      const objNotNullable = new OasObject<false>({ nullable: false })

      const jsonNullable = objNullable.toJsonSchema(mockOptions)
      const jsonNotNullable = objNotNullable.toJsonSchema(mockOptions)

      assertEquals(jsonNullable.nullable, true)
      assertEquals(jsonNotNullable.nullable, false)
    })

    await t.step('should handle undefined properties when nullable=true', () => {
      const obj = new OasObject<true>({
        nullable: true,
        properties: undefined
      })

      assertEquals(obj.nullable, true)
      assertEquals(obj.properties, undefined)
    })
  })

  await t.step('edge cases and integration', async (t) => {
    await t.step('should handle empty object with no properties', () => {
      const obj = new OasObject()

      assertEquals(obj.oasType, 'schema')
      assertEquals(obj.type, 'object')
      assertEquals(obj.properties, undefined)
    })

    await t.step('should handle object with only extension fields', () => {
      const obj = new OasObject({
        extensionFields: {
          'x-custom': 'value',
          'x-metadata': { key: 'value' }
        }
      })

      assertEquals(obj.extensionFields?.['x-custom'], 'value')
      assertEquals(obj.extensionFields?.['x-metadata'], { key: 'value' })
    })

    await t.step('should handle complex nested object structures', () => {
      const obj = new OasObject({
        properties: {
          user: new OasObject({
            properties: {
              profile: new OasObject({
                properties: {
                  avatar: new OasString()
                }
              })
            }
          })
        }
      })

      assert(obj.properties?.user instanceof OasObject)
      const userObj = obj.properties?.user as OasObject
      assert(userObj.properties?.profile instanceof OasObject)
    })

    await t.step('should handle record-style objects with additionalProperties', () => {
      const obj = new OasObject({
        title: 'StringMap',
        additionalProperties: new OasString(),
        minProperties: 1
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.title, 'StringMap')
      assertEquals(typeof json.additionalProperties, 'object')
      assertEquals(json.minProperties, 1)
    })

    await t.step('should handle mixed property types', () => {
      const obj = new OasObject({
        properties: {
          stringField: new OasString(),
          numberField: new OasNumber(),
          nested: new OasObject({ properties: { field: new OasNumber() } })
        }
      })

      assertEquals(Object.keys(obj.properties ?? {}).length, 3)
      assert(obj.properties?.stringField instanceof OasString)
      assert(obj.properties?.numberField instanceof OasNumber)
      assert(obj.properties?.nested instanceof OasObject)
    })

    await t.step('should handle all validation constraints together', () => {
      const obj = new OasObject({
        minProperties: 1,
        maxProperties: 10,
        required: ['id', 'name'],
        additionalProperties: false
      })

      const json = obj.toJsonSchema(mockOptions)

      assertEquals(json.minProperties, 1)
      assertEquals(json.maxProperties, 10)
      assertEquals(json.required, ['id', 'name'])
      assertEquals(json.additionalProperties, false)
    })

    await t.step('should handle complete object lifecycle', () => {
      const obj1 = OasObject.empty()

      const obj2 = obj1.addProperty({
        name: 'id',
        schema: new OasString(),
        required: true
      })

      const obj3 = obj2.addProperty({
        name: 'name',
        schema: new OasString(),
        required: true
      })

      const obj4 = obj3.addProperty({
        name: 'temp',
        schema: new OasString(),
        required: false
      })

      const obj5 = obj4.removeProperty('temp')

      assertEquals(Object.keys(obj5.properties ?? {}).length, 2)
      assertEquals(obj5.required, ['id', 'name'])

      const json = obj5.toJsonSchema(mockOptions)
      assertEquals(json.type, 'object')
      assertEquals(Object.keys(json.properties ?? {}).length, 2)
      assertEquals(json.required, ['id', 'name'])
    })

    await t.step('should maintain oasType and type throughout lifecycle', () => {
      let obj = OasObject.empty()
        .addProperty({ name: 'field1', schema: new OasString() })
        .addProperty({ name: 'field2', schema: new OasNumber() })
        .removeProperty('field1')

      assertEquals(obj.oasType, 'schema')
      assertEquals(obj.type, 'object')

      const resolved = obj.resolve()
      assertEquals(resolved.oasType, 'schema')
      assertEquals(resolved.type, 'object')
    })
  })
})
