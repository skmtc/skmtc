import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toSchemaV3, toSchemasV3, toOptionalSchemasV3, toOptionalSchemaV3 } from './toSchemasV3.ts'
import { assertEquals, assertExists, assert } from '@std/assert'
import { OasString } from '@/oas/string/String.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasBoolean } from '@/oas/boolean/Boolean.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasUnknown } from '@/oas/unknown/Unknown.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// Create a testable context with methods that can be spied on
const createTestContext = (): ParseContextType =>
  ({
    trace<T>(_token: string | string[], fn: () => T): T {
      return fn()
    },
    logSkippedFields(): void {},
    logIssue(): void {},
    logIssueNoKey(): void {},
    registerRef(): void {},
    stackTrail: {
      append: () => {},
      remove: () => {},
      clone: () => ({ append: () => {}, remove: () => {}, clone: () => ({}) })
    },
    documentObject: {} as any,
    attribution: undefined,
    currentStackTrail: undefined,
    withStackTrail<T>(_stackTrail: unknown, fn: () => T): T {
      return fn()
    }
  }) as unknown as ParseContextType

Deno.test('toSchemasV3', async t => {
  await t.step('should process multiple valid schemas', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      StringSchema: { type: 'string' },
      NumberSchema: { type: 'number' },
      BooleanSchema: { type: 'boolean' }
    }

    const result = toSchemasV3({
      schemas,
      stackTrail,
      context
    })

    assertEquals(Object.keys(result).length, 3)
    assert(result.StringSchema instanceof OasString)
    assert(result.NumberSchema instanceof OasNumber)
    assert(result.BooleanSchema instanceof OasBoolean)
  })

  await t.step('should handle empty record', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {}

    const result = toSchemasV3({
      schemas,
      stackTrail,
      context
    })

    assertEquals(result, {})
  })

  await t.step('should log errors for invalid schemas and continue processing', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])

    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      ValidSchema: { type: 'string' },
      InvalidSchema: { oneOf: [] } as OpenAPIV3.SchemaObject,
      AnotherValidSchema: { type: 'number' }
    }

    const result = toSchemasV3({
      schemas,
      stackTrail,
      context
    })

    // Should have processed valid schemas and skipped invalid one
    assert(result.ValidSchema instanceof OasString)
    assert(result.AnotherValidSchema instanceof OasNumber)
    assertEquals(result.InvalidSchema, undefined)
  })

  await t.step('should use StackTrail.trace for each schema', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      Schema1: { type: 'string' },
      Schema2: { type: 'number' }
    }

    const result = toSchemasV3({
      schemas,
      stackTrail,
      context
    })

    // Schemas should be processed successfully
    assertEquals(Object.keys(result).length, 2)
  })

  await t.step('should handle mixed references and schemas', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject> = {
      StringSchema: { type: 'string' },
      RefSchema: { $ref: '#/components/schemas/Referenced' }
    }

    const result = toSchemasV3({
      schemas,
      stackTrail,
      context
    })

    assertEquals(Object.keys(result).length, 2)
    assert(result.StringSchema instanceof OasString)
    assert(result.RefSchema instanceof OasRef)
  })
})

Deno.test('toOptionalSchemasV3', async t => {
  await t.step('should return undefined when input is undefined', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])

    const result = toOptionalSchemasV3({
      schemas: undefined,
      stackTrail,
      context
    })

    assertEquals(result, undefined)
  })

  await t.step('should delegate to toSchemasV3 when input is provided', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schemas: Record<string, OpenAPIV3.SchemaObject> = {
      StringSchema: { type: 'string' }
    }

    const result = toOptionalSchemasV3({
      schemas,
      stackTrail,
      context
    })

    assertExists(result)
    assertEquals(Object.keys(result).length, 1)
    assert(result.StringSchema instanceof OasString)
  })
})

