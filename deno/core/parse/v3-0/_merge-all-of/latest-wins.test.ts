import { assertEquals, assertThrows } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { mergeIntersection } from './merge-intersection.ts'
import type { MergeSystem } from './types.ts'

const getRef = (): OpenAPIV3.SchemaObject => ({})
const system = (allOf: MergeSystem['allOf']): MergeSystem => ({ allOf, replaced: new Set() })

// Cloudflare's envelopes: the common response says `success` is true, an error response that it is false.
const envelope: OpenAPIV3.SchemaObject = {
  allOf: [
    { type: 'object', properties: { success: { type: 'boolean', enum: [true] }, result: { type: 'string' } } },
    { type: 'object', properties: { success: { type: 'boolean', enum: [false] } } }
  ]
}

Deno.test('latestWins: where allOf members contradict, the later member keeps its keyword, and it is named', () => {
  const latestWins = system('latestWins')

  assertEquals(mergeIntersection({ schema: envelope, getRef, system: latestWins }), {
    type: 'object',
    properties: { success: { type: 'boolean', enum: [false] }, result: { type: 'string' } }
  })
  assertEquals([...latestWins.replaced], ['enum'])
})

Deno.test('latestWins: a type the later member disagrees with makes it the whole schema', () => {
  const latestWins = system('latestWins')
  const schema: OpenAPIV3.SchemaObject = { allOf: [{ type: 'string', minLength: 2 }, { type: 'integer', minimum: 1 }] }

  assertEquals(mergeIntersection({ schema, getRef, system: latestWins }), { type: 'integer', minimum: 1 })
  assertEquals([...latestWins.replaced], ['type'])
})

Deno.test('strict, the default: a contradiction still fails the merge, and nothing is named', () => {
  const strict = system('strict')

  assertThrows(() => mergeIntersection({ schema: envelope, getRef, system: strict }), Error, 'enum values have no intersection')
  assertEquals(strict.replaced.size, 0)
})
