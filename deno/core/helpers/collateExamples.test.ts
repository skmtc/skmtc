import { assertEquals, assertThrows } from '@std/assert'
import { collateExamples } from './collateExamples.ts'
import { OasComponents } from '../oas/components/Components.ts'
import { OasDocument } from '../oas/document/Document.ts'
import { OasInfo } from '../oas/info/Info.ts'
import { OasRef } from '../oas/ref/Ref.ts'
import { toOasParsedDocument } from '../types/SkmtcDocument.ts'
import { toRefParseContextStub } from '../test/mockParseContext.ts'
import { OasString } from '../oas/string/String.ts'
import { OasNumber } from '../oas/number/Number.ts'
import { OasInteger } from '../oas/integer/Integer.ts'
import { OasBoolean } from '../oas/boolean/Boolean.ts'
import { OasObject } from '../oas/object/Object.ts'
import { OasArray } from '../oas/array/Array.ts'
import { OasUnion } from '../oas/union/Union.ts'
import { OasUnknown } from '../oas/unknown/Unknown.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'

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
    members: [new OasString({}), new OasNumber({ example: 99 }), new OasString({ example: 'text' })]
  })

  const result = collateExamples({ objectSchema: schema, depth: 0 })

  assertEquals(result, 99)
})

Deno.test('collateExamples - returns undefined for union with no examples', () => {
  const schema = new OasUnion({
    members: [new OasString({}), new OasNumber({})]
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

/**
 * Reference cycles.
 *
 * A schema that reaches itself pads the recursion path until the depth limit
 * throws, roughly sixteen steps in — so before the cycle guard a
 * self-referential schema and a legitimately deep one failed identically, and a
 * caller that only wanted a sample body got an exception. Cutting the cycle
 * omits the recursive key and lets collation finish.
 *
 * Found via skmtc-hub's docs viewer, where buddy-api's
 * `workspaces/:workspace_domain/variables/get` slice carries 52 component
 * schemas and 20 cycles, 18 of them variants pointing back at `TargetView`.
 */
const toCyclicRef = (schemas: Record<string, OasSchema>, name: string) => {
  const document = toOasParsedDocument(
    new OasDocument({
      openapi: '3.0.0',
      info: new OasInfo({ title: 'Cycles', version: '1.0.0' }),
      operations: [],
      components: new OasComponents({ schemas })
    })
  )

  return new OasRef<'schema'>(
    { $ref: `#/components/schemas/${name}`, refType: 'schema' },
    toRefParseContextStub(document)
  )
}

Deno.test('collateExamples - omits a directly self-referential property', () => {
  const schemas: Record<string, OasSchema> = {}
  schemas.Node = new OasObject({
    properties: {
      label: new OasString({ example: 'root' }),
      get parent() {
        return toCyclicRef(schemas, 'Node')
      }
    }
  }) as OasSchema

  const result = collateExamples({
    objectSchema: toCyclicRef(schemas, 'Node'),
    depth: 0
  })

  assertEquals(result, { label: 'root' })
})

Deno.test('collateExamples - omits a cycle that closes through a second schema', () => {
  const schemas: Record<string, OasSchema> = {}
  schemas.Hub = new OasObject({
    properties: {
      name: new OasString({ example: 'hub' }),
      get variant() {
        return toCyclicRef(schemas, 'Variant')
      }
    }
  }) as OasSchema
  schemas.Variant = new OasObject({
    properties: {
      kind: new OasString({ example: 'git' }),
      get hub() {
        return toCyclicRef(schemas, 'Hub')
      }
    }
  }) as OasSchema

  const result = collateExamples({
    objectSchema: toCyclicRef(schemas, 'Hub'),
    depth: 0
  })

  assertEquals(result, { name: 'hub', variant: { kind: 'git' } })
})

Deno.test('collateExamples - omits a cycle that closes through an array', () => {
  const schemas: Record<string, OasSchema> = {}
  schemas.Tree = new OasObject({
    properties: {
      label: new OasString({ example: 'branch' }),
      get children() {
        return new OasArray({ items: toCyclicRef(schemas, 'Tree') })
      }
    }
  }) as OasSchema

  const result = collateExamples({
    objectSchema: toCyclicRef(schemas, 'Tree'),
    depth: 0
  })

  assertEquals(result, { label: 'branch' })
})

/**
 * The guard is path-scoped, and this is what pins that. A global visited set
 * stops the cycles above just as well, and also drops the example for the
 * SECOND sibling use of a shared schema — quietly emptying samples on every
 * document that reuses a type.
 */
Deno.test('collateExamples - keeps the example at every sibling use of one schema', () => {
  const schemas: Record<string, OasSchema> = {
    Address: new OasObject({
      properties: { street: new OasString({ example: '1 High St' }) }
    }) as OasSchema
  }
  const order = new OasObject({
    properties: {
      billing: toCyclicRef(schemas, 'Address'),
      shipping: toCyclicRef(schemas, 'Address')
    }
  })

  const result = collateExamples({
    objectSchema: order as OasSchema,
    depth: 0
  })

  assertEquals(result, {
    billing: { street: '1 High St' },
    shipping: { street: '1 High St' }
  })
})
