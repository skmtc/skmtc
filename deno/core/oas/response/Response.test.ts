import { assertEquals, assertExists } from '@std/assert'
import { OasResponse } from './Response.ts'
import { OasHeader } from '../header/Header.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'
import { OasRef } from '../ref/Ref.ts'
import { OasString } from '../string/String.ts'
import { OasInteger } from '../integer/Integer.ts'
import { OasObject } from '../object/Object.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import { OasDocument } from '../document/Document.ts'
import { OasInfo } from '../info/Info.ts'
import { toOasParsedDocument } from '@/types/SkmtcDocument.ts'
import { toRefParseContextStub } from '@/test/mockParseContext.ts'

// Helper to create basic ToJsonSchemaOptions
const createMockOptions = (): ToJsonSchemaOptions => ({
  resolve: false
})

Deno.test('OasResponse - Constructor', async t => {
  await t.step('should create response with all fields', () => {
    const response = new OasResponse({
      description: 'Success response',
      headers: {
        'X-Custom-Header': new OasHeader({
          description: 'Custom header',
          schema: new OasString()
        })
      },
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      extensionFields: {
        'x-custom': 'value'
      }
    })

    assertEquals(response.oasType, 'response')
    assertEquals(response.description, 'Success response')
    assertExists(response.headers)
    assertExists(response.content)
    assertEquals(response.extensionFields, { 'x-custom': 'value' })
  })

  await t.step('should create response with minimal fields', () => {
    const response = new OasResponse({
      description: 'Minimal response'
    })

    assertEquals(response.oasType, 'response')
    assertEquals(response.description, 'Minimal response')
    assertEquals(response.headers, undefined)
    assertEquals(response.content, undefined)
    assertEquals(response.extensionFields, undefined)
  })

  await t.step('should create response with undefined description', () => {
    const response = new OasResponse({})

    assertEquals(response.oasType, 'response')
    assertEquals(response.description, undefined)
  })

  await t.step('should create response with empty objects', () => {
    const response = new OasResponse({
      description: 'Test',
      headers: {},
      content: {},
      extensionFields: {}
    })

    assertEquals(response.headers, {})
    assertEquals(response.content, {})
    assertEquals(response.extensionFields, {})
  })
})

Deno.test('OasResponse - Type Methods', async t => {
  await t.step('isRef() should always return false', () => {
    const response = new OasResponse({ description: 'Test' })
    assertEquals(response.isRef(), false)
  })

  await t.step('resolve() should return self', () => {
    const response = new OasResponse({ description: 'Test' })
    assertEquals(response.resolve(), response)
  })

  await t.step('resolveOnce() should return self', () => {
    const response = new OasResponse({ description: 'Test' })
    assertEquals(response.resolveOnce(), response)
  })
})

Deno.test('OasResponse - toSchema()', async t => {
  await t.step('should extract schema for default application/json media type', () => {
    const schema = new OasString({ description: 'Test schema' })
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema
        })
      }
    })

    const extractedSchema = response.toSchema()
    assertEquals(extractedSchema, schema)
  })

  await t.step('should extract schema for custom media type', () => {
    const jsonSchema = new OasString({ description: 'JSON schema' })
    const xmlSchema = new OasObject({ description: 'XML schema' })
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: jsonSchema
        }),
        'application/xml': new OasMediaType({
          mediaType: 'application/xml',
          schema: xmlSchema
        })
      }
    })

    assertEquals(response.toSchema('application/json'), jsonSchema)
    assertEquals(response.toSchema('application/xml'), xmlSchema)
  })

  await t.step('should return undefined for missing content', () => {
    const response = new OasResponse({
      description: 'No content'
    })

    assertEquals(response.toSchema(), undefined)
  })

  await t.step('should return undefined for missing media type', () => {
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    assertEquals(response.toSchema('application/xml'), undefined)
  })

  await t.step('should handle OasRef as schema', () => {
    const document = toOasParsedDocument(
      new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })
    )
    const schemaRef = new OasRef(
      { $ref: '#/components/schemas/User', refType: 'schema' },
      toRefParseContextStub(document)
    )
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: schemaRef
        })
      }
    })

    const extractedSchema = response.toSchema()
    assertEquals(extractedSchema, schemaRef)
  })

  await t.step('should return undefined when content exists but media type has no schema', () => {
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json'
        })
      }
    })

    assertEquals(response.toSchema(), undefined)
  })
})

