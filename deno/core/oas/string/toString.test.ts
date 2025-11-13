import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toString, toParsedString } from './toString.ts'
import { assertEquals, assertExists } from '@std/assert'
import { OasString } from './String.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import type { ParseContextType } from '@/context/parseTypes.ts'

Deno.test('toString', async (t) => {
  await t.step('minimal schema', async (t) => {
    await t.step('should return empty OasString for basic string type', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = { type: 'string' }
      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString, new OasString())
    })
  })

  await t.step('nullable handling', async (t) => {
    await t.step('should handle nullable: true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        description: 'A nullable string',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.nullable, true)
      assertEquals(oasString.description, 'A nullable string')
    })

    await t.step('should handle nullable: false', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: false,
        description: 'A non-nullable string',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.nullable, false)
      assertEquals(oasString.description, 'A non-nullable string')
    })

    await t.step('should handle missing nullable property', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        description: 'A string without nullable',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.nullable, undefined)
    })
  })

  await t.step('example handling', async (t) => {
    await t.step('should preserve valid string example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        example: 'test example',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.example, 'test example')
    })

    await t.step('should allow null example when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        example: null,
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.example, null)
    })

    await t.step('should remove invalid example and log warning', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema = {
        type: 'string',
        example: 123,
      } as unknown as OpenAPIV3.SchemaObject

      const contextSpy = spy(mockParseContext, 'logIssue')

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(oasString.example, undefined)
      // Verify logIssue was called with example error
      assertEquals(contextSpy.calls.length >= 1, true)

      contextSpy.restore()
    })

    await t.step('should handle undefined example', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.example, undefined)
    })
  })

  await t.step('enum handling', async (t) => {
    await t.step('should preserve valid string enums', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.enums, ['active', 'inactive', 'pending'])
    })

    await t.step('should allow null in enums when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        enum: ['active', null, 'inactive'],
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.enums, ['active', null, 'inactive'])
    })

    await t.step('should remove invalid enum and log warning', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema = {
        type: 'string',
        enum: ['valid', 123, 'another'],
      } as unknown as OpenAPIV3.SchemaObject

      const contextSpy = spy(mockParseContext, 'logIssue')

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(oasString.enums, undefined)
      // Verify logIssue was called
      assertEquals(contextSpy.calls.length >= 1, true)

      contextSpy.restore()
    })
  })

  await t.step('default value handling', async (t) => {
    await t.step('should preserve valid string default', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        default: 'default value',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.default, 'default value')
    })

    await t.step('should allow null default when nullable is true', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        nullable: true,
        default: null,
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.default, null)
    })

    await t.step('should remove invalid default and log warning', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema = {
        type: 'string',
        default: 456,
      } as unknown as OpenAPIV3.SchemaObject

      const contextSpy = spy(mockParseContext, 'logIssue')

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext as ParseContextType,
      })

      assertEquals(oasString.default, undefined)
      // Verify logIssue was called
      assertEquals(contextSpy.calls.length >= 1, true)

      contextSpy.restore()
    })
  })

  await t.step('string properties', async (t) => {
    await t.step('should preserve all string metadata', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        title: 'User Name',
        description: 'The name of the user',
        format: 'email',
        minLength: 5,
        maxLength: 100,
        pattern: '^[a-z]+$',
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.title, 'User Name')
      assertEquals(oasString.description, 'The name of the user')
      assertEquals(oasString.format, 'email')
      assertEquals(oasString.minLength, 5)
      assertEquals(oasString.maxLength, 100)
      assertEquals(oasString.pattern, '^[a-z]+$')
    })

    await t.step('should preserve readOnly, writeOnly, deprecated flags', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        readOnly: true,
        writeOnly: false,
        deprecated: true,
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.readOnly, true)
      assertEquals(oasString.writeOnly, false)
      assertEquals(oasString.deprecated, true)
    })
  })

  await t.step('complex schemas', async (t) => {
    await t.step('should handle complete schema with all properties', () => {
      const stackTrail = new StackTrail(['TEST'])
      const schema: OpenAPIV3.SchemaObject = {
        type: 'string',
        title: 'Email',
        description: 'User email address',
        format: 'email',
        nullable: true,
        example: 'user@example.com',
        default: 'default@example.com',
        enum: ['user@example.com', 'admin@example.com', null],
        minLength: 5,
        maxLength: 255,
        pattern: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$',
        readOnly: false,
        writeOnly: false,
        deprecated: false,
      }

      const oasString = toString({
        value: schema,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(oasString.title, 'Email')
      assertEquals(oasString.description, 'User email address')
      assertEquals(oasString.format, 'email')
      assertEquals(oasString.nullable, true)
      assertEquals(oasString.example, 'user@example.com')
      assertEquals(oasString.default, 'default@example.com')
      assertEquals(oasString.enums, [
        'user@example.com',
        'admin@example.com',
        null,
      ])
      assertEquals(oasString.minLength, 5)
      assertEquals(oasString.maxLength, 255)
      assertEquals(oasString.pattern, '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$')
    })

    await t.step(
      'should handle schema with extension fields (x-* properties)',
      () => {
        const stackTrail = new StackTrail(['TEST'])
        const schema = {
          type: 'string',
          description: 'With extensions',
          'x-custom-field': 'custom value',
          'x-internal-id': 123,
        } as OpenAPIV3.SchemaObject

        const oasString = toString({
          value: schema,
          stackTrail,
          context: mockParseContext,
        })

        assertEquals(oasString.description, 'With extensions')
        assertExists(oasString.extensionFields)
        assertEquals(oasString.extensionFields?.['x-custom-field'], 'custom value')
        assertEquals(oasString.extensionFields?.['x-internal-id'], 123)
      },
    )
  })
})

