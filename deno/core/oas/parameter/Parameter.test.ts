import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
import { OasParameter } from './Parameter.ts'
import { OasString } from '../string/String.ts'
import { OasInteger } from '../integer/Integer.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'

Deno.test('OasParameter - constructor with only required fields (name, location)', () => {
  const param = new OasParameter({
    name: 'id',
    location: 'path'
  })

  assertEquals(param.oasType, 'parameter')
  assertEquals(param.name, 'id')
  assertEquals(param.location, 'path')
  assertEquals(param.description, undefined)
  assertEquals(param.required, undefined)
  assertEquals(param.deprecated, undefined)
  assertEquals(param.allowEmptyValue, undefined)
  assertEquals(param.allowReserved, undefined)
  assertEquals(param.schema, undefined)
  assertEquals(param.examples, undefined)
  assertEquals(param.content, undefined)
  assertEquals(param.style, undefined)
  assertEquals(param.explode, undefined)
  assertEquals(param.extensionFields, undefined)
})

Deno.test('OasParameter - constructor with path parameter', () => {
  const param = new OasParameter({
    name: 'userId',
    location: 'path',
    required: true,
    style: 'simple',
    explode: false,
    schema: new OasString()
  })

  assertEquals(param.name, 'userId')
  assertEquals(param.location, 'path')
  assertEquals(param.required, true)
  assertEquals(param.style, 'simple')
  assertEquals(param.explode, false)
  assertEquals(param.schema !== undefined, true)
})

Deno.test('OasParameter - constructor with query parameter', () => {
  const param = new OasParameter({
    name: 'page',
    location: 'query',
    required: false,
    style: 'form',
    explode: true,
    schema: new OasInteger()
  })

  assertEquals(param.name, 'page')
  assertEquals(param.location, 'query')
  assertEquals(param.required, false)
  assertEquals(param.style, 'form')
  assertEquals(param.explode, true)
})

Deno.test('OasParameter - constructor with header parameter', () => {
  const param = new OasParameter({
    name: 'Authorization',
    location: 'header',
    description: 'Bearer token',
    required: true,
    style: 'simple',
    schema: new OasString()
  })

  assertEquals(param.name, 'Authorization')
  assertEquals(param.location, 'header')
  assertEquals(param.description, 'Bearer token')
  assertEquals(param.required, true)
  assertEquals(param.style, 'simple')
})

Deno.test('OasParameter - constructor with cookie parameter', () => {
  const param = new OasParameter({
    name: 'sessionId',
    location: 'cookie',
    required: false,
    style: 'form',
    schema: new OasString()
  })

  assertEquals(param.name, 'sessionId')
  assertEquals(param.location, 'cookie')
  assertEquals(param.required, false)
  assertEquals(param.style, 'form')
})

Deno.test('OasParameter - constructor with schema field', () => {
  const schema = new OasString({ minLength: 1, maxLength: 50 })
  const param = new OasParameter({
    name: 'username',
    location: 'query',
    schema
  })

  assertEquals(param.name, 'username')
  assertEquals(param.schema, schema)
  assertStrictEquals(param.schema, schema)
})

Deno.test('OasParameter - constructor with content field', () => {
  const mediaType = new OasMediaType({
    mediaType: 'application/json',
    schema: new OasString()
  })
  const param = new OasParameter({
    name: 'filter',
    location: 'query',
    content: {
      'application/json': mediaType
    }
  })

  assertEquals(param.name, 'filter')
  assertEquals(param.content !== undefined, true)
  assertEquals(param.content?.['application/json'], mediaType)
})

Deno.test('OasParameter - constructor with all fields', () => {
  const schema = new OasString()
  const mediaType = new OasMediaType({ mediaType: 'application/json', schema: new OasInteger() })
  const param = new OasParameter({
    name: 'complexParam',
    location: 'query',
    description: 'A complex parameter',
    required: true,
    deprecated: true,
    allowEmptyValue: true,
    allowReserved: true,
    schema,
    examples: {},
    content: { 'application/json': mediaType },
    style: 'form',
    explode: true,
    extensionFields: { 'x-custom': 'value' }
  })

  assertEquals(param.name, 'complexParam')
  assertEquals(param.location, 'query')
  assertEquals(param.description, 'A complex parameter')
  assertEquals(param.required, true)
  assertEquals(param.deprecated, true)
  assertEquals(param.allowEmptyValue, true)
  assertEquals(param.allowReserved, true)
  assertEquals(param.schema, schema)
  assertEquals(param.examples, {})
  assertEquals(param.content?.['application/json'], mediaType)
  assertEquals(param.style, 'form')
  assertEquals(param.explode, true)
  assertEquals(param.extensionFields, { 'x-custom': 'value' })
})