Deno.test('OasResponse - toJsonSchema()', async t => {
  const options = createMockOptions()

  await t.step('should convert response with all fields to JSON', () => {
    const response = new OasResponse({
      description: 'Success response',
      headers: {
        'X-Total-Count': new OasHeader({
          description: 'Total count',
          schema: new OasInteger()
        })
      },
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = response.toJsonSchema(options)

    assertEquals(jsonSchema.description, 'Success response')
    assertExists(jsonSchema.headers)
    assertExists(jsonSchema.content)
  })

  await t.step('should convert response with minimal fields', () => {
    const response = new OasResponse({
      description: 'Minimal response'
    })

    const jsonSchema = response.toJsonSchema(options)

    assertEquals(jsonSchema.description, 'Minimal response')
    assertEquals(jsonSchema.headers, undefined)
    assertEquals(jsonSchema.content, undefined)
  })

  await t.step('should use empty string for undefined description', () => {
    const response = new OasResponse({})

    const jsonSchema = response.toJsonSchema(options)

    assertEquals(jsonSchema.description, '')
  })

  await t.step('should convert headers properly', () => {
    const response = new OasResponse({
      description: 'Test',
      headers: {
        'X-Custom-1': new OasHeader({
          description: 'Header 1',
          schema: new OasString()
        }),
        'X-Custom-2': new OasHeader({
          description: 'Header 2',
          schema: new OasInteger()
        })
      }
    })

    const jsonSchema = response.toJsonSchema(options)

    assertExists(jsonSchema.headers)
    assertExists(jsonSchema.headers?.['X-Custom-1'])
    assertExists(jsonSchema.headers?.['X-Custom-2'])
  })

  await t.step('should convert multiple content types properly', () => {
    const response = new OasResponse({
      description: 'Test',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        }),
        'application/xml': new OasMediaType({
          mediaType: 'application/xml',
          schema: new OasString()
        }),
        'text/plain': new OasMediaType({
          mediaType: 'text/plain',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = response.toJsonSchema(options)

    assertExists(jsonSchema.content)
    assertExists(jsonSchema.content?.['application/json'])
    assertExists(jsonSchema.content?.['application/xml'])
    assertExists(jsonSchema.content?.['text/plain'])
  })

  await t.step('should handle undefined headers and content', () => {
    const response = new OasResponse({
      description: 'No headers or content'
    })

    const jsonSchema = response.toJsonSchema(options)

    assertEquals(jsonSchema.description, 'No headers or content')
    assertEquals(jsonSchema.headers, undefined)
    assertEquals(jsonSchema.content, undefined)
  })

  await t.step('should handle empty headers and content objects', () => {
    const response = new OasResponse({
      description: 'Empty objects',
      headers: {},
      content: {}
    })

    const jsonSchema = response.toJsonSchema(options)

    assertEquals(jsonSchema.description, 'Empty objects')
    assertEquals(jsonSchema.headers, {})
    assertEquals(jsonSchema.content, {})
  })
})

Deno.test('OasResponse - Integration Tests', async t => {
  const options = createMockOptions()

  await t.step('should handle response with headers containing OasRef', () => {
    const document = toOasParsedDocument(
      new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })
    )
    const headerRef = new OasRef(
      { $ref: '#/components/headers/X-Rate-Limit', refType: 'header' },
      toRefParseContextStub(document)
    )

    const response = new OasResponse({
      description: 'Test',
      headers: {
        'X-Rate-Limit': headerRef,
        'X-Custom': new OasHeader({
          description: 'Custom header',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = response.toJsonSchema(options)
    assertExists(jsonSchema.headers)
    assertExists(jsonSchema.headers?.['X-Rate-Limit'])
    assertExists(jsonSchema.headers?.['X-Custom'])
  })

  await t.step('should handle response with multiple content types and headers', () => {
    const response = new OasResponse({
      description: 'Multi-format response',
      headers: {
        'Content-Type': new OasHeader({
          description: 'Content type',
          schema: new OasString()
        }),
        'X-Total-Count': new OasHeader({
          description: 'Total items',
          schema: new OasInteger({ minimum: 0 })
        })
      },
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject({
            properties: {
              id: new OasString(),
              name: new OasString()
            }
          })
        }),
        'application/xml': new OasMediaType({
          mediaType: 'application/xml',
          schema: new OasObject({
            properties: {
              id: new OasString(),
              name: new OasString()
            }
          })
        })
      }
    })

    assertEquals(response.description, 'Multi-format response')
    assertExists(response.headers)
    assertExists(response.content)

    const jsonSchema = response.toJsonSchema(options)
    assertExists(jsonSchema.headers)
    assertExists(jsonSchema.content)
    assertEquals(Object.keys(jsonSchema.headers!).length, 2)
    assertEquals(Object.keys(jsonSchema.content!).length, 2)
  })

  await t.step('should handle response with extension fields', () => {
    const response = new OasResponse({
      description: 'Extended response',
      extensionFields: {
        'x-custom-property': 'custom value',
        'x-metadata': {
          version: '1.0',
          deprecated: false
        }
      }
    })

    assertEquals(response.extensionFields?.['x-custom-property'], 'custom value')
    assertExists(response.extensionFields?.['x-metadata'])
  })

  await t.step('should handle no-content response (204 scenario)', () => {
    const response = new OasResponse({
      description: 'No content returned'
    })

    assertEquals(response.description, 'No content returned')
    assertEquals(response.headers, undefined)
    assertEquals(response.content, undefined)
    assertEquals(response.toSchema(), undefined)

    const jsonSchema = response.toJsonSchema(options)
    assertEquals(jsonSchema.description, 'No content returned')
    assertEquals(jsonSchema.headers, undefined)
    assertEquals(jsonSchema.content, undefined)
  })

  await t.step('should handle error response with detailed schema', () => {
    const errorResponse = new OasResponse({
      description: 'Validation error',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject({
            properties: {
              error: new OasString({ description: 'Error message' }),
              code: new OasString({ description: 'Error code' })
            },
            required: ['error', 'code']
          })
        })
      }
    })

    const schema = errorResponse.toSchema()
    assertExists(schema)
    assertEquals(schema.oasType, 'schema')
  })

  await t.step('should maintain oasType property', () => {
    const response = new OasResponse({ description: 'Test' })
    assertEquals(response.oasType, 'response')

    // Verify oasType is not changed by methods
    response.resolve()
    assertEquals(response.oasType, 'response')

    response.resolveOnce()
    assertEquals(response.oasType, 'response')
  })
})
