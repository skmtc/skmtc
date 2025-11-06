import { assertEquals } from '@std/assert/equals'
import { parseNullable } from './parseNullable.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('parseNullable - returns true when nullable is true', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    nullable: true,
    description: 'A nullable string'
  }
  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, true)
  assertEquals(result.value, {
    type: 'string',
    description: 'A nullable string'
  })
})

Deno.test('parseNullable - returns false when nullable is false', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'number',
    nullable: false,
    minimum: 0
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, false)
  assertEquals(result.value, {
    type: 'number',
    minimum: 0
  })
})

Deno.test('parseNullable - returns undefined when nullable is not present', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'integer',
    format: 'int32'
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, undefined)
  assertEquals(result.value, {
    type: 'integer',
    format: 'int32'
  })
})

Deno.test('parseNullable - preserves other schema properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    nullable: true,
    minLength: 5,
    maxLength: 100,
    pattern: '^[a-z]+$',
    description: 'A constrained string',
    example: 'hello'
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, true)
  assertEquals(result.value, {
    type: 'string',
    minLength: 5,
    maxLength: 100,
    pattern: '^[a-z]+$',
    description: 'A constrained string',
    example: 'hello'
  })
})

Deno.test('parseNullable - handles object schema with nullable', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'object',
    nullable: true,
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, true)
  assertEquals(result.value.type, 'object')
  assertEquals(result.value.properties, {
    name: { type: 'string' },
    age: { type: 'number' }
  })
})

Deno.test('parseNullable - handles array schema with nullable', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'array',
    nullable: false,
    items: { type: 'string' },
    minItems: 1
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    stackTrail,
    value: schema,
    context: mockParseContext
  })

  assertEquals(result.nullable, false)
  assertEquals(result.value, {
    type: 'array',
    items: { type: 'string' },
    minItems: 1
  })
})

Deno.test('parseNullable - handles boolean schema', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'boolean',
    nullable: true
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    value: schema,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result.nullable, true)
  assertEquals(result.value, { type: 'boolean' })
})

Deno.test('parseNullable - handles schema with only nullable property', () => {
  const schema: OpenAPIV3.SchemaObject = {
    nullable: false
  }

  const stackTrail = new StackTrail(['TEST'])
  const result = parseNullable({
    stackTrail,
    value: schema,
    context: mockParseContext
  })

  assertEquals(result.nullable, false)
  assertEquals(result.value, {})
})
