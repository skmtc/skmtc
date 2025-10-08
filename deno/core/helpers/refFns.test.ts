import { assertEquals, assertThrows } from '@std/assert'
import { toRefName, isRef, toGetRef } from './refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'

Deno.test('toRefName - extracts name from schema reference', () => {
  const refName = toRefName('#/components/schemas/User')
  assertEquals(refName, 'User')
})

Deno.test('toRefName - extracts name from response reference', () => {
  const refName = toRefName('#/components/responses/ErrorResponse')
  assertEquals(refName, 'ErrorResponse')
})

Deno.test('toRefName - extracts name from parameter reference', () => {
  const refName = toRefName('#/components/parameters/LimitParam')
  assertEquals(refName, 'LimitParam')
})

Deno.test('toRefName - throws error for invalid reference', () => {
  assertThrows(
    () => toRefName('invalid/ref/'),
    Error,
    'Invalid reference'
  )
})

Deno.test('toRefName - throws error for empty reference', () => {
  assertThrows(
    () => toRefName('#/components/schemas/'),
    Error,
    'Invalid reference'
  )
})

Deno.test('isRef - returns true for valid reference object', () => {
  const ref = { $ref: '#/components/schemas/User' }
  assertEquals(isRef(ref), true)
})

Deno.test('isRef - returns false for schema object', () => {
  const schema = { type: 'string' }
  assertEquals(isRef(schema), false)
})

Deno.test('isRef - returns false for null', () => {
  assertEquals(isRef(null), false)
})

Deno.test('isRef - returns false for undefined', () => {
  assertEquals(isRef(undefined), false)
})

Deno.test('isRef - returns false for non-object values', () => {
  assertEquals(isRef('string'), false)
  assertEquals(isRef(123), false)
  assertEquals(isRef(true), false)
})

Deno.test('isRef - returns false for object without $ref', () => {
  assertEquals(isRef({ type: 'object' }), false)
})

Deno.test('isRef - returns false for object with non-string $ref', () => {
  assertEquals(isRef({ $ref: 123 }), false)
})

Deno.test('toGetRef - resolves direct schema reference', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      }
    }
  }

  const resolver = toGetRef(document)
  const schema = resolver({ $ref: '#/components/schemas/User' })

  assertEquals(schema.type, 'object')
  assertEquals(schema.properties?.name, { type: 'string' })
})

Deno.test('toGetRef - resolves nested reference chains', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        UserRef: { $ref: '#/components/schemas/User' },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  }

  const resolver = toGetRef(document)
  const schema = resolver({ $ref: '#/components/schemas/UserRef' })

  assertEquals(schema.type, 'object')
  assertEquals(schema.properties?.id, { type: 'string' })
})

Deno.test('toGetRef - throws error for non-existent reference', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {}
    }
  }

  const resolver = toGetRef(document)

  assertThrows(
    () => resolver({ $ref: '#/components/schemas/NonExistent' }),
    Error,
    'Invalid reference: #/components/schemas/NonExistent'
  )
})

Deno.test('toGetRef - throws error when components is missing', () => {
  const document: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {}
  }

  const resolver = toGetRef(document)

  assertThrows(
    () => resolver({ $ref: '#/components/schemas/User' }),
    Error,
    'Invalid reference: #/components/schemas/User'
  )
})