Deno.test('toSchemaV3 - references', async t => {
  await t.step('should handle basic $ref', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.ReferenceObject = {
      $ref: '#/components/schemas/User'
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasRef)
    assertEquals(result.refType, 'schema')
  })

  await t.step('should handle $ref with full path', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.ReferenceObject = {
      $ref: '#/components/schemas/Pet'
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasRef)
  })
})

Deno.test('toSchemaV3 - allOf', async t => {
  await t.step('should handle basic allOf merging', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      allOf: [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'number' } } }
      ]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasObject)
  })

  await t.step('should handle allOf with single schema', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      allOf: [{ type: 'string', minLength: 5 }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
  })

  await t.step('should use StackTrail.trace for allOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      allOf: [{ type: 'object', properties: { id: { type: 'string' } } }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasObject)
  })
})

Deno.test('toSchemaV3 - oneOf', async t => {
  await t.step('should handle oneOf with multiple members', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }, { type: 'number' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
  })

  await t.step('should unwrap single member oneOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
  })

  await t.step('should throw error for empty oneOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: []
    }

    let errorThrown = false
    try {
      toSchemaV3({
        schema,
        stackTrail,
        context
      })
    } catch (error) {
      errorThrown = true
      assertEquals((error as Error).message, '"oneOf" array is empty')
    }

    assertEquals(errorThrown, true)
  })

  await t.step('should use StackTrail.trace for oneOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }, { type: 'number' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
  })

  await t.step('should handle oneOf with properties', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      title: 'Union Type',
      oneOf: [{ type: 'string' }, { type: 'boolean' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
    // mergeUnion processes the schema, stripping some properties
    assert(result.members.length === 2)
  })
})

Deno.test('toSchemaV3 - anyOf', async t => {
  await t.step('should handle anyOf with multiple members', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ type: 'string' }, { type: 'number' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
  })

  await t.step('should unwrap single member anyOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ type: 'boolean' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasBoolean)
  })

  await t.step('should throw error for empty anyOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: []
    }

    let errorThrown = false
    try {
      toSchemaV3({
        schema,
        stackTrail,
        context
      })
    } catch (error) {
      errorThrown = true
      assertEquals((error as Error).message, '"anyOf" array is empty')
    }

    assertEquals(errorThrown, true)
  })

  await t.step('should handle Stripe x-expansionResources special case', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = {
      anyOf: [{ type: 'string' }, { type: 'number' }],
      'x-expansionResources': { oneOf: [] }
    } as any

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
  })

  await t.step('should use StackTrail.trace for anyOf', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ type: 'integer' }, { type: 'string' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
  })

  await t.step('should handle anyOf with properties', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      description: 'Flexible union',
      anyOf: [{ type: 'integer' }, { type: 'boolean' }]
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnion)
    // mergeUnion processes the schema, stripping some properties
    assert(result.members.length === 2)
  })
})

Deno.test('toSchemaV3 - typed schemas', async t => {
  await t.step('should handle string type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = { type: 'string' }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
  })

  await t.step('should handle number type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = { type: 'number' }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasNumber)
  })

  await t.step('should handle integer type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = { type: 'integer' }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasInteger)
  })

  await t.step('should handle boolean type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = { type: 'boolean' }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasBoolean)
  })

  await t.step('should handle array type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.ArraySchemaObject = {
      type: 'array',
      items: { type: 'string' }
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasArray)
  })

  await t.step('should handle object type', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasObject)
  })
})

Deno.test('toSchemaV3 - type inference with warnings', async t => {
  await t.step('should infer object type from properties and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasObject)
  })

  await t.step('should infer array type from items and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = {
      items: { type: 'string' }
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasArray)
  })

  await t.step('should infer boolean type from boolean default and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      default: true
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasBoolean)
  })

  await t.step('should infer boolean type from boolean example and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      example: false
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasBoolean)
    assertEquals(result, new OasBoolean({ example: false }))
  })

  await t.step('should infer string type from string default and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      default: 'default value'
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
    assertEquals(result, new OasString({ default: 'default value' }))
  })

  await t.step('should infer string type from string example and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      example: 'example value'
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
    assertEquals(result, new OasString({ example: 'example value' }))
  })

  await t.step('should infer string type from string enum and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      enum: ['option1', 'option2', 'option3']
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
    assertEquals(result, new OasString({ enums: ['option1', 'option2', 'option3'] }))
  })

  await t.step('should infer string type from format and log warning', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      format: 'date-time'
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasString)
    assertEquals(result, new OasString({ format: 'date-time' }))
  })
})

