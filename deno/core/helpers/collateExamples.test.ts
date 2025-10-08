import { assertEquals, assertThrows } from '@std/assert'
import { collateExamples } from './collateExamples.ts'
import { OasString } from '../oas/string/String.ts'
import { OasNumber } from '../oas/number/Number.ts'
import { OasInteger } from '../oas/integer/Integer.ts'
import { OasBoolean } from '../oas/boolean/Boolean.ts'
import { OasObject } from '../oas/object/Object.ts'
import { OasArray } from '../oas/array/Array.ts'
import { OasUnion } from '../oas/union/Union.ts'
import { OasUnknown } from '../oas/unknown/Unknown.ts'

Deno.test('collateExamples - returns undefined for undefined schema', () => {
  const result = collateExamples({ objectSchema: undefined, depth: 0 })
  assertEquals(result, undefined)
})

Deno.test('collateExamples - throws error when depth exceeds limit', () => {
  const schema = new OasString({ example: 'test' })

  assertThrows(
    () => collateExamples({ objectSchema: schema, depth: 16 }),
    Error,
    'Depth limit reached'
  )
})

Deno.test('collateExamples - returns string example', () => {
  const schema = new OasString({ example: 'john.doe@example.com' })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, 'john.doe@example.com')
})

Deno.test('collateExamples - returns number example', () => {
  const schema = new OasNumber({ example: 42.5 })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, 42.5)
})

Deno.test('collateExamples - returns integer example', () => {
  const schema = new OasInteger({ example: 123 })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, 123)
})

Deno.test('collateExamples - returns boolean example', () => {
  const schema = new OasBoolean({ example: true })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, true)
})

Deno.test('collateExamples - returns unknown example', () => {
  const schema = new OasUnknown({ example: { custom: 'data' } })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, { custom: 'data' })
})

Deno.test('collateExamples - returns undefined when string has no example', () => {
  const schema = new OasString({})
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, undefined)
})

Deno.test('collateExamples - collates object with properties', () => {
  const schema = new OasObject({
    properties: {
      id: new OasInteger({ example: 123 }),
      name: new OasString({ example: 'John Doe' }),
      email: new OasString({ example: 'john@example.com' })
    }
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com'
  })
})

Deno.test('collateExamples - returns object example when provided', () => {
  const schema = new OasObject({
    example: { preset: 'example' },
    properties: {
      id: new OasInteger({ example: 123 })
    }
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, { preset: 'example' })
})

Deno.test('collateExamples - returns undefined for empty object', () => {
  const schema = new OasObject({ properties: {} })
  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, undefined)
})

Deno.test('collateExamples - returns undefined for object with no examples', () => {
  const schema = new OasObject({
    properties: {
      name: new OasString({}),
      age: new OasInteger({})
    }
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, undefined)
})

Deno.test('collateExamples - collates array example from items', () => {
  const schema = new OasArray({
    items: new OasObject({
      properties: {
        id: new OasInteger({ example: 1 }),
        name: new OasString({ example: 'Item' })
      }
    })
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, [
    {
      id: 1,
      name: 'Item'
    }
  ])
})

Deno.test('collateExamples - returns array example when provided', () => {
  const schema = new OasArray({
    example: ['preset', 'array'],
    items: new OasString({ example: 'item' })
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, ['preset', 'array'])
})

Deno.test('collateExamples - returns undefined for array with no item example', () => {
  const schema = new OasArray({
    items: new OasString({})
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, undefined)
})

Deno.test('collateExamples - returns first union member with example', () => {
  const schema = new OasUnion({
    members: [
      new OasString({}),
      new OasNumber({ example: 99 }),
      new OasString({ example: 'text' })
    ]
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, 99)
})

Deno.test('collateExamples - returns undefined for union with no examples', () => {
  const schema = new OasUnion({
    members: [
      new OasString({}),
      new OasNumber({})
    ]
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, undefined)
})

Deno.test('collateExamples - handles nested objects', () => {
  const schema = new OasObject({
    properties: {
      user: new OasObject({
        properties: {
          profile: new OasObject({
            properties: {
              name: new OasString({ example: 'John' })
            }
          })
        }
      })
    }
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, {
    user: {
      profile: {
        name: 'John'
      }
    }
  })
})

Deno.test('collateExamples - increments depth for nested structures', () => {
  const schema = new OasObject({
    properties: {
      level1: new OasObject({
        properties: {
          level2: new OasString({ example: 'deep' })
        }
      })
    }
  })

  const result = collateExamples({ objectSchema: schema, depth: 13 })

  assertEquals(result, {
    level1: {
      level2: 'deep'
    }
  })
})
