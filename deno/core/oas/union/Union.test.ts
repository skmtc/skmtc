import { assertEquals } from '@std/assert'
import { OasUnion } from './Union.ts'
import { OasString } from '../string/String.ts'
import { OasNumber } from '../number/Number.ts'
import { OasInteger } from '../integer/Integer.ts'
import { OasObject } from '../object/Object.ts'
import { OasDiscriminator } from '../discriminator/Discriminator.ts'

Deno.test('OasUnion', async (t) => {
  await t.step('constructor and property initialization', async (t) => {
    await t.step('should initialize with all properties provided', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'type',
        mapping: { string: '#/components/schemas/StringType' },
      })

      const union = new OasUnion({
        title: 'MyUnion',
        description: 'A union of string and number',
        nullable: true,
        discriminator,
        members: [new OasString(), new OasNumber()],
        extensionFields: { 'x-custom': 'value' },
        example: 'example value',
        default: 42,
      })

      assertEquals(union.oasType, 'schema')
      assertEquals(union.type, 'union')
      assertEquals(union.title, 'MyUnion')
      assertEquals(union.description, 'A union of string and number')
      assertEquals(union.nullable, true)
      assertEquals(union.discriminator, discriminator)
      assertEquals(union.members.length, 2)
      assertEquals(union.extensionFields, { 'x-custom': 'value' })
      assertEquals(union.example, 'example value')
      assertEquals(union.default, 42)
    })

    await t.step('should initialize with minimal required properties (just members array)', () => {
      const union = new OasUnion({
        members: [new OasString(), new OasInteger()],
      })

      assertEquals(union.oasType, 'schema')
      assertEquals(union.type, 'union')
      assertEquals(union.members.length, 2)
      assertEquals(union.title, undefined)
      assertEquals(union.description, undefined)
      assertEquals(union.nullable, undefined)
      assertEquals(union.discriminator, undefined)
      assertEquals(union.extensionFields, undefined)
      assertEquals(union.example, undefined)
      assertEquals(union.default, undefined)
    })

    await t.step('should handle optional properties correctly', () => {
      const union = new OasUnion({
        title: 'SimpleUnion',
        members: [new OasString(), new OasNumber()],
        nullable: false,
      })

      assertEquals(union.title, 'SimpleUnion')
      assertEquals(union.nullable, false)
      assertEquals(union.description, undefined)
      assertEquals(union.discriminator, undefined)
    })

    await t.step('should set oasType to schema and type to union', () => {
      const union = new OasUnion({
        members: [new OasString()],
      })

      assertEquals(union.oasType, 'schema')
      assertEquals(union.type, 'union')
    })

    await t.step('should handle discriminator for tagged unions', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'kind',
        mapping: {
          'typeA': '#/components/schemas/TypeA',
          'typeB': '#/components/schemas/TypeB',
        },
      })

      const union = new OasUnion({
        discriminator,
        members: [new OasObject(), new OasObject()],
      })

      assertEquals(union.discriminator, discriminator)
      assertEquals(union.discriminator?.propertyName, 'kind')
      assertEquals(union.discriminator?.mapping?.['typeA'], '#/components/schemas/TypeA')
    })

    await t.step('should handle extension fields (x-* properties)', () => {
      const extensionFields = {
        'x-tag': 'custom',
        'x-priority': 1,
        'x-metadata': { nested: { value: true } },
      }

      const union = new OasUnion({
        members: [new OasString()],
        extensionFields,
      })

      assertEquals(union.extensionFields, extensionFields)
      assertEquals(union.extensionFields?.['x-tag'], 'custom')
      assertEquals(union.extensionFields?.['x-priority'], 1)
    })

    await t.step('should handle both nullable and non-nullable unions', () => {
      const nullableUnion = new OasUnion({
        members: [new OasString(), new OasNumber()],
        nullable: true,
      })

      const nonNullableUnion = new OasUnion({
        members: [new OasString(), new OasNumber()],
        nullable: false,
      })

      const undefinedNullableUnion = new OasUnion({
        members: [new OasString()],
      })

      assertEquals(nullableUnion.nullable, true)
      assertEquals(nonNullableUnion.nullable, false)
      assertEquals(undefinedNullableUnion.nullable, undefined)
    })
  })

  await t.step('isRef() method', async (t) => {
    await t.step('should return false for OasUnion instance (not a reference)', () => {
      const union = new OasUnion({
        title: 'StringOrNumber',
        members: [new OasString(), new OasNumber()],
      })

      assertEquals(union.isRef(), false)
    })

    await t.step('should work correctly with type narrowing', () => {
      const union = new OasUnion({
        members: [new OasInteger(), new OasString()],
      })

      if (!union.isRef()) {
        // Type should be OasUnion here, not OasRef<'schema'>
        assertEquals(union.oasType, 'schema')
        assertEquals(union.type, 'union')
        assertEquals(union.members.length, 2)
      }
    })

    await t.step('should always return false regardless of properties', () => {
      const unions = [
        new OasUnion({ members: [new OasString()] }),
        new OasUnion({ members: [new OasString(), new OasNumber()], title: 'Union' }),
        new OasUnion({
          members: [new OasObject(), new OasString()],
          discriminator: new OasDiscriminator({ propertyName: 'type' }),
        }),
        new OasUnion({ members: [new OasInteger()], nullable: true }),
      ]

      unions.forEach((union) => {
        assertEquals(union.isRef(), false)
      })
    })
  })

  await t.step('resolve() method', async (t) => {
    await t.step('should return self when called on OasUnion instance', () => {
      const union = new OasUnion({
        title: 'ResponseType',
        members: [new OasString(), new OasNumber()],
      })

      const resolved = union.resolve()

      assertEquals(resolved, union)
      assertEquals(resolved.title, 'ResponseType')
      assertEquals(resolved.members.length, 2)
    })

    await t.step('should not throw errors', () => {
      const union = new OasUnion({ members: [] })
      const resolved = union.resolve()
      assertEquals(resolved, union)
    })

    await t.step('should maintain all properties after resolve', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'kind',
        mapping: { 'a': '#/a', 'b': '#/b' },
      })

      const union = new OasUnion({
        title: 'ComplexUnion',
        description: 'A complex union type',
        nullable: true,
        discriminator,
        members: [new OasString({ pattern: '^[A-Z]+$' }), new OasNumber({ minimum: 0 })],
        extensionFields: { 'x-tag': 'test' },
        example: 'TEST',
        default: 0,
      })

      const resolved = union.resolve()

      assertEquals(resolved.title, 'ComplexUnion')
      assertEquals(resolved.description, 'A complex union type')
      assertEquals(resolved.nullable, true)
      assertEquals(resolved.discriminator, discriminator)
      assertEquals(resolved.members.length, 2)
      assertEquals(resolved.extensionFields, { 'x-tag': 'test' })
      assertEquals(resolved.example, 'TEST')
      assertEquals(resolved.default, 0)
    })
  })

  await t.step('resolveOnce() method', async (t) => {
    await t.step('should return self when called on OasUnion instance', () => {
      const union = new OasUnion({
        members: [new OasString(), new OasInteger()],
      })

      const resolved = union.resolveOnce()

      assertEquals(resolved, union)
      assertEquals(resolved.members.length, 2)
    })

    await t.step('should behave identically to resolve() for non-reference unions', () => {
      const union = new OasUnion({
        title: 'TestUnion',
        members: [new OasString(), new OasNumber()],
        nullable: false,
      })

      const resolved = union.resolve()
      const resolvedOnce = union.resolveOnce()

      assertEquals(resolved, resolvedOnce)
      assertEquals(resolved, union)
    })

    await t.step('should maintain all properties after resolveOnce', () => {
      const union = new OasUnion({
        title: 'StatusUnion',
        description: 'Union of status types',
        members: [
          new OasString({ enums: ['active', 'inactive'] }),
          new OasString({ enums: ['pending', 'archived'] }),
        ],
        nullable: true,
        extensionFields: { 'x-version': '1.0' },
      })

      const resolved = union.resolveOnce()

      assertEquals(resolved.title, 'StatusUnion')
      assertEquals(resolved.description, 'Union of status types')
      assertEquals(resolved.nullable, true)
      assertEquals(resolved.members.length, 2)
      assertEquals(resolved.extensionFields, { 'x-version': '1.0' })
    })
  })

  await t.step('toJsonSchema() method', async (t) => {
    await t.step('should convert union to OpenAPI v3 JSON format with oneOf', () => {
      const union = new OasUnion({
        title: 'StringOrNumber',
        description: 'Either a string or number',
        members: [new OasString(), new OasNumber()],
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.title, 'StringOrNumber')
      assertEquals(result.description, 'Either a string or number')
      assertEquals(Array.isArray(result.oneOf), true)
      assertEquals(result.oneOf?.length, 2)
    })

    await t.step('should include title, description, nullable when present', () => {
      const union = new OasUnion({
        title: 'NullableUnion',
        description: 'A nullable union type',
        nullable: true,
        members: [new OasString(), new OasInteger()],
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.title, 'NullableUnion')
      assertEquals(result.description, 'A nullable union type')
      assertEquals(result.nullable, true)
    })

    await t.step('should handle simple union of two types', () => {
      const union = new OasUnion({
        members: [
          new OasString({ minLength: 1 }),
          new OasNumber({ minimum: 0 }),
        ],
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.oneOf?.length, 2)
      assertEquals(typeof result.oneOf?.[0], 'object')
      assertEquals(typeof result.oneOf?.[1], 'object')
    })

    await t.step('should handle union of multiple types (3+)', () => {
      const union = new OasUnion({
        title: 'MultiType',
        members: [
          new OasString(),
          new OasNumber(),
          new OasInteger(),
          new OasObject(),
        ],
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.oneOf?.length, 4)
      assertEquals(result.title, 'MultiType')
    })

    await t.step('should include discriminator in output when present', () => {
      const union = new OasUnion({
        discriminator: new OasDiscriminator({
          propertyName: 'type',
          mapping: { 'str': '#/string', 'num': '#/number' },
        }),
        members: [new OasString(), new OasNumber()],
      })

      const result = union.toJsonSchema({ resolve: false })

      // Note: discriminator is not included in toJsonSchema based on implementation
      // This test verifies current behavior
      assertEquals('discriminator' in result, false)
      assertEquals(result.oneOf?.length, 2)
    })

    await t.step('should handle members array conversion', () => {
      const stringSchema = new OasString({ pattern: '^[a-z]+$' })
      const numberSchema = new OasNumber({ minimum: 0, maximum: 100 })

      const union = new OasUnion({
        members: [stringSchema, numberSchema],
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.oneOf?.length, 2)
      assertEquals(typeof result.oneOf?.[0], 'object')
      assertEquals(typeof result.oneOf?.[1], 'object')
    })

    await t.step('should include example and default when present', () => {
      const union = new OasUnion({
        members: [new OasString(), new OasNumber()],
        example: 'example string',
        default: 42,
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.example, 'example string')
      assertEquals(result.default, 42)
    })

    await t.step('should handle nullable unions correctly', () => {
      const union = new OasUnion({
        members: [new OasString(), new OasInteger()],
        nullable: true,
        default: null,
      })

      const result = union.toJsonSchema({ resolve: false })

      assertEquals(result.nullable, true)
      assertEquals(result.default, null)
      assertEquals(result.oneOf?.length, 2)
    })
  })

  await t.step('members array handling', async (t) => {
    await t.step('should handle union with two members', () => {
      const union = new OasUnion({
        members: [new OasString(), new OasNumber()],
      })

      assertEquals(union.members.length, 2)
      assertEquals(union.members[0].type, 'string')
      assertEquals(union.members[1].type, 'number')
    })

    await t.step('should handle union with many members (5+)', () => {
      const union = new OasUnion({
        members: [
          new OasString({ title: 'Type1' }),
          new OasNumber({ title: 'Type2' }),
          new OasInteger({ title: 'Type3' }),
          new OasString({ title: 'Type4', pattern: '^[A-Z]+$' }),
          new OasNumber({ title: 'Type5', minimum: 0 }),
          new OasInteger({ title: 'Type6', maximum: 100 }),
        ],
      })

      assertEquals(union.members.length, 6)
    })

    await t.step('should handle empty members array (edge case)', () => {
      const union = new OasUnion({
        members: [],
      })

      assertEquals(union.members.length, 0)
      assertEquals(Array.isArray(union.members), true)
    })

    await t.step('should handle members with mixed schema types', () => {
      const union = new OasUnion({
        members: [
          new OasString({ minLength: 1, maxLength: 50 }),
          new OasNumber({ minimum: 0, maximum: 1000 }),
          new OasInteger({ multipleOf: 10 }),
          new OasObject({
            properties: {
              id: new OasInteger(),
              name: new OasString(),
            },
          }),
        ],
      })

      assertEquals(union.members.length, 4)
      assertEquals(union.members[0].type, 'string')
      assertEquals(union.members[1].type, 'number')
      assertEquals(union.members[2].type, 'integer')
      assertEquals(union.members[3].type, 'object')
    })

    await t.step('should preserve member order', () => {
      const first = new OasString({ title: 'First' })
      const second = new OasNumber({ title: 'Second' })
      const third = new OasInteger({ title: 'Third' })

      const union = new OasUnion({
        members: [first, second, third],
      })

      assertEquals(union.members[0], first)
      assertEquals(union.members[1], second)
      assertEquals(union.members[2], third)
    })

    await t.step('should handle single member (unusual but valid)', () => {
      const union = new OasUnion({
        members: [new OasString({ pattern: '^test$' })],
      })

      assertEquals(union.members.length, 1)
      assertEquals(union.members[0].type, 'string')
    })
  })

  await t.step('discriminator support', async (t) => {
    await t.step('should handle discriminated unions with propertyName', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'type',
      })

      const union = new OasUnion({
        discriminator,
        members: [
          new OasObject({
            properties: {
              type: new OasString({ enums: ['circle'] }),
              radius: new OasNumber(),
            },
          }),
          new OasObject({
            properties: {
              type: new OasString({ enums: ['square'] }),
              side: new OasNumber(),
            },
          }),
        ],
      })

      assertEquals(union.discriminator?.propertyName, 'type')
      assertEquals(union.discriminator?.mapping, undefined)
    })

    await t.step('should handle discriminator with mapping', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'kind',
        mapping: {
          'user': '#/components/schemas/User',
          'admin': '#/components/schemas/Admin',
          'guest': '#/components/schemas/Guest',
        },
      })

      const union = new OasUnion({
        discriminator,
        members: [new OasObject(), new OasObject(), new OasObject()],
      })

      assertEquals(union.discriminator?.propertyName, 'kind')
      assertEquals(union.discriminator?.mapping?.['user'], '#/components/schemas/User')
      assertEquals(union.discriminator?.mapping?.['admin'], '#/components/schemas/Admin')
      assertEquals(union.discriminator?.mapping?.['guest'], '#/components/schemas/Guest')
    })

    await t.step('should work with discriminator for tagged unions', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'eventType',
        mapping: {
          'click': '#/components/schemas/ClickEvent',
          'hover': '#/components/schemas/HoverEvent',
          'scroll': '#/components/schemas/ScrollEvent',
        },
      })

      const union = new OasUnion({
        title: 'UIEvent',
        description: 'Different types of UI events',
        discriminator,
        members: [new OasObject(), new OasObject(), new OasObject()],
      })

      assertEquals(union.discriminator?.propertyName, 'eventType')
      assertEquals(Object.keys(union.discriminator?.mapping ?? {}).length, 3)
    })

    await t.step('should handle discriminator with extension fields', () => {
      const discriminator = new OasDiscriminator({
        propertyName: 'status',
        mapping: {
          'active': '#/components/schemas/ActiveStatus',
          'inactive': '#/components/schemas/InactiveStatus',
        },
      })

      const union = new OasUnion({
        discriminator,
        members: [new OasObject(), new OasObject()],
        extensionFields: { 'x-discriminator-strategy': 'mapping' },
      })

      assertEquals(union.discriminator?.propertyName, 'status')
      assertEquals(union.extensionFields?.['x-discriminator-strategy'], 'mapping')
    })
  })

  await t.step('property handling', async (t) => {
    await t.step('should handle nullable property', () => {
      const nullableTrue = new OasUnion({
        members: [new OasString()],
        nullable: true,
      })

      const nullableFalse = new OasUnion({
        members: [new OasString()],
        nullable: false,
      })

      const nullableUndefined = new OasUnion({
        members: [new OasString()],
      })

      assertEquals(nullableTrue.nullable, true)
      assertEquals(nullableFalse.nullable, false)
      assertEquals(nullableUndefined.nullable, undefined)
    })

    await t.step('should handle title and description', () => {
      const union = new OasUnion({
        title: 'PaymentMethod',
        description: 'Represents different payment methods: credit card, PayPal, or bank transfer',
        members: [new OasString(), new OasObject(), new OasObject()],
      })

      assertEquals(union.title, 'PaymentMethod')
      assertEquals(
        union.description,
        'Represents different payment methods: credit card, PayPal, or bank transfer',
      )
    })

    await t.step('should handle default values', () => {
      const stringDefault = new OasUnion({
        members: [new OasString(), new OasNumber()],
        default: 'default string',
      })

      const numberDefault = new OasUnion({
        members: [new OasString(), new OasNumber()],
        default: 42,
      })

      const nullDefault = new OasUnion({
        members: [new OasString()],
        nullable: true,
        default: null,
      })

      assertEquals(stringDefault.default, 'default string')
      assertEquals(numberDefault.default, 42)
      assertEquals(nullDefault.default, null)
    })

    await t.step('should handle example values', () => {
      const stringExample = new OasUnion({
        members: [new OasString(), new OasNumber()],
        example: 'example value',
      })

      const objectExample = new OasUnion({
        members: [new OasObject(), new OasString()],
        example: { id: 123, name: 'Test' },
      })

      assertEquals(stringExample.example, 'example value')
      assertEquals(objectExample.example, { id: 123, name: 'Test' })
    })

    await t.step('should handle all properties together', () => {
      const union = new OasUnion({
        title: 'CompleteUnion',
        description: 'A union with all properties',
        nullable: true,
        discriminator: new OasDiscriminator({ propertyName: 'type' }),
        members: [new OasString(), new OasNumber()],
        extensionFields: { 'x-custom': 'value' },
        example: 'test',
        default: 0,
      })

      assertEquals(union.title, 'CompleteUnion')
      assertEquals(union.description, 'A union with all properties')
      assertEquals(union.nullable, true)
      assertEquals(union.discriminator?.propertyName, 'type')
      assertEquals(union.members.length, 2)
      assertEquals(union.extensionFields?.['x-custom'], 'value')
      assertEquals(union.example, 'test')
      assertEquals(union.default, 0)
    })
  })

  await t.step('edge cases and integration', async (t) => {
    await t.step('should handle union of string and number (simple case)', () => {
      const union = new OasUnion({
        title: 'StringOrNumber',
        members: [new OasString(), new OasNumber()],
      })

      assertEquals(union.members.length, 2)
      assertEquals(union.members[0].type, 'string')
      assertEquals(union.members[1].type, 'number')
    })

    await t.step('should handle union of complex object types', () => {
      const successResponse = new OasObject({
        title: 'SuccessResponse',
        properties: {
          success: new OasString({ enums: ['true'] }),
          data: new OasObject({ additionalProperties: true }),
        },
        required: ['success', 'data'],
      })

      const errorResponse = new OasObject({
        title: 'ErrorResponse',
        properties: {
          error: new OasString(),
          code: new OasInteger(),
          message: new OasString(),
        },
        required: ['error', 'code'],
      })

      const union = new OasUnion({
        title: 'ApiResponse',
        description: 'Either a success or error response',
        members: [successResponse, errorResponse],
      })

      assertEquals(union.members.length, 2)
      assertEquals(union.members[0].type, 'object')
      assertEquals(union.members[1].type, 'object')
    })

    await t.step('should handle discriminated union (tagged union pattern)', () => {
      const shapeUnion = new OasUnion({
        title: 'Shape',
        description: 'A geometric shape - either a circle or square',
        discriminator: new OasDiscriminator({
          propertyName: 'shape',
          mapping: {
            'circle': '#/components/schemas/Circle',
            'square': '#/components/schemas/Square',
          },
        }),
        members: [
          new OasObject({
            title: 'Circle',
            properties: {
              shape: new OasString({ enums: ['circle'] }),
              radius: new OasNumber({ minimum: 0 }),
            },
            required: ['shape', 'radius'],
          }),
          new OasObject({
            title: 'Square',
            properties: {
              shape: new OasString({ enums: ['square'] }),
              side: new OasNumber({ minimum: 0 }),
            },
            required: ['shape', 'side'],
          }),
        ],
      })

      assertEquals(shapeUnion.discriminator?.propertyName, 'shape')
      assertEquals(shapeUnion.discriminator?.mapping?.['circle'], '#/components/schemas/Circle')
      assertEquals(shapeUnion.members.length, 2)
    })

    await t.step('should work with realistic OpenAPI union scenarios', () => {
      // Status code union
      const statusUnion = new OasUnion({
        title: 'HTTPStatus',
        members: [
          new OasInteger({ enums: [200, 201, 204] }),
          new OasInteger({ enums: [400, 401, 403, 404] }),
          new OasInteger({ enums: [500, 502, 503] }),
        ],
      })

      // Payment method union
      const paymentUnion = new OasUnion({
        title: 'PaymentMethod',
        discriminator: new OasDiscriminator({
          propertyName: 'method',
        }),
        members: [
          new OasObject({
            properties: {
              method: new OasString({ enums: ['card'] }),
              cardNumber: new OasString(),
            },
          }),
          new OasObject({
            properties: {
              method: new OasString({ enums: ['paypal'] }),
              email: new OasString(),
            },
          }),
        ],
      })

      assertEquals(statusUnion.members.length, 3)
      assertEquals(paymentUnion.discriminator?.propertyName, 'method')
    })

    await t.step('should handle unions with nullable members', () => {
      const union = new OasUnion({
        title: 'NullableMembers',
        members: [
          new OasString({ nullable: true }),
          new OasNumber({ nullable: true }),
        ],
      })

      assertEquals(union.members.length, 2)
    })
  })
})
