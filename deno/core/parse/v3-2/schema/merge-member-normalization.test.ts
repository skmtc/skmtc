import { assert, assertEquals } from '@std/assert'
import * as log from '@std/log'
import { parse as parseYaml } from '@std/yaml'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasNumber } from '@/oas/number/Number.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasUnion } from '@/oas/union/Union.ts'

// Each `allOf`/`oneOf`/`anyOf` member is normalized with the 3.1 rules as it
// enters the merge. The documents here use 3.1 encodings inside merged
// members; each must parse with no error-level issue.

const openapi = '3.2.0'

const parseDocument = (document: Record<string, unknown>) => {
  const context = new ParseContext({
    input: { type: 'oas', value: toDocumentObject(document, 'test document') },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail([]))
  assert(result.type === 'oas')

  return {
    // Re-keyed by plain string so the tests can read schemas by name.
    schemas: Object.fromEntries(Object.entries(result.value.components?.schemas ?? {})),
    errors: context.issues.filter(issue => issue.level === 'error')
  }
}

const parseSchemas = (schemas: Record<string, unknown>) =>
  parseDocument({
    openapi,
    info: { title: 't', version: '1' },
    paths: {},
    components: { schemas }
  })

Deno.test('merge member normalization', async t => {
  await t.step('keeps WebSearchPlugin.user_location and every schema', () => {
    const { schemas, errors } = parseSchemas({
      WebSearchUserLocation: {
        type: ['object', 'null'],
        properties: { city: { type: 'string' } }
      },
      WebSearchPlugin: {
        type: 'object',
        properties: {
          user_location: {
            allOf: [
              { $ref: '#/components/schemas/WebSearchUserLocation' },
              { description: 'Approximate location', example: { city: 'London' } }
            ]
          }
        }
      },
      ChatRequest: {
        type: 'object',
        properties: {
          plugins: {
            type: 'array',
            items: {
              oneOf: [
                { $ref: '#/components/schemas/WebSearchPlugin' },
                { type: 'object', properties: { id: { type: 'string' } } }
              ]
            }
          }
        }
      }
    })

    assertEquals(errors, [])
    assertEquals(Object.keys(schemas).sort(), [
      'ChatRequest',
      'WebSearchPlugin',
      'WebSearchUserLocation'
    ])

    const plugin = schemas.WebSearchPlugin
    assert(plugin instanceof OasObject)
    const userLocation = plugin.properties?.user_location
    assert(userLocation instanceof OasObject)
    assertEquals(userLocation.nullable, true)
    assertEquals(userLocation.description, 'Approximate location')
    assert(userLocation.properties?.city instanceof OasString)
  })

  await t.step('shape 1: a type-array member next to an annotation-only member', () => {
    const { schemas, errors } = parseSchemas({
      Speed: { allOf: [{ type: ['string', 'null'], maxLength: 5 }, { description: 'Speed' }] }
    })

    assertEquals(errors, [])
    assert(schemas.Speed instanceof OasString)
    assertEquals(schemas.Speed.nullable, true)
    assertEquals(schemas.Speed.description, 'Speed')
  })

  await t.step('shape 2: equal type arrays in different array objects', () => {
    const { schemas, errors } = parseSchemas({
      Architecture: {
        allOf: [
          { type: ['object', 'null'], properties: { a: { type: 'string' } } },
          { type: ['object', 'null'], properties: { b: { type: 'string' } } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Architecture instanceof OasObject)
    assertEquals(schemas.Architecture.nullable, true)
    assertEquals(Object.keys(schemas.Architecture.properties ?? {}), ['a', 'b'])
  })

  await t.step('shape 3: two different $ref members with type arrays', () => {
    const { schemas, errors } = parseSchemas({
      First: { type: ['object', 'null'], properties: { a: { type: 'string' } } },
      Second: { type: ['object', 'null'], properties: { b: { type: 'string' } } },
      Result: {
        allOf: [{ $ref: '#/components/schemas/First' }, { $ref: '#/components/schemas/Second' }]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Result instanceof OasObject)
    assertEquals(Object.keys(schemas.Result.properties ?? {}), ['a', 'b'])
  })

  await t.step('shape 4: the same type-array object on both sides through a shared ref', () => {
    const sharedType = ['string', 'null']
    const { schemas, errors } = parseSchemas({
      BaseEvent: { type: 'object', properties: { status: { type: sharedType } } },
      Event: {
        allOf: [
          { $ref: '#/components/schemas/BaseEvent' },
          { properties: { status: { type: sharedType, description: 'Status' } } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Event instanceof OasObject)
    const status = schemas.Event.properties?.status
    assert(status instanceof OasString)
    assertEquals(status.nullable, true)
  })

  await t.step('a nested $ref property whose target has a type array', () => {
    const { schemas, errors } = parseSchemas({
      Location: { type: ['object', 'null'], properties: { city: { type: 'string' } } },
      Base: {
        type: 'object',
        properties: { location: { $ref: '#/components/schemas/Location' } }
      },
      Event: {
        allOf: [
          { $ref: '#/components/schemas/Base' },
          { properties: { location: { description: 'Where' } } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Event instanceof OasObject)
    const location = schemas.Event.properties?.location
    assert(location instanceof OasObject)
    assertEquals(location.nullable, true)
    assertEquals(location.description, 'Where')
  })

  await t.step('a oneOf $ref member with a type array keeps its place in the union', () => {
    const { schemas, errors } = parseSchemas({
      NullableKind: { type: ['object', 'null'], properties: { kind: { type: 'string' } } },
      Choice: {
        required: ['kind'],
        oneOf: [
          { $ref: '#/components/schemas/NullableKind' },
          { type: 'object', properties: { kind: { type: 'string' }, extra: { type: 'string' } } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Choice instanceof OasUnion)
    assertEquals(schemas.Choice.members.length, 2)
  })

  await t.step('an anyOf member that is an allOf over type arrays (ReasoningConfig)', () => {
    const { schemas, errors } = parseSchemas({
      BaseReasoningConfig: {
        type: 'object',
        properties: { enabled: { type: ['boolean', 'null'] } }
      },
      ReasoningConfig: {
        anyOf: [
          {
            allOf: [
              { $ref: '#/components/schemas/BaseReasoningConfig' },
              { type: 'object', properties: { enabled: { type: ['boolean', 'null'] } } }
            ]
          },
          { type: 'null' }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.ReasoningConfig instanceof OasObject)
    assertEquals(schemas.ReasoningConfig.nullable, true)
  })

  await t.step("a oneOf member with type ['null'] makes the union nullable", () => {
    const { schemas, errors } = parseSchemas({
      Name: { oneOf: [{ type: 'string' }, { type: ['null'] }] }
    })

    assertEquals(errors, [])
    assert(schemas.Name instanceof OasString)
    assertEquals(schemas.Name.nullable, true)
  })

  await t.step("shape 5: 'array' against ['array', 'null']", () => {
    const { schemas, errors } = parseSchemas({
      Items: {
        allOf: [
          { type: 'array', items: { type: 'string' } },
          { type: ['array', 'null'], items: { type: 'string' } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Items instanceof OasArray)
    assertEquals(schemas.Items.nullable, true)
  })

  await t.step('a numeric exclusiveMinimum in a member keeps its bound', () => {
    const { schemas, errors } = parseSchemas({
      Bounded: { allOf: [{ type: 'number', exclusiveMinimum: 5 }, { minimum: 1 }] }
    })

    assertEquals(errors, [])
    assert(schemas.Bounded instanceof OasNumber)
    assertEquals(schemas.Bounded.minimum, 5)
    assertEquals(schemas.Bounded.exclusiveMinimum, true)
  })

  await t.step("['array', 'null'] with no items merges without an error", () => {
    const { schemas, errors } = parseSchemas({
      Tags: { allOf: [{ type: ['array', 'null'] }, { description: 'Tags' }] }
    })

    assertEquals(errors, [])
    assert(schemas.Tags instanceof OasArray)
    assertEquals(schemas.Tags.nullable, true)
  })

  await t.step('a { type: null } member makes the merged result nullable', () => {
    const { schemas, errors } = parseSchemas({
      Maybe: {
        allOf: [{ type: 'object', properties: { a: { type: 'string' } } }, { type: 'null' }]
      }
    })

    assertEquals(errors, [])
    assert(schemas.Maybe instanceof OasObject)
    assertEquals(schemas.Maybe.nullable, true)
  })
})

Deno.test('merge member normalization - openrouter.yaml has no merge error', async () => {
  const text = await Deno.readTextFile(
    new URL('../../../_schemas/openrouter.yaml', import.meta.url)
  )
  const fixture: OpenAPIV3.Document = toDocumentObject(parseYaml(text), 'openrouter.yaml')
  const { errors } = parseDocument({ ...fixture, openapi })

  assertEquals(
    errors.filter(issue => issue.message.includes('Cannot merge schemas')),
    []
  )
})
