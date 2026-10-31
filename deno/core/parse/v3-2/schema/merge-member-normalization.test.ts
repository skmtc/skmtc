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
import { OasUnknown } from '@/oas/unknown/Unknown.ts'

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

  await t.step('a nullable anyOf $ref inside an allOf stays a nullable member type', () => {
    const { schemas, errors } = parseSchemas({
      N: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      A: {
        type: 'object',
        properties: {
          p: { allOf: [{ $ref: '#/components/schemas/N' }, { description: 'x' }] },
          q: { allOf: [{ oneOf: [{ type: 'string' }, { type: 'null' }] }, { description: 'x' }] }
        }
      }
    })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasObject)
    for (const property of [schemas.A.properties?.p, schemas.A.properties?.q]) {
      assert(property instanceof OasString)
      assertEquals(property.nullable, true)
      assertEquals(property.description, 'x')
    }
  })

  await t.step('array items with equal type arrays merge (shape 2 one level down)', () => {
    const { schemas, errors } = parseSchemas({
      A: {
        allOf: [
          { type: 'array', items: { type: ['string', 'null'] } },
          { type: 'array', items: { type: ['string', 'null'], minLength: 1 } }
        ]
      }
    })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasArray)
    assert(schemas.A.items instanceof OasString)
    assertEquals(schemas.A.items.nullable, true)
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

Deno.test('merge member normalization - a multi-type member keeps its sibling keys', () => {
  const { schemas, errors } = parseSchemas({
    Code: {
      allOf: [
        { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
        { type: ['string', 'number'], minLength: 2 }
      ]
    }
  })

  assertEquals(errors, [])
  assert(schemas.Code instanceof OasString)
  assertEquals(schemas.Code.minLength, 2)
})

Deno.test('merge member normalization - a nested null-only oneOf parses', async t => {
  const nullOnly = { oneOf: [{ type: 'null' }] }

  await t.step('as an allOf member', () => {
    const { schemas, errors } = parseSchemas({ A: { allOf: [{ type: 'string' }, nullOnly] } })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasString)
    assertEquals(schemas.A.nullable, true)
  })

  await t.step('as a oneOf member', () => {
    const { schemas, errors } = parseSchemas({ A: { oneOf: [{ type: 'string' }, nullOnly] } })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasString)
    assertEquals(schemas.A.nullable, true)
  })

  await t.step('as the only member of a oneOf', () => {
    const { schemas, errors } = parseSchemas({
      A: { oneOf: [nullOnly] },
      B: { allOf: [{ oneOf: [nullOnly] }, { description: 'x' }] }
    })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasUnknown)
    assertEquals(schemas.A.nullable, true)
    assert(schemas.B instanceof OasUnknown)
    assertEquals(schemas.B.nullable, true)
  })

  await t.step('with union-level keys beside the null member', () => {
    const { schemas, errors } = parseSchemas({
      A: { oneOf: [{ type: 'null', title: 'Null' }] },
      B: { anyOf: [{ type: 'string' }, { oneOf: [{ type: 'null' }], description: 'n' }] }
    })

    assertEquals(errors, [])
    assert(schemas.A instanceof OasUnknown)
    assertEquals(schemas.A.nullable, true)
    assert(schemas.B instanceof OasString)
    assertEquals(schemas.B.nullable, true)
  })
})

Deno.test('merge member normalization - minimum beside a numeric exclusiveMinimum', () => {
  const { schemas, errors } = parseSchemas({
    Alone: { type: 'number', minimum: 10, exclusiveMinimum: 5, maximum: 20, exclusiveMaximum: 30 },
    Merged: {
      allOf: [
        { type: 'number', minimum: 10, exclusiveMinimum: 5 },
        { type: 'number', minimum: 7 }
      ]
    }
  })

  assertEquals(errors, [])
  assert(schemas.Alone instanceof OasNumber)
  assertEquals(schemas.Alone.minimum, 10)
  assertEquals(schemas.Alone.exclusiveMinimum, undefined)
  assertEquals(schemas.Alone.maximum, 20)
  assertEquals(schemas.Alone.exclusiveMaximum, undefined)
  assert(schemas.Merged instanceof OasNumber)
  assertEquals(schemas.Merged.minimum, 10)
  assertEquals(schemas.Merged.exclusiveMinimum, undefined)
})

Deno.test('merge member normalization - a nullable multi-type member keeps the union nullable', () => {
  const { schemas, errors } = parseSchemas({
    N: { oneOf: [{ type: ['string', 'number', 'null'] }, { type: 'boolean' }] }
  })

  assertEquals(errors, [])
  assert(schemas.N instanceof OasUnion)
  assertEquals(schemas.N.nullable, true)
  assertEquals(schemas.N.members.length, 3)
})

Deno.test('merge member normalization - the tighter numeric bound keeps its exclusivity', () => {
  // `exclusiveMinimum`/`exclusiveMaximum` carry the bound itself.
  const { schemas, errors } = parseSchemas({
    Bounded: {
      allOf: [
        { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 10 },
        { type: 'number', minimum: 5, maximum: 10 }
      ]
    }
  })

  assertEquals(errors, [])
  assert(schemas.Bounded instanceof OasNumber)
  assertEquals(schemas.Bounded.minimum, 5)
  assertEquals(schemas.Bounded.exclusiveMinimum, undefined)
  assertEquals(schemas.Bounded.maximum, 10)
  assertEquals(schemas.Bounded.exclusiveMaximum, true)
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
