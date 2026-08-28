import type { OpenAPIV3 } from 'openapi-types'
import { assert, assertEquals, assertStrictEquals } from '@std/assert'
import { hoistCyclicAllOf, toHoistedName } from './hoistCyclicAllOf.ts'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const document = (
  schemas: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>,
  paths: OpenAPIV3.PathsObject = {}
): OpenAPIV3.Document => ({
  openapi: '3.0.3',
  info: { title: 't', version: '1' },
  paths,
  components: { schemas }
})

Deno.test('hoistCyclicAllOf - a document with no cyclic inline allOf is returned as-is', () => {
  const input = document({
    Base: { type: 'object', properties: { id: { type: 'string' } } },
    Wrapper: {
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string' },
            { allOf: [ref('Base'), { properties: { extra: { type: 'string' } } }] }
          ]
        }
      }
    }
  })

  const { document: output, hoisted } = hoistCyclicAllOf(input)

  assertStrictEquals(output, input)
  assertEquals(hoisted, [])
})

Deno.test('hoistCyclicAllOf - an inline allOf on a cycle is hoisted and replaced by a $ref', () => {
  const input = document({
    'content-pattern': { oneOf: [ref('equal-to-pattern'), ref('matches-json-path-pattern')] },
    'equal-to-pattern': { type: 'object', properties: { equalTo: { type: 'string' } } },
    'matches-json-path-pattern': {
      type: 'object',
      properties: {
        matchesJsonPath: {
          oneOf: [
            { type: 'string' },
            { allOf: [{ properties: { expression: { type: 'string' } } }, ref('content-pattern')] }
          ]
        }
      }
    }
  })

  const { document: output, hoisted } = hoistCyclicAllOf(input)
  const name = 'matches-json-path-pattern~properties~matchesJsonPath~oneOf~1'

  assertEquals(hoisted, [name])
  assert(output !== input, 'a new document')
  assertEquals(input.components?.schemas?.[name], undefined, 'the input is not mutated')

  const schemas = output.components?.schemas ?? {}
  assertEquals(
    Object.keys(schemas).sort(),
    ['content-pattern', 'equal-to-pattern', 'matches-json-path-pattern', name].sort()
  )

  const site = schemas['matches-json-path-pattern'] as OpenAPIV3.SchemaObject
  const property = site.properties?.matchesJsonPath as OpenAPIV3.SchemaObject
  assertEquals(property.oneOf?.[1], ref(name))
  assertEquals((schemas[name] as OpenAPIV3.SchemaObject).allOf?.length, 2)
})

Deno.test('hoistCyclicAllOf - a non-cyclic inline allOf beside a cyclic one stays inline', () => {
  const input = document({
    Leaf: { type: 'object', properties: { leaf: { type: 'boolean' } } },
    Union: {
      oneOf: [
        { allOf: [{ properties: { expression: { type: 'string' } } }, ref('Union')] },
        { allOf: [ref('Leaf'), { properties: { extra: { type: 'string' } } }] }
      ]
    }
  })

  const { document: output, hoisted } = hoistCyclicAllOf(input)

  assertEquals(hoisted, ['Union~oneOf~0'])
  const union = output.components?.schemas?.Union as OpenAPIV3.SchemaObject
  assertEquals(union.oneOf?.[0], ref('Union~oneOf~0'))
  assert('allOf' in (union.oneOf?.[1] ?? {}), 'the acyclic member is untouched')
})

Deno.test('hoistCyclicAllOf - an inline allOf under paths that cycles through a component is hoisted', () => {
  const input = document(
    {
      Animal: { properties: { kind: { type: 'string' } }, oneOf: [ref('Dog')] },
      Dog: {
        allOf: [
          ref('Animal'),
          {
            properties: {
              friend: { allOf: [ref('Dog'), { properties: { since: { type: 'string' } } }] }
            }
          }
        ]
      }
    },
    {
      '/dogs': {
        get: {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': { schema: { allOf: [ref('Dog'), { required: ['friend'] }] } }
              }
            }
          }
        }
      }
    }
  )

  const { hoisted } = hoistCyclicAllOf(input)

  // Dog.friend reaches Dog again; the response schema reaches Dog but nothing reaches it back.
  assertEquals(hoisted, ['Dog~allOf~1~properties~friend'])
})

Deno.test('toHoistedName - the document path minus components/schemas, with ~ between frames', () => {
  assertEquals(
    toHoistedName(['components', 'schemas', 'A', 'properties', 'b', 'oneOf', '1']),
    'A~properties~b~oneOf~1'
  )
  assertEquals(
    toHoistedName(['paths', '/a/b', 'get', 'responses', '200']),
    'paths~-a-b~get~responses~200'
  )
})
