import { assertEquals } from '@std/assert'
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
import { OasIntersection } from '../oas/intersection/Intersection.ts'
import { OasUnion } from '../oas/union/Union.ts'
import { OasUnknown } from '../oas/unknown/Unknown.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'

Deno.test('collateExamples - returns undefined for undefined schema', () => {
  const result = collateExamples({ objectSchema: undefined, depth: 0 })
  assertEquals(result, undefined)
})

Deno.test('collateExamples - the depth limit is 15, and a schema past it has no example', () => {
  const schema = new OasString({ example: 'test' })

  assertEquals(collateExamples({ objectSchema: schema, depth: 15 }), 'test')
  assertEquals(collateExamples({ objectSchema: schema, depth: 16 }), undefined)
})

Deno.test('collateExamples - an object past the limit is left out, and its siblings stay', () => {
  const schema = new OasObject({
    properties: {
      before: new OasInteger({ example: 1 }),
      deep: new OasObject({ properties: { leaf: new OasString({ example: 'leaf' }) } }),
      after: new OasInteger({ example: 2 })
    }
  })

  assertEquals(collateExamples({ objectSchema: schema, depth: 14 }), { before: 1, after: 2 })
  assertEquals(collateExamples({ objectSchema: schema, depth: 15 }), undefined)
})

Deno.test('collateExamples - array items and union members past the limit give no example', () => {
  const leaf = new OasString({ example: 'leaf' })

  assertEquals(
    collateExamples({ objectSchema: new OasArray({ items: leaf }), depth: 15 }),
    undefined
  )
  assertEquals(
    collateExamples({ objectSchema: new OasUnion({ members: [leaf] }), depth: 15 }),
    undefined
  )
})

Deno.test('collateExamples - a ref whose target is past the limit gives no example', () => {
  const schemas: Record<string, OasSchema> = { Leaf: new OasString({ example: 'leaf' }) }

  assertEquals(collateExamples({ objectSchema: toCyclicRef(schemas, 'Leaf'), depth: 14 }), 'leaf')
  assertEquals(
    collateExamples({ objectSchema: toCyclicRef(schemas, 'Leaf'), depth: 15 }),
    undefined
  )
})

Deno.test('collateExamples - an intersection keeps the members that are not past the limit', () => {
  const schema = new OasIntersection({
    members: [
      new OasObject({ properties: { leaf: new OasString({ example: 'leaf' }) } }),
      new OasObject({ example: { kept: 'kept' } })
    ]
  })

  assertEquals(collateExamples({ objectSchema: schema, depth: 15 }), { kept: 'kept' })
  assertEquals(collateExamples({ objectSchema: schema, depth: 16 }), undefined)
})

/** Models `M1` to `M<length>`, each with an `id` and a ref to the next model in `next`. */
const toModelChain = (
  length: number,
  toNext: (ref: OasRef<'schema'>) => OasSchema | OasRef<'schema'>
) => {
  const schemas: Record<string, OasSchema> = {}

  Array.from({ length }, (_, index) => index + 1).forEach(position => {
    const id = new OasString({ example: `${position}` })

    schemas[`M${position}`] = new OasObject({
      properties:
        position === length
          ? { id }
          : { id, next: toNext(toCyclicRef(schemas, `M${position + 1}`)) }
    })
  })

  return toCyclicRef(schemas, 'M1')
}

Deno.test('collateExamples - of 8 models nested directly, the last is left out', () => {
  const toExample = (position: number): unknown =>
    position === 7 ? { id: '7' } : { id: `${position}`, next: toExample(position + 1) }

  const result = collateExamples({ objectSchema: toModelChain(8, ref => ref), depth: 0 })

  assertEquals(result, toExample(1))
})

Deno.test('collateExamples - of 6 models nested through arrays, the last is left out', () => {
  const toExample = (position: number): unknown =>
    position === 5 ? { id: '5' } : { id: `${position}`, next: [toExample(position + 1)] }

  const result = collateExamples({
    objectSchema: toModelChain(6, ref => new OasArray({ items: ref })),
    depth: 0
  })

  assertEquals(result, toExample(1))
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
 * Without the cycle guard, the example of a schema that reaches itself would
 * repeat the cycle until the depth limit, and a cycle of intersection members,
 * which add no depth, would not end. Cutting the cycle omits the recursive key.
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
