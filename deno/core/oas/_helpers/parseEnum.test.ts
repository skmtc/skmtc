import { assertEquals } from '@std/assert/equals'
import { parseEnum } from './parseEnum.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'

Deno.test('parseEnum - parses string enum', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['active', 'inactive', 'pending'],
    description: 'User status'
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['active', 'inactive', 'pending'])
  assertEquals(result.value, {
    type: 'string',
    description: 'User status'
  })
})

Deno.test('parseEnum - parses number enum', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'number',
    enum: [1, 2, 3, 5, 8, 13]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.enum, [1, 2, 3, 5, 8, 13])
  assertEquals(result.value, { type: 'number' })
})

Deno.test('parseEnum - parses integer enum', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'integer',
    enum: [0, 1, 2]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.enum, [0, 1, 2])
  assertEquals(result.value, { type: 'integer' })
})

Deno.test('parseEnum - parses boolean enum', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'boolean',
    enum: [true, false]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.boolean(),
    context: mockParseContext
  })

  assertEquals(result.enum, [true, false])
  assertEquals(result.value, { type: 'boolean' })
})

Deno.test('parseEnum - parses nullable enum with null value', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['red', 'green', 'blue', null]
  }

  const result = parseEnum({
    value: schema,
    nullable: true,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['red', 'green', 'blue', null])
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseEnum - returns undefined when enum is not present', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    format: 'email'
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, undefined)
  assertEquals(result.value, {
    type: 'string',
    format: 'email'
  })
})

Deno.test('parseEnum - parses single value enum', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['constant']
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['constant'])
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseEnum - preserves other schema properties', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['small', 'medium', 'large'],
    description: 'Size options',
    example: 'medium',
    minLength: 1
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['small', 'medium', 'large'])
  assertEquals(result.value, {
    type: 'string',
    description: 'Size options',
    example: 'medium',
    minLength: 1
  })
})

Deno.test('parseEnum - handles nullable undefined', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['option1', 'option2']
  }

  const result = parseEnum({
    value: schema,
    nullable: undefined,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['option1', 'option2'])
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseEnum - parses enum with numeric zeros', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'number',
    enum: [0, 1, 2]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.enum, [0, 1, 2])
  assertEquals(result.value, { type: 'number' })
})

Deno.test('parseEnum - parses enum with empty string', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'string',
    enum: ['', 'value1', 'value2']
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.enum, ['', 'value1', 'value2'])
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseEnum - parses enum with negative numbers', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'integer',
    enum: [-1, 0, 1]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.enum, [-1, 0, 1])
  assertEquals(result.value, { type: 'integer' })
})

Deno.test('parseEnum - parses enum with decimal numbers', () => {
  const schema: Omit<OpenAPIV3.SchemaObject, 'nullable'> = {
    type: 'number',
    enum: [0.5, 1.5, 2.5]
  }

  const result = parseEnum({
    value: schema,
    nullable: false,
    valibotSchema: v.number(),
    context: mockParseContext
  })

  assertEquals(result.enum, [0.5, 1.5, 2.5])
  assertEquals(result.value, { type: 'number' })
})