Deno.test('toParsedString', async (t) => {
  await t.step('format validation', async (t) => {
    await t.step('should accept valid string formats', () => {
      const stackTrail = new StackTrail(['TEST'])
      const validFormats = [
        'date-time',
        'time',
        'date',
        'duration',
        'email',
        'hostname',
        'ipv4',
        'ipv6',
        'uuid',
        'uri',
        'regex',
        'password',
        'byte',
        'binary',
        'uri-template',
      ] as const

      validFormats.forEach((format) => {
        const oasString = toParsedString({
          context: mockParseContext,
          nullable: false,
          example: undefined,
          enums: undefined,
          defaultValue: undefined,
          stackTrail,
          value: {
            type: 'string',
            format,
          },
        })

        assertEquals(oasString.format, format)
      })
    })

    await t.step('should log warning for unknown format but preserve it', () => {
      const stackTrail = new StackTrail(['TEST'])
      const contextSpy = spy(mockParseContext, 'logIssue')

      const oasString = toParsedString({
        context: mockParseContext as ParseContextType,
        nullable: false,
        example: undefined,
        enums: undefined,
        defaultValue: undefined,
        stackTrail,
        value: {
          type: 'string',
          format: 'custom-format',
        },
      })

      assertEquals(oasString.format, 'custom-format')
      // Verify logIssue was called for format warning
      assertEquals(contextSpy.calls.length >= 1, true)

      contextSpy.restore()
    })
  })

  await t.step('property preservation', async (t) => {
    await t.step('should preserve all standard string properties', () => {
      const stackTrail = new StackTrail(['TEST'])
      const oasString = toParsedString({
        context: mockParseContext,
        nullable: true,
        example: 'example text',
        enums: ['a', 'b', 'c', null],
        defaultValue: 'a',
        stackTrail,
        value: {
          type: 'string',
          title: 'Title',
          description: 'Description',
          format: 'email',
          maxLength: 100,
          minLength: 1,
          pattern: '^[a-z]+$',
          readOnly: true,
          writeOnly: false,
          deprecated: true,
        },
      })

      assertEquals(oasString.title, 'Title')
      assertEquals(oasString.description, 'Description')
      assertEquals(oasString.format, 'email')
      assertEquals(oasString.maxLength, 100)
      assertEquals(oasString.minLength, 1)
      assertEquals(oasString.pattern, '^[a-z]+$')
      assertEquals(oasString.nullable, true)
      assertEquals(oasString.example, 'example text')
      assertEquals(oasString.enums, ['a', 'b', 'c', null])
      assertEquals(oasString.default, 'a')
      assertEquals(oasString.readOnly, true)
      assertEquals(oasString.writeOnly, false)
      assertEquals(oasString.deprecated, true)
    })

    await t.step('should handle minimal schema', () => {
      const stackTrail = new StackTrail(['TEST'])
      const oasString = toParsedString({
        context: mockParseContext,
        nullable: undefined,
        example: undefined,
        enums: undefined,
        defaultValue: undefined,
        stackTrail,
        value: {
          type: 'string',
        },
      })

      assertEquals(oasString.type, 'string')
      assertEquals(oasString.nullable, undefined)
      assertEquals(oasString.example, undefined)
      assertEquals(oasString.enums, undefined)
      assertEquals(oasString.default, undefined)
    })
  })

  await t.step('length constraints', async (t) => {
    await t.step('should handle minLength and maxLength', () => {
      const stackTrail = new StackTrail(['TEST'])
      const oasString = toParsedString({
        context: mockParseContext,
        nullable: false,
        example: undefined,
        enums: undefined,
        defaultValue: undefined,
        stackTrail,
        value: {
          type: 'string',
          minLength: 10,
          maxLength: 50,
        },
      })

      assertEquals(oasString.minLength, 10)
      assertEquals(oasString.maxLength, 50)
    })

    await t.step('should handle zero minLength', () => {
      const stackTrail = new StackTrail(['TEST'])
      const oasString = toParsedString({
        context: mockParseContext,
        nullable: false,
        example: undefined,
        enums: undefined,
        defaultValue: undefined,
        stackTrail,
        value: {
          type: 'string',
          minLength: 0,
        },
      })

      assertEquals(oasString.minLength, 0)
    })
  })

  await t.step('pattern validation', async (t) => {
    await t.step('should preserve regex patterns', () => {
      const stackTrail = new StackTrail(['TEST'])
      const patterns = [
        '^[a-z]+$',
        '\\d{3}-\\d{2}-\\d{4}',
        '^[A-Z][a-z]*$',
        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
      ]

      patterns.forEach((pattern) => {
        const oasString = toParsedString({
          context: mockParseContext,
          nullable: false,
          example: undefined,
          enums: undefined,
          defaultValue: undefined,
          stackTrail,
          value: {
            type: 'string',
            pattern,
          },
        })

        assertEquals(oasString.pattern, pattern)
      })
    })
  })

  await t.step('extension fields', async (t) => {
    await t.step('should preserve extension fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const oasString = toParsedString({
        context: mockParseContext,
        nullable: false,
        example: undefined,
        enums: undefined,
        defaultValue: undefined,
        stackTrail,
        value: {
          type: 'string',
          'x-custom': 'value',
          'x-internal-id': 123,
          'x-metadata': { key: 'value' },
        } as OpenAPIV3.SchemaObject,
      })

      assertExists(oasString.extensionFields)
      assertEquals(oasString.extensionFields?.['x-custom'], 'value')
      assertEquals(oasString.extensionFields?.['x-internal-id'], 123)
      assertEquals(oasString.extensionFields?.['x-metadata'], { key: 'value' })
    })
  })
})
