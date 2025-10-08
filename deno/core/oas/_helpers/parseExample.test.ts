import { assertEquals } from '@std/assert/equals'
import { parseExample } from './parseExample.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'

Deno.test('parseExample - parses string example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    example: 'hello world',
    format: 'text'
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, 'hello world')
  assertEquals(result.value, {
    type: 'string',
    format: 'text'
  })
})

Deno.test('parseExample - parses number example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'number',
    example: 42.5,
    minimum: 0
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.example, 42.5)
  assertEquals(result.value, {
    type: 'number',
    minimum: 0
  })
})

Deno.test('parseExample - parses integer example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'integer',
    example: 123
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.example, 123)
  assertEquals(result.value, { type: 'integer' })
})

Deno.test('parseExample - parses boolean example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'boolean',
    example: true
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.boolean(),
    context: mockParseContext
  })

  assertEquals(result.example, true)
  assertEquals(result.value, { type: 'boolean' })
})

Deno.test('parseExample - parses null example for nullable schema', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    example: null,
    minLength: 1
  }

  const result = parseExample({
    value: schema,
    nullable: true,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, null)
  assertEquals(result.value, {
    type: 'string',
    minLength: 1
  })
})

Deno.test('parseExample - returns undefined when example is not present', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    format: 'email'
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, undefined)
  assertEquals(result.value, {
    type: 'string',
    format: 'email'
  })
})

Deno.test('parseExample - parses array example', () => {
  const schema = {
    type: 'array',
    items: { type: 'string' },
    example: ['item1', 'item2', 'item3']
  } as Omit<OpenAPIV3.SchemaObject, 'nullable'>

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.array(v.string()),
    context: mockParseContext
  })

  assertEquals(result.example, ['item1', 'item2', 'item3'])
  assertEquals(result.value.type, 'array')
})

Deno.test('parseExample - parses object example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    },
    example: { name: 'John', age: 30 }
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.object({
      name: v.string(),
      age: v.number()
    }),
    context: mockParseContext
  })

  assertEquals(result.example, { name: 'John', age: 30 })
  assertEquals(result.value.type, 'object')
})

Deno.test('parseExample - preserves other schema properties', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    example: 'test@example.com',
    format: 'email',
    description: 'User email',
    minLength: 5,
    maxLength: 100
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, 'test@example.com')
  assertEquals(result.value, {
    type: 'string',
    format: 'email',
    description: 'User email',
    minLength: 5,
    maxLength: 100
  })
})

Deno.test('parseExample - handles nullable undefined', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    example: 'value'
  }

  const result = parseExample({
    value: schema,
    nullable: undefined,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, 'value')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseExample - parses zero as valid number example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'number',
    example: 0
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.example, 0)
  assertEquals(result.value, { type: 'number' })
})

Deno.test('parseExample - parses empty string as valid example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    example: ''
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.example, '')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseExample - parses false as valid boolean example', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'boolean',
    example: false
  }

  const result = parseExample({
    value: schema,
    nullable: false,
    valibotSchema: v.boolean(),
    context: mockParseContext
  })

  assertEquals(result.example, false)
  assertEquals(result.value, { type: 'boolean' })
})
