import { assertEquals, assertThrows } from '@std/assert'
import { OasHeader } from './Header.ts'
import { OasString } from '../string/String.ts'
import { OasNumber } from '../number/Number.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'
import { OasExample } from '../example/Example.ts'

Deno.test('OasHeader', async t => {
  await t.step('constructor and property initialization', async t => {
    await t.step('should initialize with all properties provided', () => {
      const schema = new OasString({ minLength: 1, maxLength: 100 })
      const examples = {
        example1: new OasExample({ value: 'Bearer token123', summary: 'Auth token' })
      }
      const extensionFields = { 'x-custom': 'value' }

      const header = new OasHeader({
        description: 'Authorization header',
        required: true,
        deprecated: false,
        schema,
        examples,
        extensionFields
      })

      assertEquals(header.oasType, 'header')
      assertEquals(header.description, 'Authorization header')
      assertEquals(header.required, true)
      assertEquals(header.deprecated, false)
      assertEquals(header.schema, schema)
      assertEquals(header.examples, examples)
      assertEquals(header.extensionFields, extensionFields)
      assertEquals(header.content, undefined)
    })

    await t.step('should initialize with minimal required properties', () => {
      const header = new OasHeader({})

      assertEquals(header.oasType, 'header')
      assertEquals(header.description, undefined)
      assertEquals(header.required, undefined)
      assertEquals(header.deprecated, undefined)
      assertEquals(header.schema, undefined)
      assertEquals(header.examples, undefined)
      assertEquals(header.content, undefined)
      assertEquals(header.extensionFields, undefined)
    })

    await t.step('should handle optional properties correctly', () => {
      const header = new OasHeader({
        description: 'Test header',
        required: false
      })

      assertEquals(header.description, 'Test header')
      assertEquals(header.required, false)
      assertEquals(header.deprecated, undefined)
      assertEquals(header.schema, undefined)
    })

    await t.step('should set oasType to header', () => {
      const header = new OasHeader({})
      assertEquals(header.oasType, 'header')
    })

    await t.step('should handle extension fields (x-* properties)', () => {
      const extensionFields = {
        'x-rate-limit': 100,
        'x-custom-field': 'custom value',
        'x-nested': { deep: { property: true } }
      }

      const header = new OasHeader({ extensionFields })

      assertEquals(header.extensionFields, extensionFields)
      assertEquals(header.extensionFields?.['x-rate-limit'], 100)
      assertEquals(header.extensionFields?.['x-custom-field'], 'custom value')
    })

    await t.step('should handle examples and content properties', () => {
      const examples = {
        minimal: new OasExample({ value: '10' }),
        full: new OasExample({
          value: '100',
          summary: 'Maximum rate limit',
          description: 'The maximum number of requests per hour'
        })
      }

      const content = {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasNumber({ minimum: 1, maximum: 1000 })
        })
      }

      const header = new OasHeader({ examples, content })

      assertEquals(header.examples, examples)
      assertEquals(header.content, content)
    })
  })

  await t.step('isRef() method', async t => {
    await t.step('should return false for OasHeader instance (not a reference)', () => {
      const header = new OasHeader({
        description: 'Test header',
        schema: new OasString()
      })

      assertEquals(header.isRef(), false)
    })

    await t.step('should work correctly with type narrowing', () => {
      const header = new OasHeader({ description: 'Test' })

      if (!header.isRef()) {
        // Type should be OasHeader here, not OasRef<'header'>
        assertEquals(header.oasType, 'header')
        assertEquals(header.description, 'Test')
      }
    })

    await t.step('should always return false regardless of properties', () => {
      const headers = [
        new OasHeader({}),
        new OasHeader({ description: 'Test' }),
        new OasHeader({ schema: new OasString(), required: true }),
        new OasHeader({ deprecated: true, extensionFields: { 'x-test': 1 } })
      ]

      headers.forEach(header => {
        assertEquals(header.isRef(), false)
      })
    })
  })

  await t.step('resolve() method', async t => {
    await t.step('should return self when called on OasHeader instance', () => {
      const header = new OasHeader({
        description: 'Authorization header',
        required: true,
        schema: new OasString()
      })

      const resolved = header.resolve()

      assertEquals(resolved, header)
      assertEquals(resolved.description, 'Authorization header')
      assertEquals(resolved.required, true)
    })

    await t.step('should not throw errors', () => {
      const header = new OasHeader({})
      const resolved = header.resolve()
      assertEquals(resolved, header)
    })

    await t.step('should maintain all properties after resolve', () => {
      const schema = new OasString({ pattern: '^[A-Z]+$' })
      const examples = { test: new OasExample({ value: 'ABC' }) }

      const header = new OasHeader({
        description: 'Pattern header',
        required: false,
        deprecated: true,
        schema,
        examples,
        extensionFields: { 'x-custom': 'value' }
      })

      const resolved = header.resolve()

      assertEquals(resolved.description, 'Pattern header')
      assertEquals(resolved.required, false)
      assertEquals(resolved.deprecated, true)
      assertEquals(resolved.schema, schema)
      assertEquals(resolved.examples, examples)
      assertEquals(resolved.extensionFields, { 'x-custom': 'value' })
    })
  })

  await t.step('resolveOnce() method', async t => {
    await t.step('should return self when called on OasHeader instance', () => {
      const header = new OasHeader({
        description: 'Test header',
        schema: new OasNumber()
      })

      const resolved = header.resolveOnce()

      assertEquals(resolved, header)
      assertEquals(resolved.description, 'Test header')
    })

    await t.step('should behave identically to resolve() for non-reference headers', () => {
      const header = new OasHeader({
        description: 'Compare methods',
        required: true,
        deprecated: false
      })

      const resolved = header.resolve()
      const resolvedOnce = header.resolveOnce()

      assertEquals(resolved, resolvedOnce)
      assertEquals(resolved, header)
    })

    await t.step('should maintain all properties after resolveOnce', () => {
      const content = {
        'text/plain': new OasMediaType({
          mediaType: 'text/plain',
          schema: new OasString()
        })
      }

      const header = new OasHeader({
        description: 'Content header',
        content,
        extensionFields: { 'x-test': 123 }
      })

      const resolved = header.resolveOnce()

      assertEquals(resolved.description, 'Content header')
      assertEquals(resolved.content, content)
      assertEquals(resolved.extensionFields, { 'x-test': 123 })
    })
  })

  await t.step('toSchema() method', async t => {
    await t.step('should return schema when schema property is defined', () => {
      const schema = new OasString({ minLength: 5 })
      const header = new OasHeader({ schema })

      const result = header.toSchema()

      assertEquals(result, schema)
    })

    await t.step('should throw error when neither schema nor content exists', () => {
      const header = new OasHeader({ description: 'No schema' })

      assertThrows(
        () => header.toSchema(),
        Error,
        'Schema not found for media type application/json'
      )
    })

    await t.step(
      'should extract schema from content with default media type (application/json)',
      () => {
        const jsonSchema = new OasNumber({ minimum: 0 })
        const header = new OasHeader({
          content: {
            'application/json': new OasMediaType({
              mediaType: 'application/json',
              schema: jsonSchema
            })
          }
        })

        const result = header.toSchema()

        assertEquals(result, jsonSchema)
      }
    )

    await t.step('should extract schema from content with custom media type', () => {
      const xmlSchema = new OasString({ pattern: '<.*>' })
      const header = new OasHeader({
        content: {
          'application/xml': new OasMediaType({
            mediaType: 'application/xml',
            schema: xmlSchema
          })
        }
      })

      const result = header.toSchema('application/xml')

      assertEquals(result, xmlSchema)
    })

    await t.step('should handle content with multiple media types', () => {
      const jsonSchema = new OasNumber()
      const xmlSchema = new OasString()
      const textSchema = new OasString({ maxLength: 100 })

      const header = new OasHeader({
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json',
            schema: jsonSchema
          }),
          'application/xml': new OasMediaType({
            mediaType: 'application/xml',
            schema: xmlSchema
          }),
          'text/plain': new OasMediaType({
            mediaType: 'text/plain',
            schema: textSchema
          })
        }
      })

      assertEquals(header.toSchema('application/json'), jsonSchema)
      assertEquals(header.toSchema('application/xml'), xmlSchema)
      assertEquals(header.toSchema('text/plain'), textSchema)
    })

    await t.step('should prioritize schema property over content', () => {
      const directSchema = new OasString({ minLength: 10 })
      const contentSchema = new OasString({ minLength: 5 })

      const header = new OasHeader({
        schema: directSchema,
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json',
            schema: contentSchema
          })
        }
      })

      const result = header.toSchema()

      assertEquals(result, directSchema)
      assertEquals(result, directSchema) // Verify it's the direct schema, not content schema
    })

    await t.step('should throw error for missing media type in content', () => {
      const header = new OasHeader({
        content: {
          'application/xml': new OasMediaType({
            mediaType: 'application/xml',
            schema: new OasString()
          })
        }
      })

      assertThrows(
        () => header.toSchema('application/json'),
        Error,
        'Schema not found for media type application/json'
      )
    })

    await t.step('should throw error when content exists but has no schema', () => {
      const header = new OasHeader({
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json'
            // No schema provided
          })
        }
      })

      assertThrows(
        () => header.toSchema('application/json'),
        Error,
        'Schema not found for media type application/json'
      )
    })
  })

  await t.step('toJsonSchema() method', async t => {
    await t.step('should convert header to OpenAPI v3 JSON format', () => {
      const schema = new OasString()
      const header = new OasHeader({
        description: 'Test header',
        required: true,
        deprecated: false,
        schema
      })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.description, 'Test header')
      assertEquals(result.required, true)
      assertEquals(result.deprecated, false)
      assertEquals(typeof result.schema, 'object')
    })

    await t.step('should include all standard properties', () => {
      const header = new OasHeader({
        description: 'Authorization token',
        required: true,
        deprecated: true,
        schema: new OasString({ pattern: '^Bearer .+$' })
      })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.description, 'Authorization token')
      assertEquals(result.required, true)
      assertEquals(result.deprecated, true)
      assertEquals(result.schema !== undefined, true)
    })

    await t.step('should include schema when present', () => {
      const schema = new OasNumber({ minimum: 0, maximum: 100 })
      const header = new OasHeader({ schema })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.schema !== undefined, true)
      // Schema object exists (checking structure without accessing type directly due to union type)
      assertEquals(typeof result.schema, 'object')
    })

    await t.step('should include examples when present', () => {
      const examples = {
        low: new OasExample({ value: 10, summary: 'Low limit' }),
        high: new OasExample({ value: 1000, summary: 'High limit' })
      }

      const header = new OasHeader({
        schema: new OasNumber(),
        examples
      })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.examples, examples)
      assertEquals(result.examples?.low, examples.low)
      assertEquals(result.examples?.high, examples.high)
    })

    await t.step('should default required and deprecated to false when undefined', () => {
      const header = new OasHeader({
        description: 'Optional header',
        schema: new OasString()
      })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.required, false)
      assertEquals(result.deprecated, false)
    })

    await t.step('should handle header with no schema', () => {
      const header = new OasHeader({
        description: 'Header without schema',
        required: false
      })

      const result = header.toJsonSchema({ resolve: false })

      assertEquals(result.description, 'Header without schema')
      assertEquals(result.required, false)
      assertEquals(result.deprecated, false)
      assertEquals(result.schema, undefined)
    })
  })

  await t.step('property handling', async t => {
    await t.step('should handle required flag correctly', () => {
      const requiredHeader = new OasHeader({ required: true })
      const optionalHeader = new OasHeader({ required: false })
      const defaultHeader = new OasHeader({})

      assertEquals(requiredHeader.required, true)
      assertEquals(optionalHeader.required, false)
      assertEquals(defaultHeader.required, undefined)
    })

    await t.step('should handle deprecated flag correctly', () => {
      const deprecatedHeader = new OasHeader({ deprecated: true })
      const activeHeader = new OasHeader({ deprecated: false })
      const defaultHeader = new OasHeader({})

      assertEquals(deprecatedHeader.deprecated, true)
      assertEquals(activeHeader.deprecated, false)
      assertEquals(defaultHeader.deprecated, undefined)
    })

    await t.step('should handle description field', () => {
      const header1 = new OasHeader({ description: 'Short description' })
      const header2 = new OasHeader({
        description: 'A very long description that explains the header in detail'
      })
      const header3 = new OasHeader({})

      assertEquals(header1.description, 'Short description')
      assertEquals(
        header2.description,
        'A very long description that explains the header in detail'
      )
      assertEquals(header3.description, undefined)
    })

    await t.step('should handle complex schema objects', () => {
      const stringSchema = new OasString({
        minLength: 1,
        maxLength: 255,
        pattern: '^[a-zA-Z0-9-]+$'
      })

      const numberSchema = new OasNumber({
        minimum: 0,
        maximum: 1000,
        multipleOf: 10
      })

      const header1 = new OasHeader({ schema: stringSchema })
      const header2 = new OasHeader({ schema: numberSchema })

      assertEquals(header1.schema, stringSchema)
      assertEquals(header2.schema, numberSchema)
    })

    await t.step('should handle multiple examples', () => {
      const examples = {
        minimal: new OasExample({
          value: 'Bearer abc123',
          summary: 'Minimal token'
        }),
        standard: new OasExample({
          value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
          summary: 'Standard JWT token',
          description: 'A typical JWT bearer token'
        }),
        withExternal: new OasExample({
          value: 'Bearer token',
          externalValue: 'https://example.com/token.txt'
        })
      }

      const header = new OasHeader({ examples })

      assertEquals(header.examples, examples)
      assertEquals(Object.keys(header.examples ?? {}).length, 3)
    })
  })

  await t.step('edge cases and integration', async t => {
    await t.step('should handle empty header object', () => {
      const header = new OasHeader({})

      assertEquals(header.oasType, 'header')
      assertEquals(header.description, undefined)
      assertEquals(header.required, undefined)
      assertEquals(header.deprecated, undefined)
      assertEquals(header.schema, undefined)
      assertEquals(header.examples, undefined)
      assertEquals(header.content, undefined)
      assertEquals(header.extensionFields, undefined)
    })

    await t.step('should handle header with only extension fields', () => {
      const header = new OasHeader({
        extensionFields: {
          'x-custom-1': 'value1',
          'x-custom-2': { nested: true }
        }
      })

      assertEquals(header.extensionFields?.['x-custom-1'], 'value1')
      assertEquals(header.extensionFields?.['x-custom-2'], { nested: true })
      assertEquals(header.schema, undefined)
      assertEquals(header.description, undefined)
    })

    await t.step('should work with common header scenarios', () => {
      // Authorization header
      const authHeader = new OasHeader({
        description: 'Bearer token for API authentication',
        required: true,
        schema: new OasString({ pattern: '^Bearer [A-Za-z0-9-._~+/]+=*$' })
      })

      // Rate limit header
      const rateLimitHeader = new OasHeader({
        description: 'Number of requests remaining',
        required: false,
        schema: new OasNumber({ minimum: 0 }),
        examples: {
          normal: new OasExample({ value: 95 }),
          limited: new OasExample({ value: 5 })
        }
      })

      // Content-Type header
      const contentTypeHeader = new OasHeader({
        description: 'Media type of the response',
        required: true,
        schema: new OasString({ pattern: '^[a-z]+/[a-z0-9.+-]+$' }),
        examples: {
          json: new OasExample({ value: 'application/json' }),
          xml: new OasExample({ value: 'application/xml' })
        }
      })

      assertEquals(authHeader.required, true)
      assertEquals(rateLimitHeader.required, false)
      assertEquals(contentTypeHeader.examples !== undefined, true)
    })

    await t.step('should handle headers with both schema and content (unusual edge case)', () => {
      const directSchema = new OasString()
      const contentSchema = new OasNumber()

      const header = new OasHeader({
        schema: directSchema,
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json',
            schema: contentSchema
          })
        }
      })

      // Schema should take priority
      assertEquals(header.toSchema(), directSchema)
      assertEquals(header.schema, directSchema)
      assertEquals(header.content !== undefined, true)
    })
  })
})
