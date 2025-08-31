import { assertEquals } from '@std/assert/equals'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeMetadata } from './merge-metadata.ts'

Deno.test('mergeMetadata - takes metadata from second schema when defined', () => {
  const a: OpenAPIV3.SchemaObject = {
    description: 'First description',
    default: 'First default',
    example: 'First example',
    externalDocs: { url: 'http://first.com' },
    deprecated: false,
    nullable: false,
    readOnly: false,
    writeOnly: false
  }

  const b: OpenAPIV3.SchemaObject = {
    description: 'Second description',
    default: 'Second default',
    example: 'Second example',
    externalDocs: { url: 'http://second.com' },
    deprecated: true,
    nullable: true,
    readOnly: true,
    writeOnly: true
  }

  const result = mergeMetadata(a, b)

  assertEquals(result.description, 'Second description')
  assertEquals(result.default, 'Second default')
  assertEquals(result.example, 'Second example')
  assertEquals(result.externalDocs, { url: 'http://second.com' })
  assertEquals(result.deprecated, true)
  assertEquals(result.nullable, true)
  assertEquals(result.readOnly, true)
  assertEquals(result.writeOnly, true)
})

Deno.test('mergeMetadata - takes metadata from first schema when second is undefined', () => {
  const a: OpenAPIV3.SchemaObject = {
    description: 'First description',
    default: 'First default',
    example: 'First example',
    externalDocs: { url: 'http://first.com' },
    deprecated: false,
    nullable: false,
    readOnly: false,
    writeOnly: false
  }

  const b: OpenAPIV3.SchemaObject = {}

  const result = mergeMetadata(a, b)

  assertEquals(result.description, 'First description')
  assertEquals(result.default, 'First default')
  assertEquals(result.example, 'First example')
  assertEquals(result.externalDocs, { url: 'http://first.com' })
  assertEquals(result.deprecated, false)
  assertEquals(result.nullable, false)
  assertEquals(result.readOnly, false)
  assertEquals(result.writeOnly, false)
})

Deno.test('mergeMetadata - does not include undefined properties', () => {
  const a: OpenAPIV3.SchemaObject = {}
  const b: OpenAPIV3.SchemaObject = {}

  const result = mergeMetadata(a, b)

  assertEquals(result, {})
})

Deno.test('mergeMetadata - only includes defined properties', () => {
  const a: OpenAPIV3.SchemaObject = {
    description: 'First description',
    default: 'First default'
  }

  const b: OpenAPIV3.SchemaObject = {
    example: 'Second example',
    deprecated: true
  }

  const result = mergeMetadata(a, b)

  assertEquals(result, {
    description: 'First description',
    default: 'First default',
    example: 'Second example',
    deprecated: true
  })
})