Deno.test('toSchemaV3 - edge cases', async t => {
  await t.step('should fall back to Unknown for empty schema', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {}

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnknown)
  })

  await t.step('should handle schema with only extension fields', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = {
      'x-custom': 'value',
      'x-internal': true
    } as OpenAPIV3.SchemaObject

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assert(result instanceof OasUnknown)
    assertEquals(
      result,
      new OasUnknown({ extensionFields: { 'x-custom': 'value', 'x-internal': true } })
    )
  })

  await t.step('should handle complex nested schema', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' }
          }
        },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assertEquals(
      result,
      new OasObject({
        properties: {
          user: new OasObject({
            properties: {
              name: new OasString(),
              age: new OasNumber()
            }
          }),
          tags: new OasArray({
            items: new OasString()
          })
        }
      })
    )
  })
})

Deno.test('toSchemaV3 - extension fields', async t => {
  await t.step('should handle extension fields', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])

    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      required: ['id', 'name', 'weight', 'color'],
      properties: {
        id: {
          type: 'string'
        },
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 50
        },
        weight: {
          type: 'integer',
          format: 'int32',
          minimum: 0,
          maximum: 100
        },
        color: {
          type: 'string',
          enum: ['red', 'blue']
        }
      }
    }

    const result = toSchemaV3({
      schema,
      stackTrail,
      context
    })

    assertEquals(
      result,
      new OasObject({
        required: ['id', 'name', 'weight', 'color'],
        properties: {
          id: new OasString(),
          name: new OasString({ minLength: 3, maxLength: 50 }),
          weight: new OasInteger({ format: 'int32', minimum: 0, maximum: 100 }),
          color: new OasString({ enums: ['red', 'blue'] })
        }
      })
    )
  })
})

Deno.test('toOptionalSchemaV3', async t => {
  await t.step('should return undefined when input is undefined', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])

    const result = toOptionalSchemaV3({
      schema: undefined,
      stackTrail,
      context
    })

    assertEquals(result, undefined)
  })

  await t.step('should delegate to toSchemaV3 when input is provided', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = { type: 'string' }

    const result = toOptionalSchemaV3({
      schema,
      stackTrail,
      context
    })

    assertExists(result)
    assert(result instanceof OasString)
  })
})

Deno.test('toSchemaV3 - OpenAPI 3.1 type arrays', async t => {
  await t.step('normalizes ["string", "null"] to a nullable string', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    // 3.1 documents arrive through 3.0-typed plumbing; the type array
    // is a runtime shape the static type does not admit.
    const schema = JSON.parse('{"type": ["string", "null"], "minLength": 1}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
  })

  await t.step('normalizes ["array", "null"] with items to a nullable array', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"type": ["array", "null"], "items": {"type": "integer"}}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasArray)
    assertEquals(result.nullable, true)
  })

  await t.step('single-member type array stays non-nullable', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"type": ["boolean"]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasBoolean)
    assertEquals(result.nullable, undefined)
  })

  await t.step('a multi-member type array becomes a union (CASE 2 — native 3.1)', () => {
    // 3.1 `type:["string","integer"]` is a union; v3-1 models it as
    // OasUnion(string | integer). (v3-0 degrades this to OasUnknown — the
    // CASE-2 gap; see core/parse/README.md.)
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"type": ["string", "integer"]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasUnion)
    assertEquals(result.members.length, 2)
    assert(result.members[0] instanceof OasString)
    assert(result.members[1] instanceof OasInteger)
  })

  await t.step('a multi-member type array with null is a nullable union', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"type": ["string", "integer", "null"]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasUnion)
    assertEquals(result.nullable, true)
    assertEquals(result.members.length, 2)
  })

  await t.step('type:["null"] (only null) falls through to OasUnknown (documented gap)', () => {
    // No first-class OasNull IR node yet — pure null degrades to OasUnknown.
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"type": ["null"]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasUnknown)
  })
})

