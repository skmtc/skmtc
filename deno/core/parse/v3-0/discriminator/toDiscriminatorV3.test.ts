import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toDiscriminatorV3 } from './toDiscriminatorV3.ts'
import { assertEquals, assertExists } from '@std/assert'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toDiscriminatorV3', async (t) => {
  await t.step('input handling', async (t) => {
    await t.step('should return undefined when discriminator is undefined', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toDiscriminatorV3({
        discriminator: undefined,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })

    await t.step('should handle discriminator with only propertyName', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'type',
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, new OasDiscriminator({ propertyName: 'type' }))
    })

    await t.step('should handle discriminator with propertyName as empty string', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: '',
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, '')
      assertEquals(result.mapping, undefined)
    })
  })

  await t.step('discriminator with mapping', async (t) => {
    await t.step('should handle discriminator with single mapping entry', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'petType',
        mapping: {
          'dog': '#/components/schemas/Dog',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(
        result,
        new OasDiscriminator({
          propertyName: 'petType',
          mapping: {
            'dog': '#/components/schemas/Dog',
          },
        })
      )
    })

    await t.step('should handle discriminator with multiple mapping entries', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'petType',
        mapping: {
          'cat': '#/components/schemas/Cat',
          'dog': '#/components/schemas/Dog',
          'bird': '#/components/schemas/Bird',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'petType')
      assertEquals(Object.keys(result.mapping ?? {}).length, 3)
      assertEquals(result.mapping?.['cat'], '#/components/schemas/Cat')
      assertEquals(result.mapping?.['dog'], '#/components/schemas/Dog')
      assertEquals(result.mapping?.['bird'], '#/components/schemas/Bird')
    })

    await t.step('should handle discriminator with empty mapping object', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'type',
        mapping: {},
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'type')
      assertEquals(result.mapping, {})
      assertEquals(Object.keys(result.mapping ?? {}).length, 0)
    })

    await t.step('should preserve mapping exactly as provided', () => {
      const stackTrail = new StackTrail(['TEST'])
      const mapping = {
        'typeA': '#/components/schemas/TypeA',
        'typeB': '#/components/schemas/TypeB',
      }
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'kind',
        mapping,
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.mapping, mapping)
      assertEquals(result.mapping === mapping, true) // Same object reference is preserved
    })

    await t.step('should handle mapping with schema references', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'objectType',
        mapping: {
          'user': '#/components/schemas/User',
          'admin': '#/components/schemas/Administrator',
          'guest': '#/components/schemas/GuestUser',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.mapping?.['user'], '#/components/schemas/User')
      assertEquals(result.mapping?.['admin'], '#/components/schemas/Administrator')
      assertEquals(result.mapping?.['guest'], '#/components/schemas/GuestUser')
    })
  })

  await t.step('skipped fields handling', async (t) => {
    await t.step('should identify unknown/extra fields as skipped', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator = {
        propertyName: 'type',
        'x-custom': 'value',
        'extra': 123,
      } as OpenAPIV3.DiscriminatorObject

      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'type')
      // Note: mockParseContext handles logging internally
    })

    await t.step('should handle discriminator with extension fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator = {
        propertyName: 'vehicleType',
        mapping: {
          'car': '#/components/schemas/Car',
        },
        'x-discriminator-description': 'Type of vehicle',
        'x-enum-values': ['car', 'truck', 'motorcycle'],
      } as OpenAPIV3.DiscriminatorObject

      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'vehicleType')
      assertEquals(result.mapping?.['car'], '#/components/schemas/Car')
      // Extension fields should not be included in the result
    })

    await t.step('should not log when no skipped fields exist', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'status',
        mapping: {
          'active': '#/components/schemas/ActiveStatus',
        },
      }

      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'status')
      // Note: mockParseContext handles logging internally
    })

    await t.step('should handle multiple unknown fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator = {
        propertyName: 'format',
        'x-field1': 'value1',
        'x-field2': 'value2',
        'x-field3': 'value3',
        'unknownField': true,
      } as OpenAPIV3.DiscriminatorObject

      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.propertyName, 'format')
      assertEquals(result.mapping, undefined)
    })
  })

  await t.step('field preservation', async (t) => {
    await t.step('should correctly extract propertyName field', () => {
      const stackTrail = new StackTrail(['TEST'])
      const propertyNames = ['type', 'kind', 'discriminatorField', '@type', 'object_type']

      propertyNames.forEach((name) => {
        const discriminator: OpenAPIV3.DiscriminatorObject = {
          propertyName: name,
        }
        const result = toDiscriminatorV3({
          discriminator,
          stackTrail,
          context: mockParseContext,
        })

        assertExists(result)
        assertEquals(result.propertyName, name)
      })
    })

    await t.step('should correctly extract mapping field when present', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'type',
        mapping: {
          'option1': '#/components/schemas/Option1',
          'option2': '#/components/schemas/Option2',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertExists(result.mapping)
      assertEquals(Object.keys(result.mapping).length, 2)
    })

    await t.step('should not mutate original input object', () => {
      const stackTrail = new StackTrail(['TEST'])
      const originalMapping = {
        'value1': '#/components/schemas/Schema1',
      }
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'field',
        mapping: originalMapping,
      }

      // Make a copy to compare later
      const originalPropertyName = discriminator.propertyName
      const originalMappingCopy = { ...originalMapping }

      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      // Verify original object is unchanged
      assertEquals(discriminator.propertyName, originalPropertyName)
      assertEquals(discriminator.mapping, originalMappingCopy)

      // Verify result has correct values
      assertExists(result)
      assertEquals(result.propertyName, originalPropertyName)
      assertEquals(result.mapping, originalMappingCopy)
    })
  })

  await t.step('complex scenarios', async (t) => {
    await t.step('should handle realistic OpenAPI discriminator with oneOf', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'Pet'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'petType',
        mapping: {
          'cat': 'Cat',
          'dog': 'Dog',
          'lizard': '#/components/schemas/Lizard',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.oasType, 'discriminator')
      assertEquals(result.propertyName, 'petType')
      assertEquals(result.mapping?.['cat'], 'Cat')
      assertEquals(result.mapping?.['dog'], 'Dog')
      assertEquals(result.mapping?.['lizard'], '#/components/schemas/Lizard')
    })

    await t.step('should handle discriminator with special characters in mapping keys', () => {
      const stackTrail = new StackTrail(['TEST'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'type',
        mapping: {
          'type-a': '#/components/schemas/TypeA',
          'type_b': '#/components/schemas/TypeB',
          'type.c': '#/components/schemas/TypeC',
          'type:d': '#/components/schemas/TypeD',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.mapping?.['type-a'], '#/components/schemas/TypeA')
      assertEquals(result.mapping?.['type_b'], '#/components/schemas/TypeB')
      assertEquals(result.mapping?.['type.c'], '#/components/schemas/TypeC')
      assertEquals(result.mapping?.['type:d'], '#/components/schemas/TypeD')
    })

    await t.step('should handle discriminator with all fields populated', () => {
      const stackTrail = new StackTrail(['components', 'schemas', 'Shape'])
      const discriminator: OpenAPIV3.DiscriminatorObject = {
        propertyName: 'shapeType',
        mapping: {
          'circle': '#/components/schemas/Circle',
          'square': '#/components/schemas/Square',
          'triangle': '#/components/schemas/Triangle',
          'rectangle': '#/components/schemas/Rectangle',
        },
      }
      const result = toDiscriminatorV3({
        discriminator,
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.oasType, 'discriminator')
      assertEquals(result.propertyName, 'shapeType')
      assertExists(result.mapping)
      assertEquals(Object.keys(result.mapping).length, 4)
      assertEquals(result.mapping['circle'], '#/components/schemas/Circle')
      assertEquals(result.mapping['square'], '#/components/schemas/Square')
      assertEquals(result.mapping['triangle'], '#/components/schemas/Triangle')
      assertEquals(result.mapping['rectangle'], '#/components/schemas/Rectangle')
    })
  })
})
