import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from './merge-intersection.ts'
import type { MergeSystem } from './types.ts'

const getRef = (): OpenAPIV3.SchemaObject => ({})
const system = (allOf: MergeSystem['allOf']): MergeSystem => ({ allOf, replaced: new Set() })

// Cloudflare's zone settings: the common setting's value is any scalar, an object or a list,
// and the Browser Cache TTL setting says it is an integer.
const zoneSetting: OpenAPIV3.SchemaObject = {
  allOf: [
    {
      properties: {
        value: {
          anyOf: [
            { type: 'string' },
            { type: 'number' },
            { type: 'boolean' },
            { type: 'object' },
            { type: 'array', items: { type: 'string' } }
          ]
        }
      },
      required: ['value']
    },
    { type: 'object', properties: { value: { type: 'integer', minimum: 0 } } }
  ]
}

const integerValue: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: { value: { anyOf: [{ type: 'integer', minimum: 0 }] } },
  required: ['value']
}

Deno.test('a number merged with an integer is an integer, with the constraints of both', () => {
  const strict = system('strict')
  const schema: OpenAPIV3.SchemaObject = { allOf: [{ type: 'number', minimum: 0 }, { type: 'integer', maximum: 10 }] }

  assertEquals(mergeIntersection({ schema, getRef, system: strict }), { type: 'integer', minimum: 0, maximum: 10 })
})

Deno.test('an integer merged with a later number is still an integer', () => {
  const strict = system('strict')
  const schema: OpenAPIV3.SchemaObject = { allOf: [{ type: 'integer' }, { type: 'number', maximum: 5 }] }

  assertEquals(mergeIntersection({ schema, getRef, system: strict }), { type: 'integer', maximum: 5 })
})

Deno.test('strict: a union with a number, merged with an integer, keeps the integer', () => {
  const strict = system('strict')

  // The trap: number and integer were two types, so no pair merged, and the schema failed with
  // `"anyOf" array is empty`.
  assertEquals(mergeIntersection({ schema: zoneSetting, getRef, system: strict }), integerValue)
})

Deno.test('latestWins: a number merged with an integer is no contradiction, and nothing is named', () => {
  const latestWins = system('latestWins')

  assertEquals(mergeIntersection({ schema: zoneSetting, getRef, system: latestWins }), integerValue)
  assertEquals(latestWins.replaced.size, 0)
})