Deno.test('toSchemaV3 - OpenAPI 3.1 native null members', async t => {
  // In raw 3.1 (no down-convert) the nullability of a combinator is
  // expressed by a `{type:'null'}` MEMBER, not a hoisted `nullable` keyword.
  // v3-1 folds that member into the same `nullable` flag the collapse/union
  // logic already consumes.
  await t.step('oneOf:[{type:string},{type:null}] is a nullable string', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
    assertEquals(result.minLength, 1)
  })

  await t.step('anyOf:[{type:string},{type:null}] is a nullable string', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse('{"anyOf": [{"type": "string"}, {"type": "null"}]}')

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
  })

  await t.step('oneOf:[{type:string},{type:integer},{type:null}] is a nullable union', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse(
      '{"oneOf": [{"type": "string"}, {"type": "integer"}, {"type": "null"}]}'
    )

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasUnion)
    assertEquals(result.nullable, true)
    assertEquals(result.members.length, 2)
  })

  await t.step('oneOf:[{$ref},{type:null}] stamps nullable on the OasRef', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema = JSON.parse(
      '{"oneOf": [{"$ref": "#/components/schemas/Foo"}, {"type": "null"}]}'
    )

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasRef)
    assertEquals(result.nullable, true)
  })
})

Deno.test('toSchemaV3 - single-member combinator collapse (CASE 1)', async t => {
  // The single-member oneOf/anyOf collapse must carry the wrapper's
  // sibling keywords into the surviving member instead of discarding
  // them. The load-bearing case: down-convert's convertNullableOneOfAnyOf
  // rewrites the 3.1 idiom oneOf:[{type:'string'},{type:'null'}] into
  // oneOf:[{type:'string'}] + a hoisted nullable:true on the wrapper, so
  // dropping the wrapper turned `string | null` back into `string`.
  await t.step('oneOf single member carries the wrapper nullable (string | null)', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string', minLength: 1 }],
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
    assertEquals(result.minLength, 1)
  })

  await t.step('anyOf single member carries the wrapper nullable', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ type: 'string' }],
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
  })

  await t.step('collapse preserves non-nullable wrapper siblings (description)', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }],
      description: 'A nullable name',
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
    assertEquals(result.description, 'A nullable name')
  })

  await t.step('nullable OR-ins even when the member is explicitly non-nullable', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string', nullable: false }],
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, true)
  })

  await t.step('single member with no wrapper siblings still collapses to the bare member', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }]
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasString)
    assertEquals(result.nullable, undefined)
  })
})

Deno.test('toSchemaV3 - single-member nullable reference collapse', async t => {
  // 3.1 `oneOf:[{$ref},{type:null}]` down-converts to a single $ref member
  // + a hoisted nullable:true. Nullability is a use-site property, so it
  // rides the OasRef node itself — generators read `ref.nullable` and render
  // `Foo | null`, while the shared referent is generated un-nullable. The
  // referent (`Foo`) is never mutated.
  await t.step('oneOf single $ref + nullable sets nullable on the OasRef', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Foo' }],
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasRef)
    assertEquals(result.nullable, true)
  })

  await t.step('anyOf single $ref + nullable sets nullable on the OasRef', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ $ref: '#/components/schemas/Foo' }],
      nullable: true
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasRef)
    assertEquals(result.nullable, true)
  })

  await t.step('single $ref without nullable is a non-nullable ref', () => {
    const context = createTestContext()
    const stackTrail = new StackTrail(['TEST'])
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Foo' }]
    }

    const result = toSchemaV3({ schema, stackTrail, context })

    assert(result instanceof OasRef)
    assertEquals(result.nullable, undefined)
  })
})
