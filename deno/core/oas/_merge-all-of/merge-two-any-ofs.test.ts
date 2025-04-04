import { assertEquals, assertThrows } from '@std/assert'
import { mergeTwoAnyOfs } from './merge-two-any-ofs.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  return match(ref)
    .with({ $ref: '#/components/schemas/User' }, (): OpenAPIV3.SchemaObject => ({ type: 'string' }))
    .otherwise(() => {
      throw new Error('Unknown reference')
    })
}

Deno.test('mergeTwoAnyOfs - basic merging', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'string' }, { type: 'number' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'boolean' }, { type: 'string' }]
  }

  assertEquals(mergeTwoAnyOfs(schema1, schema2, getRef), { type: 'string' })
})

Deno.test('mergeTwoAnyOfs - with references', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    anyOf: [{ $ref: '#/components/schemas/User' }, { type: 'string' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    anyOf: [{ $ref: '#/components/schemas/User' }, { type: 'number' }]
  }

  assertEquals(mergeTwoAnyOfs(schema1, schema2, getRef), { type: 'string' })
})

Deno.test('mergeTwoAnyOfs - with other properties', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'string' }],
    description: 'First schema',
    title: 'Schema 1'
  }

  const schema2: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'number' }],
    description: 'Second schema',
    title: 'Schema 2'
  }

  assertThrows(
    () => mergeTwoAnyOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})

Deno.test('mergeTwoAnyOfs - one schema without anyOf', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    anyOf: [{ type: 'string' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    type: 'number'
  }

  assertThrows(
    () => mergeTwoAnyOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})

Deno.test('mergeTwoAnyOfs - both schemas without anyOf', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    type: 'string'
  }

  const schema2: OpenAPIV3.SchemaObject = {
    type: 'number'
  }

  assertThrows(
    () => mergeTwoAnyOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})
