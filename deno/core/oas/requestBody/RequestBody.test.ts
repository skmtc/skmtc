import { assertEquals, assertExists } from '@std/assert'
import { OasRequestBody } from './RequestBody.ts'
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

Deno.test('OasRequestBody - Constructor', async t => {
  await t.step('should create request body with required content field', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    assertEquals(requestBody.oasType, 'requestBody')
    assertExists(requestBody.content)
    assertEquals(requestBody.description, undefined)
    assertEquals(requestBody.required, undefined)
    assertEquals(requestBody.extensionFields, undefined)
  })

  await t.step('should create request body with all fields', () => {
    const requestBody = new OasRequestBody({
      description: 'User creation request',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject({
            properties: {
              name: new OasString()
            }
          })
        })
      },
      required: true,
      extensionFields: {
        'x-custom': 'value'
      }
    })

    assertEquals(requestBody.oasType, 'requestBody')
    assertEquals(requestBody.description, 'User creation request')
    assertExists(requestBody.content)
    assertEquals(requestBody.required, true)
    assertEquals(requestBody.extensionFields, { 'x-custom': 'value' })
  })

  await t.step('should create request body with multiple content types', () => {
    const requestBody = new OasRequestBody({
      description: 'Multi-format request',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        }),
        'application/xml': new OasMediaType({
          mediaType: 'application/xml',
          schema: new OasString()
        }),
        'application/x-www-form-urlencoded': new OasMediaType({
          mediaType: 'application/x-www-form-urlencoded',
          schema: new OasObject({
            properties: {
              field: new OasString()
            }
          })
        })
      },
      required: true
    })

    assertEquals(Object.keys(requestBody.content).length, 3)
    assertExists(requestBody.content['application/json'])
    assertExists(requestBody.content['application/xml'])
    assertExists(requestBody.content['application/x-www-form-urlencoded'])
  })

  await t.step('should create request body with required flag set to false', () => {
    const requestBody = new OasRequestBody({
      description: 'Optional request',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      required: false
    })

    assertEquals(requestBody.required, false)
  })

  await t.step('should create request body with empty extension fields', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      extensionFields: {}
    })

    assertEquals(requestBody.extensionFields, {})
  })
})

Deno.test('OasRequestBody - Type Methods', async t => {
  await t.step('isRef() should always return false', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })
    assertEquals(requestBody.isRef(), false)
  })

  await t.step('resolve() should return self', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })
    assertEquals(requestBody.resolve(), requestBody)
  })

  await t.step('resolveOnce() should return self', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })
    assertEquals(requestBody.resolveOnce(), requestBody)
  })
})

Deno.test('OasRequestBody - toSchema()', async t => {
  await t.step('should extract schema for default application/json media type', () => {
    const schema = new OasString({ description: 'Test schema' })
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema
        })
      }
    })

    const extractedSchema = requestBody.toSchema()
    assertEquals(extractedSchema, schema)
  })

  await t.step('should extract schema for custom media type', () => {
    const jsonSchema = new OasString({ description: 'JSON schema' })
    const xmlSchema = new OasObject({ description: 'XML schema' })
    const requestBody = new OasRequestBody({
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

    assertEquals(requestBody.toSchema('application/json'), jsonSchema)
    assertEquals(requestBody.toSchema('application/xml'), xmlSchema)
  })

  await t.step('should return undefined for missing media type', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    assertEquals(requestBody.toSchema('application/xml'), undefined)
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
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: schemaRef
        })
      }
    })

    const extractedSchema = requestBody.toSchema()
    assertEquals(extractedSchema, schemaRef)
  })

  await t.step('should return undefined when media type has no schema', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json'
        })
      }
    })

    assertEquals(requestBody.toSchema(), undefined)
  })

  await t.step('should extract schema for multipart/form-data', () => {
    const formSchema = new OasObject({
      properties: {
        file: new OasString({ format: 'binary' }),
        filename: new OasString()
      }
    })
    const requestBody = new OasRequestBody({
      content: {
        'multipart/form-data': new OasMediaType({
          mediaType: 'multipart/form-data',
          schema: formSchema
        })
      }
    })

    assertEquals(requestBody.toSchema('multipart/form-data'), formSchema)
  })
})

Deno.test('OasRequestBody - toJsonSchema()', async t => {
  const options = createMockOptions()

  await t.step('should convert request body with all fields to JSON', () => {
    const requestBody = new OasRequestBody({
      description: 'User creation',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      required: true
    })

    const jsonSchema = requestBody.toJsonSchema(options)

    assertEquals(jsonSchema.description, 'User creation')
    assertExists(jsonSchema.content)
    assertEquals(jsonSchema.required, true)
  })

  await t.step('should convert request body with minimal fields', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = requestBody.toJsonSchema(options)

    assertEquals(jsonSchema.description, undefined)
    assertExists(jsonSchema.content)
    assertEquals(jsonSchema.required, undefined)
  })

  await t.step('should convert multiple content types properly', () => {
    const requestBody = new OasRequestBody({
      description: 'Multi-format',
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

    const jsonSchema = requestBody.toJsonSchema(options)

    assertExists(jsonSchema.content)
    assertExists(jsonSchema.content['application/json'])
    assertExists(jsonSchema.content['application/xml'])
    assertExists(jsonSchema.content['text/plain'])
  })

  await t.step('should handle required flag true', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      required: true
    })

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.required, true)
  })

  await t.step('should handle required flag false', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      required: false
    })

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.required, false)
  })

  await t.step('should handle undefined required flag', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.required, undefined)
  })

  await t.step('should handle undefined description', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.description, undefined)
  })
})