Deno.test('OasParameter - oasType property is always "parameter"', () => {
  const param1 = new OasParameter({ name: 'id', location: 'path' })
  const param2 = new OasParameter({ name: 'page', location: 'query' })
  const param3 = new OasParameter({ name: 'Authorization', location: 'header' })

  assertEquals(param1.oasType, 'parameter')
  assertEquals(param2.oasType, 'parameter')
  assertEquals(param3.oasType, 'parameter')
})

Deno.test('OasParameter - isRef() always returns false', () => {
  const param1 = new OasParameter({ name: 'id', location: 'path' })
  const param2 = new OasParameter({ name: 'page', location: 'query', required: true })
  const param3 = new OasParameter({ name: 'token', location: 'header', schema: new OasString() })

  assertEquals(param1.isRef(), false)
  assertEquals(param2.isRef(), false)
  assertEquals(param3.isRef(), false)
})

Deno.test('OasParameter - resolve() returns itself', () => {
  const param = new OasParameter({
    name: 'userId',
    location: 'path',
    required: true
  })
  const resolved = param.resolve()

  assertStrictEquals(resolved, param)
  assertEquals(resolved.name, 'userId')
  assertEquals(resolved.location, 'path')
})

Deno.test('OasParameter - resolveOnce() returns itself', () => {
  const param = new OasParameter({
    name: 'page',
    location: 'query',
    schema: new OasInteger()
  })
  const resolved = param.resolveOnce()

  assertStrictEquals(resolved, param)
  assertEquals(resolved.name, 'page')
  assertEquals(resolved.location, 'query')
})

Deno.test('OasParameter - toSchema() returns direct schema when available', () => {
  const schema = new OasString({ minLength: 1 })
  const param = new OasParameter({
    name: 'username',
    location: 'query',
    schema
  })

  const result = param.toSchema()

  assertStrictEquals(result, schema)
})

Deno.test('OasParameter - toSchema() extracts schema from content (default application/json)', () => {
  const schema = new OasInteger()
  const param = new OasParameter({
    name: 'filter',
    location: 'query',
    content: {
      'application/json': new OasMediaType({ mediaType: 'application/json', schema })
    }
  })

  const result = param.toSchema()

  assertStrictEquals(result, schema)
})

Deno.test('OasParameter - toSchema() extracts schema from custom media type', () => {
  const schema = new OasString()
  const param = new OasParameter({
    name: 'data',
    location: 'query',
    content: {
      'application/xml': new OasMediaType({ mediaType: 'application/xml', schema })
    }
  })

  const result = param.toSchema('application/xml')

  assertStrictEquals(result, schema)
})

Deno.test('OasParameter - toSchema() throws error when schema not found', () => {
  const param = new OasParameter({
    name: 'noSchema',
    location: 'query'
  })

  assertThrows(() => param.toSchema(), Error, 'Schema not found for media type application/json')
})

Deno.test('OasParameter - toSchema() prioritizes direct schema over content', () => {
  const directSchema = new OasString()
  const contentSchema = new OasInteger()
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    schema: directSchema,
    content: {
      'application/json': new OasMediaType({ mediaType: 'application/json', schema: contentSchema })
    }
  })

  const result = param.toSchema()

  assertStrictEquals(result, directSchema)
})

