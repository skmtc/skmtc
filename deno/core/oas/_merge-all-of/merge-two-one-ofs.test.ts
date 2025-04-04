import { assertEquals, assertThrows } from '@std/assert'
import { mergeTwoOneOfs } from './merge-two-one-ofs.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { match } from 'ts-pattern'

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  return match(ref)
    .with({ $ref: '#/components/schemas/User' }, (): OpenAPIV3.SchemaObject => ({ type: 'string' }))
    .otherwise(() => {
      throw new Error('Unknown reference')
    })
}

Deno.test('mergeTwoOneOfs - basic merging', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'string' }, { type: 'number' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'boolean' }, { type: 'string' }]
  }

  assertEquals(mergeTwoOneOfs(schema1, schema2, getRef), { type: 'string' })
})

Deno.test('mergeTwoOneOfs - with references', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    oneOf: [{ $ref: '#/components/schemas/User' }, { type: 'string' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    oneOf: [{ $ref: '#/components/schemas/User' }, { type: 'number' }]
  }

  assertEquals(mergeTwoOneOfs(schema1, schema2, getRef), { type: 'string' })
})

Deno.test('mergeTwoOneOfs - with other properties', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'string' }],
    description: 'First schema',
    title: 'Schema 1'
  }

  const schema2: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'number' }],
    description: 'Second schema',
    title: 'Schema 2'
  }

  assertThrows(
    () => mergeTwoOneOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})

Deno.test('mergeTwoOneOfs - one schema without oneOf', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    oneOf: [{ type: 'string' }]
  }

  const schema2: OpenAPIV3.SchemaObject = {
    type: 'number'
  }

  assertThrows(
    () => mergeTwoOneOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})

Deno.test('mergeTwoOneOfs - both schemas without oneOf', () => {
  const schema1: OpenAPIV3.SchemaObject = {
    type: 'string'
  }

  const schema2: OpenAPIV3.SchemaObject = {
    type: 'number'
  }

  assertThrows(
    () => mergeTwoOneOfs(schema1, schema2, getRef),
    Error,
    'Cannot merge schemas: conflicting types "string" and "number"'
  )
})