Deno.test('OasRequestBody - Integration Tests', async t => {
  const options = createMockOptions()

  await t.step('should handle file upload with multipart/form-data', () => {
    const requestBody = new OasRequestBody({
      description: 'File upload',
      required: true,
      content: {
        'multipart/form-data': new OasMediaType({
          mediaType: 'multipart/form-data',
          schema: new OasObject({
            properties: {
              file: new OasString({ format: 'binary' }),
              filename: new OasString(),
              description: new OasString()
            },
            required: ['file', 'filename']
          })
        }),
        'application/octet-stream': new OasMediaType({
          mediaType: 'application/octet-stream',
          schema: new OasString({ format: 'binary' })
        })
      }
    })

    assertEquals(requestBody.description, 'File upload')
    assertEquals(requestBody.required, true)
    assertExists(requestBody.content['multipart/form-data'])
    assertExists(requestBody.content['application/octet-stream'])

    const schema = requestBody.toSchema('multipart/form-data')
    assertExists(schema)
    assertEquals(schema.oasType, 'schema')
  })

  await t.step('should handle request body with OasRef schema', () => {
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

    const requestBody = new OasRequestBody({
      description: 'Create user',
      required: true,
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: schemaRef
        })
      }
    })

    const jsonSchema = requestBody.toJsonSchema(options)
    assertExists(jsonSchema.content)
    assertExists(jsonSchema.content['application/json'])
  })

  await t.step('should handle request body with extension fields', () => {
    const requestBody = new OasRequestBody({
      description: 'Extended request',
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      },
      extensionFields: {
        'x-custom-property': 'custom value',
        'x-metadata': {
          version: '1.0',
          deprecated: false
        }
      }
    })

    assertEquals(requestBody.extensionFields?.['x-custom-property'], 'custom value')
    assertExists(requestBody.extensionFields?.['x-metadata'])
  })

  await t.step('should handle form-urlencoded request body', () => {
    const requestBody = new OasRequestBody({
      description: 'Form submission',
      required: true,
      content: {
        'application/x-www-form-urlencoded': new OasMediaType({
          mediaType: 'application/x-www-form-urlencoded',
          schema: new OasObject({
            properties: {
              username: new OasString(),
              password: new OasString(),
              rememberMe: new OasString()
            },
            required: ['username', 'password']
          })
        })
      }
    })

    const schema = requestBody.toSchema('application/x-www-form-urlencoded')
    assertExists(schema)
    assertEquals(schema.oasType, 'schema')
  })

  await t.step('should handle complex nested request body schema', () => {
    const requestBody = new OasRequestBody({
      description: 'Order creation',
      required: true,
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject({
            properties: {
              customer: new OasObject({
                properties: {
                  id: new OasString(),
                  email: new OasString()
                }
              }),
              items: new OasObject({
                properties: {
                  productId: new OasString(),
                  quantity: new OasInteger({ minimum: 1 })
                }
              })
            },
            required: ['customer', 'items']
          })
        })
      }
    })

    const schema = requestBody.toSchema()
    assertExists(schema)
    assertEquals(schema.oasType, 'schema')

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.required, true)
    assertExists(jsonSchema.content['application/json'])
  })

  await t.step('should handle optional request body for PATCH operations', () => {
    const requestBody = new OasRequestBody({
      description: 'Partial update',
      required: false,
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject({
            properties: {
              name: new OasString(),
              email: new OasString()
            }
          })
        })
      }
    })

    assertEquals(requestBody.required, false)
    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(jsonSchema.required, false)
  })

  await t.step('should maintain oasType property', () => {
    const requestBody = new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasString()
        })
      }
    })

    assertEquals(requestBody.oasType, 'requestBody')

    // Verify oasType is not changed by methods
    requestBody.resolve()
    assertEquals(requestBody.oasType, 'requestBody')

    requestBody.resolveOnce()
    assertEquals(requestBody.oasType, 'requestBody')
  })

  await t.step('should handle binary content types', () => {
    const requestBody = new OasRequestBody({
      description: 'Binary data upload',
      required: true,
      content: {
        'application/octet-stream': new OasMediaType({
          mediaType: 'application/octet-stream',
          schema: new OasString({ format: 'binary' })
        }),
        'image/png': new OasMediaType({
          mediaType: 'image/png',
          schema: new OasString({ format: 'binary' })
        }),
        'application/pdf': new OasMediaType({
          mediaType: 'application/pdf',
          schema: new OasString({ format: 'binary' })
        })
      }
    })

    assertExists(requestBody.content['application/octet-stream'])
    assertExists(requestBody.content['image/png'])
    assertExists(requestBody.content['application/pdf'])

    const jsonSchema = requestBody.toJsonSchema(options)
    assertEquals(Object.keys(jsonSchema.content).length, 3)
  })
})