Deno.test('OasParameter - toJsonSchema() with minimal fields (only name and location)', () => {
  const param = new OasParameter({
    name: 'id',
    location: 'path'
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(jsonSchema.name, 'id')
  assertEquals(jsonSchema.in, 'path')
  assertEquals(jsonSchema.description, undefined)
  assertEquals(jsonSchema.required, undefined)
  assertEquals(jsonSchema.deprecated, undefined)
  assertEquals(jsonSchema.schema, undefined)
  assertEquals(jsonSchema.content, undefined)
})

Deno.test('OasParameter - toJsonSchema() with all optional fields', () => {
  const schema = new OasString()
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    description: 'Test parameter',
    required: true,
    deprecated: true,
    allowEmptyValue: true,
    allowReserved: true,
    schema,
    style: 'form',
    explode: true
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(jsonSchema.name, 'param')
  assertEquals(jsonSchema.in, 'query')
  assertEquals(jsonSchema.description, 'Test parameter')
  assertEquals(jsonSchema.required, true)
  assertEquals(jsonSchema.deprecated, true)
  assertEquals(jsonSchema.allowEmptyValue, true)
  assertEquals(jsonSchema.allowReserved, true)
  assertEquals(jsonSchema.style, 'form')
  assertEquals(jsonSchema.explode, true)
  assertEquals(jsonSchema.schema !== undefined, true)
})

Deno.test('OasParameter - toJsonSchema() converts schema correctly', () => {
  const schema = new OasString({ minLength: 1, maxLength: 50 })
  const param = new OasParameter({
    name: 'username',
    location: 'query',
    schema
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(jsonSchema.schema !== undefined, true)
  assertEquals((jsonSchema.schema as any)?.type, 'string')
})

Deno.test('OasParameter - toJsonSchema() converts content correctly', () => {
  const mediaType = new OasMediaType({
    mediaType: 'application/json',
    schema: new OasInteger()
  })
  const param = new OasParameter({
    name: 'filter',
    location: 'query',
    content: {
      'application/json': mediaType
    }
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(jsonSchema.content !== undefined, true)
  assertEquals(jsonSchema.content?.['application/json'] !== undefined, true)
})

Deno.test('OasParameter - toJsonSchema() converts examples correctly', () => {
  const param = new OasParameter({
    name: 'page',
    location: 'query',
    examples: {}
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(jsonSchema.examples, {})
})

Deno.test('OasParameter - toJsonSchema() includes all parameter properties', () => {
  const schema = new OasString()
  const param = new OasParameter({
    name: 'testParam',
    location: 'header',
    description: 'Test description',
    required: true,
    schema,
    style: 'simple',
    explode: false
  })

  const jsonSchema = param.toJsonSchema({} as any)

  assertEquals(Object.keys(jsonSchema).length >= 7, true)
  assertEquals(jsonSchema.name, 'testParam')
  assertEquals(jsonSchema.in, 'header')
  assertEquals(jsonSchema.description, 'Test description')
  assertEquals(jsonSchema.required, true)
  assertEquals(jsonSchema.style, 'simple')
  assertEquals(jsonSchema.explode, false)
})

Deno.test('OasParameter - empty examples object', () => {
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    examples: {}
  })

  assertEquals(param.examples, {})
  assertEquals(param.toJsonSchema({} as any).examples, {})
})

Deno.test('OasParameter - empty content object', () => {
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    content: {}
  })

  assertEquals(param.content, {})
})

Deno.test('OasParameter - empty extensionFields object', () => {
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    extensionFields: {}
  })

  assertEquals(param.extensionFields, {})
})

Deno.test('OasParameter - multiple instances are independent', () => {
  const param1 = new OasParameter({
    name: 'id',
    location: 'path',
    required: true
  })
  const param2 = new OasParameter({
    name: 'page',
    location: 'query',
    required: false
  })

  assertEquals(param1 !== param2, true)
  assertEquals(param1.name, 'id')
  assertEquals(param2.name, 'page')
  assertEquals(param1.location, 'path')
  assertEquals(param2.location, 'query')
  assertEquals(param1.required, true)
  assertEquals(param2.required, false)
})

Deno.test('OasParameter - different parameter locations', () => {
  const pathParam = new OasParameter({ name: 'id', location: 'path' })
  const queryParam = new OasParameter({ name: 'page', location: 'query' })
  const headerParam = new OasParameter({ name: 'Authorization', location: 'header' })
  const cookieParam = new OasParameter({ name: 'sessionId', location: 'cookie' })

  assertEquals(pathParam.location, 'path')
  assertEquals(queryParam.location, 'query')
  assertEquals(headerParam.location, 'header')
  assertEquals(cookieParam.location, 'cookie')
})

Deno.test('OasParameter - different styles and explode combinations', () => {
  const simpleParam = new OasParameter({
    name: 'id',
    location: 'path',
    style: 'simple',
    explode: false
  })
  const formParam = new OasParameter({
    name: 'page',
    location: 'query',
    style: 'form',
    explode: true
  })
  const matrixParam = new OasParameter({
    name: 'coords',
    location: 'path',
    style: 'matrix',
    explode: false
  })
  const labelParam = new OasParameter({
    name: 'label',
    location: 'path',
    style: 'label',
    explode: true
  })

  assertEquals(simpleParam.style, 'simple')
  assertEquals(simpleParam.explode, false)
  assertEquals(formParam.style, 'form')
  assertEquals(formParam.explode, true)
  assertEquals(matrixParam.style, 'matrix')
  assertEquals(matrixParam.explode, false)
  assertEquals(labelParam.style, 'label')
  assertEquals(labelParam.explode, true)
})

Deno.test('OasParameter - extensionFields stores custom properties', () => {
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    extensionFields: {
      'x-internal': true,
      'x-custom-field': 'custom value',
      'x-metadata': { key: 'value' }
    }
  })

  assertEquals(param.extensionFields, {
    'x-internal': true,
    'x-custom-field': 'custom value',
    'x-metadata': { key: 'value' }
  })
})

