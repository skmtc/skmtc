import { assertEquals } from '@std/assert'
import { parseNullable } from './parseNullable.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { ParseContextType } from '@/context/parseTypes.ts'

Deno.test('parseNullable', async (t) => {
  await t.step('valid boolean nullable values', async (t) => {
    await t.step('should return true when nullable is true', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        description: 'A nullable string',
      }
      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      assertEquals(result.value, {
        type: 'string',
        description: 'A nullable string',
      })
    })

    await t.step('should return false when nullable is false', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'number',
        nullable: false,
        minimum: 0,
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, false)
      assertEquals(result.value, {
        type: 'number',
        minimum: 0,
      })
    })

    await t.step('should return undefined when nullable is not present', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'integer',
        format: 'int32',
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'integer',
        format: 'int32',
      })
    })
  })

  await t.step('schema property preservation', async (t) => {
    await t.step('should preserve other schema properties', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        minLength: 5,
        maxLength: 100,
        pattern: '^[a-z]+$',
        description: 'A constrained string',
        example: 'hello',
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      assertEquals(result.value, {
        type: 'string',
        minLength: 5,
        maxLength: 100,
        pattern: '^[a-z]+$',
        description: 'A constrained string',
        example: 'hello',
      })
    })

    await t.step('should handle schema with only nullable property', () => {
      const schema: OpenAPIV3.SchemaObject = {
        nullable: false,
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        stackTrail,
        value: schema,
        context: mockParseContext,
      })

      assertEquals(result.nullable, false)
      assertEquals(result.value, {})
    })

    await t.step('should not mutate original schema', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        description: 'original',
      }

      const stackTrail = new StackTrail(['TEST'])
      parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      // Original schema should still have nullable
      assertEquals(schema.nullable, true)
      assertEquals(schema.type, 'string')
      assertEquals(schema.description, 'original')
    })
  })

  await t.step('different schema types with nullable', async (t) => {
    await t.step('should handle object schema with nullable', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'object',
        nullable: true,
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      assertEquals(result.value.type, 'object')
      assertEquals(result.value.properties, {
        name: { type: 'string' },
        age: { type: 'number' },
      })
    })

    await t.step('should handle array schema with nullable', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'array',
        nullable: false,
        items: { type: 'string' },
        minItems: 1,
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        stackTrail,
        value: schema,
        context: mockParseContext,
      })

      assertEquals(result.nullable, false)
      assertEquals(result.value, {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      })
    })

    await t.step('should handle boolean schema', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'boolean',
        nullable: true,
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      assertEquals(result.value, { type: 'boolean' })
    })

    await t.step('should handle complex nested schema', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'object',
        nullable: true,
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              roles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        required: ['user'],
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      assertEquals(result.value.type, 'object')
      assertEquals(result.value.required, ['user'])
    })
  })

  await t.step('invalid nullable values', async (t) => {
    await t.step('should handle string nullable value and log warning', () => {
      const schema = {
        type: 'string',
        nullable: 'yes',
        description: 'Invalid nullable',
      } as unknown as OpenAPIV3.SchemaObject

      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'string',
        description: 'Invalid nullable',
      })

      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [{
          key: 'nullable',
          stackTrail,
          parent: schema,
          level: 'warning',
          message: `Invalid nullable: ${schema}`,
          type: 'INVALID_NULLABLE',
        }],
      })

      contextSpy.restore()
    })

    await t.step('should handle number nullable value and log warning', () => {
      const schema = {
        type: 'number',
        nullable: 1,
      } as unknown as OpenAPIV3.SchemaObject

      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'number',
      })

      assertSpyCalls(contextSpy, 1)
      assertSpyCall(contextSpy, 0, {
        args: [{
          key: 'nullable',
          stackTrail,
          parent: schema,
          level: 'warning',
          message: `Invalid nullable: ${schema}`,
          type: 'INVALID_NULLABLE',
        }],
      })

      contextSpy.restore()
    })

    await t.step('should handle object nullable value and log warning', () => {
      const schema = {
        type: 'string',
        nullable: { value: true },
      } as unknown as OpenAPIV3.SchemaObject

      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'string',
      })

      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })

    await t.step('should handle array nullable value and log warning', () => {
      const schema = {
        type: 'string',
        nullable: [true],
      } as unknown as OpenAPIV3.SchemaObject

      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'string',
      })

      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })

    await t.step('should handle null nullable value and log warning', () => {
      const schema = {
        type: 'string',
        nullable: null,
      } as unknown as OpenAPIV3.SchemaObject

      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {
        type: 'string',
      })

      assertSpyCalls(contextSpy, 1)

      contextSpy.restore()
    })
  })

  await t.step('edge cases', async (t) => {
    await t.step('should handle empty schema object', () => {
      const schema: OpenAPIV3.SchemaObject = {}

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, undefined)
      assertEquals(result.value, {})
    })

    await t.step('should handle schema with many properties', () => {
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z]+$',
        format: 'email',
        description: 'Email address',
        example: 'user@example.com',
        title: 'User Email',
        default: 'default@example.com',
      }

      const stackTrail = new StackTrail(['TEST'])
      const result = parseNullable({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result.nullable, true)
      // All properties except nullable should be preserved
      assertEquals(Object.keys(result.value).length, 9)
      assertEquals(result.value.type, 'string')
      assertEquals(result.value.minLength, 1)
      assertEquals(result.value.description, 'Email address')
    })

    await t.step(
      'should preserve schema with no type but other properties',
      () => {
        const schema: OpenAPIV3.SchemaObject = {
          nullable: false,
          description: 'A schema without type',
          example: 'example',
        }

        const stackTrail = new StackTrail(['TEST'])
        const result = parseNullable({
          value: schema,
          stackTrail,
          context: mockParseContext,
        })

        assertEquals(result.nullable, false)
        assertEquals(result.value, {
          description: 'A schema without type',
          example: 'example',
        })
      },
    )
  })
})
