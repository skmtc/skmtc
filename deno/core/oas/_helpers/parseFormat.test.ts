import { assertEquals } from '@std/assert/equals'
import { parseFormat } from './parseFormat.ts'
import { mockParseContext } from '../../test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import * as v from 'valibot'

Deno.test('parseFormat - parses email format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'email',
    description: 'Email address'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'email')
  assertEquals(result.value, {
    type: 'string',
    description: 'Email address'
  })
})

Deno.test('parseFormat - parses date-time format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'date-time'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'date-time')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseFormat - parses uuid format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'uuid')
  assertEquals(result.value, {
    type: 'string',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
})

Deno.test('parseFormat - parses float format for numbers', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'number',
    format: 'float',
    minimum: 0
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'float')
  assertEquals(result.value, {
    type: 'number',
    minimum: 0
  })
})

Deno.test('parseFormat - parses double format for numbers', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'number',
    format: 'double'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'double')
  assertEquals(result.value, { type: 'number' })
})

Deno.test('parseFormat - parses int32 format for integers', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'integer',
    format: 'int32',
    maximum: 2147483647
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'int32')
  assertEquals(result.value, {
    type: 'integer',
    maximum: 2147483647
  })
})

Deno.test('parseFormat - parses int64 format for integers', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'integer',
    format: 'int64'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'int64')
  assertEquals(result.value, { type: 'integer' })
})

Deno.test('parseFormat - returns undefined when format is not present', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    minLength: 1,
    maxLength: 100
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, undefined)
  assertEquals(result.value, {
    type: 'string',
    minLength: 1,
    maxLength: 100
  })
})

Deno.test('parseFormat - parses binary format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'binary',
    description: 'File upload'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'binary')
  assertEquals(result.value, {
    type: 'string',
    description: 'File upload'
  })
})

Deno.test('parseFormat - parses byte format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'byte'
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'byte')
  assertEquals(result.value, { type: 'string' })
})

Deno.test('parseFormat - parses password format', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'password',
    minLength: 8
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'password')
  assertEquals(result.value, {
    type: 'string',
    minLength: 8
  })
})

Deno.test('parseFormat - preserves other schema properties', () => {
  const schema: OpenAPIV3.SchemaObject = {
    type: 'string',
    format: 'uri',
    description: 'Resource URL',
    example: 'https://example.com',
    pattern: '^https://',
    maxLength: 2000
  }

  const result = parseFormat({
    value: schema,
    valibotSchema: v.string(),
    context: mockParseContext
  })

  assertEquals(result.format, 'uri')
  assertEquals(result.value, {
    type: 'string',
    description: 'Resource URL',
    example: 'https://example.com',
    pattern: '^https://',
    maxLength: 2000
  })
})