Deno.test('OasParameter - extensionFields supports various value types', () => {
  const param = new OasParameter({
    name: 'param',
    location: 'query',
    extensionFields: {
      'x-string': 'text',
      'x-number': 42,
      'x-boolean': true,
      'x-array': [1, 2, 3],
      'x-object': { nested: 'value' },
      'x-null': null
    }
  })

  assertEquals(param.extensionFields?.['x-string'], 'text')
  assertEquals(param.extensionFields?.['x-number'], 42)
  assertEquals(param.extensionFields?.['x-boolean'], true)
  assertEquals(param.extensionFields?.['x-array'], [1, 2, 3])
  assertEquals(param.extensionFields?.['x-object'], { nested: 'value' })
  assertEquals(param.extensionFields?.['x-null'], null)
})

Deno.test('OasParameter - typical path parameter with validation', () => {
  const param = new OasParameter({
    name: 'userId',
    location: 'path',
    description: 'Unique identifier for the user',
    required: true,
    schema: new OasString({
      minLength: 24,
      maxLength: 24
    }),
    style: 'simple',
    explode: false
  })

  assertEquals(param.name, 'userId')
  assertEquals(param.location, 'path')
  assertEquals(param.description, 'Unique identifier for the user')
  assertEquals(param.required, true)
  assertEquals(param.style, 'simple')
  assertEquals(param.explode, false)
  assertEquals(param.schema !== undefined, true)

  const jsonSchema = param.toJsonSchema({} as any)
  assertEquals(jsonSchema.name, 'userId')
  assertEquals(jsonSchema.in, 'path')
  assertEquals(jsonSchema.required, true)
})

Deno.test('OasParameter - typical query parameter with pagination', () => {
  const param = new OasParameter({
    name: 'page',
    location: 'query',
    description: 'Page number for pagination',
    required: false,
    schema: new OasInteger({
      minimum: 1,
      default: 1
    }),
    style: 'form',
    explode: true
  })

  assertEquals(param.name, 'page')
  assertEquals(param.location, 'query')
  assertEquals(param.description, 'Page number for pagination')
  assertEquals(param.required, false)
  assertEquals(param.style, 'form')
  assertEquals(param.explode, true)
})

Deno.test('OasParameter - typical header parameter (Authorization)', () => {
  const param = new OasParameter({
    name: 'Authorization',
    location: 'header',
    description: 'Bearer token for authentication',
    required: true,
    schema: new OasString(),
    style: 'simple',
    explode: false
  })

  assertEquals(param.name, 'Authorization')
  assertEquals(param.location, 'header')
  assertEquals(param.description, 'Bearer token for authentication')
  assertEquals(param.required, true)
  assertEquals(param.style, 'simple')
})

Deno.test('OasParameter - typical cookie parameter (session)', () => {
  const param = new OasParameter({
    name: 'sessionId',
    location: 'cookie',
    description: 'Session identifier cookie',
    required: false,
    schema: new OasString({
      minLength: 32,
      maxLength: 128
    }),
    style: 'form',
    explode: false
  })

  assertEquals(param.name, 'sessionId')
  assertEquals(param.location, 'cookie')
  assertEquals(param.description, 'Session identifier cookie')
  assertEquals(param.required, false)
  assertEquals(param.style, 'form')
})

Deno.test('OasParameter - complex query parameter with content/media type', () => {
  const schema = new OasString()
  const param = new OasParameter({
    name: 'filter',
    location: 'query',
    description: 'Complex filter object',
    required: false,
    content: {
      'application/json': new OasMediaType({
        mediaType: 'application/json',
        schema
      })
    },
    style: 'deepObject',
    explode: true
  })

  assertEquals(param.name, 'filter')
  assertEquals(param.location, 'query')
  assertEquals(param.description, 'Complex filter object')
  assertEquals(param.content !== undefined, true)
  assertEquals(param.style, 'deepObject')
  assertEquals(param.explode, true)

  const extractedSchema = param.toSchema()
  assertStrictEquals(extractedSchema, schema)
})
