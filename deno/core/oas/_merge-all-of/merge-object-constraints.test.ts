import { assertEquals, assertThrows } from '@std/assert'
import { mergeObjectConstraints } from './merge-object-constraints.ts'
import type { OpenAPIV3 } from 'openapi-types'

const mockGetRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
  throw new Error('Not implemented')
}
Deno.test('mergeObjectConstraints - merges property constraints', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    minProperties: 0,
    maxProperties: 10,
    properties: {
      name: { type: 'string' }
    }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    minProperties: 5,
    maxProperties: 15,
    properties: {
      age: { type: 'number' }
    }
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    minProperties: 5,
    maxProperties: 10,
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  })
})

Deno.test('mergeObjectConstraints - handles missing constraints', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    minProperties: 5,
    maxProperties: 15,
    properties: {
      age: { type: 'number' }
    }
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    minProperties: 5,
    maxProperties: 15,
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  })
})

Deno.test('mergeObjectConstraints - handles additionalProperties', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' }
    }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      age: { type: 'number' }
    }
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    }
  })
})

Deno.test('mergeObjectConstraints - merges required properties', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      age: { type: 'number' }
    },
    required: ['age']
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' }
    },
    required: ['name', 'age']
  })
})

// INGORE FOR NOW
// Deno.test('mergeObjectConstraints - merges pattern properties', () => {
//   const a = {
//     type: 'object',
//     patternProperties: {
//       '^x-': { type: 'string' }
//     }
//   } as unknown as OpenAPIV3.SchemaObject
//   const b = {
//     type: 'object',
//     patternProperties: {
//       '^y-': { type: 'number' }
//     }
//   } as unknown as OpenAPIV3.SchemaObject
//   const result = mergeObjectConstraints(a, b)
//   assertEquals(result, {
//     type: 'object',
//     patternProperties: {
//       '^x-': { type: 'string' },
//       '^y-': { type: 'number' }
//     }
//   })
// })

Deno.test('mergeObjectConstraints - merges additionalProperties with schema', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    additionalProperties: { type: 'string' }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    additionalProperties: { type: 'number' }
  }

  assertThrows(
    () => mergeObjectConstraints(a, b, mockGetRef),
    Error,
    `Cannot merge schemas: conflicting types 'string' and 'number'`
  )
})

Deno.test('mergeObjectConstraints - handles property conflicts', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'number' }
    }
  }

  assertThrows(
    () => mergeObjectConstraints(a, b, mockGetRef),
    Error,
    `Cannot merge schemas: conflicting types 'string' and 'number'`
  )
})

Deno.test('mergeObjectConstraints - handles empty properties', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {}
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  })
})

Deno.test('mergeObjectConstraints - throws error when merging object with non-object', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const b: OpenAPIV3.SchemaObject = {
    type: 'string',
    minLength: 1
  }

  assertThrows(
    () => mergeObjectConstraints(a, b, mockGetRef),
    Error,
    "Cannot merge schemas: conflicting types 'object' and 'string'"
  )
})

Deno.test('mergeObjectConstraints - merges enum values when both schemas have enums', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ baz: 'qux' }, { quux: 'corge' }]
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    enum: [{ baz: 'qux' }]
  })
})

Deno.test('mergeObjectConstraints - takes enum from second schema when first has no enum', () => {
  const a: OpenAPIV3.SchemaObject = { type: 'object' }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  }
  const result = mergeObjectConstraints(a, b, mockGetRef)
  assertEquals(result, {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  })
})

Deno.test('mergeObjectConstraints - takes enum from first schema when second has no enum', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  }

  const b: OpenAPIV3.SchemaObject = { type: 'object' }

  const result = mergeObjectConstraints(a, b, mockGetRef)

  assertEquals(result, {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  })
})

Deno.test('mergeObjectConstraints - throws when enum intersection is empty', () => {
  const a: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ foo: 'bar' }, { baz: 'qux' }]
  }
  const b: OpenAPIV3.SchemaObject = {
    type: 'object',
    enum: [{ quux: 'corge' }, { grault: 'garply' }]
  }
  assertThrows(
    () => mergeObjectConstraints(a, b, mockGetRef),
    Error,
    'Merged schema has empty enum array'
  )
})
