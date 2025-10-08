import { assertEquals } from '@std/assert/equals'
import { parseDefault } from './parseDefault.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'

Deno.test('parseDefault - parses string default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    default: 'hello world',
    minLength: 5
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, 'hello world')
  assertEquals(result.value, {
    type: 'string',
    minLength: 5
  })
})

Deno.test('parseDefault - parses number default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'number',
    default: 42.5,
    minimum: 0,
    maximum: 100
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.default, 42.5)
  assertEquals(result.value, {
    type: 'number',
    minimum: 0,
    maximum: 100
  })
})

Deno.test('parseDefault - parses integer default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'integer',
    default: 10
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.default, 10)
  assertEquals(result.value, { type: 'integer' })
})

Deno.test('parseDefault - parses boolean default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'boolean',
    default: true
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.boolean(),
    context: mockParseContext
  })

  assertEquals(result.default, true)
  assertEquals(result.value, { type: 'boolean' })
})

Deno.test('parseDefault - parses null default for nullable schema', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    default: null,
    format: 'email'
  }

  const result = parseDefault({
    value: schema,
    nullable: true,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, null)
  assertEquals(result.value, {
    type: 'string',
    format: 'email'
  })
})

Deno.test('parseDefault - returns undefined when default is not present', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    minLength: 1
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, undefined)
  assertEquals(result.value, {
    type: 'string',
    minLength: 1
  })
})

Deno.test('parseDefault - parses array default', () => {
  const schema = {
    type: 'array',
    items: { type: 'string' },
    default: ['item1', 'item2']
  } as Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'>

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.array(v.string()),
    context: mockParseContext
  })

  assertEquals(result.default, ['item1', 'item2'])
  assertEquals(result.value.type, 'array')
})

Deno.test('parseDefault - parses object default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    },
    default: { name: 'John', age: 30 }
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.object({
      name: v.string(),
      age: v.number()
    }),
    context: mockParseContext
  })

  assertEquals(result.default, { name: 'John', age: 30 })
  assertEquals(result.value.type, 'object')
})

Deno.test('parseDefault - preserves other schema properties', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    default: 'test',
    description: 'Test field',
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-z]+$'
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, 'test')
  assertEquals(result.value, {
    type: 'string',
    description: 'Test field',
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-z]+$'
  })
})

Deno.test('parseDefault - handles nullable undefined', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    default: 'value'
  }

  const result = parseDefault({
    value: schema,
    nullable: undefined,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, 'value')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseDefault - parses zero as valid number default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'number',
    default: 0
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.default, 0)
  assertEquals(result.value, { type: 'number' })
})

Deno.test('parseDefault - parses empty string as valid default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'string',
    default: ''
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.default, '')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseDefault - parses false as valid boolean default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'boolean',
    default: false
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.boolean(),
    context: mockParseContext
  })

  assertEquals(result.default, false)
  assertEquals(result.value, { type: 'boolean' })
})

Deno.test('parseDefault - parses empty array as valid default', () => {
  const schema = {
    type: 'array',
    items: { type: 'string' },
    default: []
  } as Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'>

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.array(v.string()),
    context: mockParseContext
  })

  assertEquals(result.default, [])
  assertEquals(result.value.type, 'array')
})

Deno.test('parseDefault - parses negative number as valid default', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable' | 'example' | 'enum'> = {
    type: 'number',
    default: -42
  }

  const result = parseDefault({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.default, -42)
  assertEquals(result.value, { type: 'number' })
})
