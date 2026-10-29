import { assertEquals } from '@std/assert'
import { convertObj, type InferredMediaType } from './converter.ts'
import { isJsonObject, type JsonObject, type JsonValue } from './json.ts'

// A Swagger 2.0 response says nothing about its media type unless `produces`
// lists one. Upstream swagger2openapi then files the schema under `*/*`, which
// every reader that looks under `application/json` misses: the YouTube
// `channels.get` docs page showed no response schema because of it.

const obj = (value: JsonValue | undefined): JsonObject => {
  if (!isJsonObject(value)) throw new Error('expected object')
  return value
}

type Fixture = {
  schema: JsonValue
  produces?: string[]
  topProduces?: string[]
  definitions?: JsonObject
  warnOnly?: boolean
}

const convertOne = ({ schema, produces, topProduces, definitions, warnOnly }: Fixture) => {
  const { openapi, inferredMediaTypes } = convertObj(
    {
      swagger: '2.0',
      info: { title: 't', version: '1' },
      ...(topProduces ? { produces: topProduces } : {}),
      ...(definitions ? { definitions } : {}),
      paths: {
        '/pets': {
          get: {
            ...(produces ? { produces } : {}),
            responses: { '200': { description: 'ok', schema } }
          }
        }
      }
    },
    { warnOnly }
  )
  const response = obj(obj(obj(obj(obj(openapi.paths)['/pets']).get).responses)['200'])
  return { mediaTypes: Object.keys(obj(response.content)), inferredMediaTypes }
}

const inferred = (
  schemaKind: InferredMediaType['schemaKind'],
  mediaType: InferredMediaType['mediaType']
): InferredMediaType[] => [{ location: '#/paths/~1pets/get/responses/200', schemaKind, mediaType }]

Deno.test('no produces - an object schema is application/json', () => {
  const result = convertOne({ schema: { type: 'object', properties: { id: { type: 'string' } } } })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.inferredMediaTypes, inferred('object', 'application/json'))
})

Deno.test('no produces - an array schema is application/json', () => {
  const result = convertOne({ schema: { type: 'array', items: { type: 'string' } } })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.inferredMediaTypes, inferred('array', 'application/json'))
})

Deno.test('no produces - a $ref resolves to the definition it names', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/Pet' },
    definitions: { Pet: { type: 'object', properties: { id: { type: 'string' } } } }
  })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.inferredMediaTypes, inferred('object', 'application/json'))
})

Deno.test('no produces - a $ref chain resolves through each definition', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/PetList' },
    definitions: {
      PetList: { $ref: '#/definitions/Pets' },
      Pets: { type: 'array', items: { type: 'string' } }
    }
  })
  assertEquals(result.mediaTypes, ['application/json'])
})

Deno.test('no produces - allOf without a type is an object', () => {
  const result = convertOne({
    schema: { allOf: [{ $ref: '#/definitions/Pet' }] },
    definitions: { Pet: { type: 'object' } }
  })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.inferredMediaTypes, inferred('object', 'application/json'))
})

Deno.test('no produces - properties or additionalProperties without a type is an object', () => {
  assertEquals(convertOne({ schema: { properties: { id: {} } } }).mediaTypes, ['application/json'])
  assertEquals(convertOne({ schema: { additionalProperties: { type: 'string' } } }).mediaTypes, [
    'application/json'
  ])
})

Deno.test('no produces - a file schema is application/octet-stream', () => {
  const result = convertOne({ schema: { type: 'file' } })
  assertEquals(result.mediaTypes, ['application/octet-stream'])
  assertEquals(result.inferredMediaTypes, inferred('file', 'application/octet-stream'))
})

Deno.test('no produces - a string schema keeps */*', () => {
  // A bare string could be text/plain or a JSON string; nothing says which.
  const result = convertOne({ schema: { type: 'string' } })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.inferredMediaTypes, inferred('other', '*/*'))
})

Deno.test('no produces - an untyped schema keeps */*', () => {
  const result = convertOne({ schema: {} })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.inferredMediaTypes, inferred('other', '*/*'))
})

Deno.test('no produces - a $ref that does not resolve keeps */*', () => {
  // Without warnOnly the converter throws on the dangling ref itself.
  const result = convertOne({ schema: { $ref: '#/definitions/Missing' }, warnOnly: true })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.inferredMediaTypes, inferred('other', '*/*'))
})

Deno.test('no produces - a $ref cycle keeps */* and terminates', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/A' },
    definitions: { A: { $ref: '#/definitions/B' }, B: { $ref: '#/definitions/A' } }
  })
  assertEquals(result.mediaTypes, ['*/*'])
})

Deno.test('operation produces wins over the schema', () => {
  const result = convertOne({ schema: { type: 'object' }, produces: ['application/xml'] })
  assertEquals(result.mediaTypes, ['application/xml'])
  // Nothing was inferred, so nothing is reported.
  assertEquals(result.inferredMediaTypes, [])
})

Deno.test('top-level produces wins over the schema', () => {
  const result = convertOne({ schema: { type: 'object' }, topProduces: ['text/csv'] })
  assertEquals(result.mediaTypes, ['text/csv'])
  assertEquals(result.inferredMediaTypes, [])
})

Deno.test('responses of one operation are inferred one by one', () => {
  const { openapi, inferredMediaTypes } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    paths: {
      '/pets/{id}/photo': {
        get: {
          responses: {
            '200': { description: 'ok', schema: { type: 'file' } },
            '404': { description: 'missing', schema: { type: 'object' } }
          }
        }
      }
    }
  })
  const responses = obj(obj(obj(obj(openapi.paths)['/pets/{id}/photo']).get).responses)
  assertEquals(Object.keys(obj(obj(responses['200']).content)), ['application/octet-stream'])
  assertEquals(Object.keys(obj(obj(responses['404']).content)), ['application/json'])
  assertEquals(
    inferredMediaTypes.map(({ location }) => location),
    [
      '#/paths/~1pets~1{id}~1photo/get/responses/200',
      '#/paths/~1pets~1{id}~1photo/get/responses/404'
    ]
  )
})

Deno.test('a shared response under #/responses is reported at its own location', () => {
  const { openapi, inferredMediaTypes } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    responses: { Error: { description: 'error', schema: { type: 'object' } } },
    paths: {}
  })
  const error = obj(obj(obj(openapi.components).responses).Error)
  assertEquals(Object.keys(obj(error.content)), ['application/json'])
  assertEquals(inferredMediaTypes, [
    { location: '#/responses/Error', schemaKind: 'object', mediaType: 'application/json' }
  ])
})

Deno.test('an OpenAPI 3 document passes through with nothing inferred', () => {
  const { inferredMediaTypes } = convertObj({
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths: {}
  })
  assertEquals(inferredMediaTypes, [])
})
