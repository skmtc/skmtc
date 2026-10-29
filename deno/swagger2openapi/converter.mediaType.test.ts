import { assertEquals } from '@std/assert'
import { convertObj, type MediaTypeInference, toMediaTypeInference } from './converter.ts'
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
  produces?: JsonValue
  topProduces?: string[]
  definitions?: JsonObject
  examples?: JsonObject
  warnOnly?: boolean
}

const convertOne = ({
  schema,
  produces,
  topProduces,
  definitions,
  examples,
  warnOnly
}: Fixture) => {
  const { openapi, mediaTypeInference } = convertObj(
    {
      swagger: '2.0',
      info: { title: 't', version: '1' },
      ...(topProduces ? { produces: topProduces } : {}),
      ...(definitions ? { definitions } : {}),
      paths: {
        '/pets': {
          get: {
            ...(typeof produces !== 'undefined' ? { produces } : {}),
            responses: {
              '200': { description: 'ok', schema, ...(examples ? { examples } : {}) }
            }
          }
        }
      }
    },
    { warnOnly }
  )
  const response = obj(obj(obj(obj(obj(openapi.paths)['/pets']).get).responses)['200'])
  const content = obj(response.content)
  return { content, mediaTypes: Object.keys(content), summary: mediaTypeInference }
}

/** The summary for one response at `/pets` decided by its schema. */
const decidedBy = (
  kind: keyof MediaTypeInference['schemaKinds'],
  mediaType: string
): MediaTypeInference => {
  const summary = toMediaTypeInference()
  summary.responses = 1
  summary.schemaKinds[kind] = 1
  summary.mediaTypes[mediaType] = 1
  if (kind === 'other') summary.unknownSample.push('#/paths/~1pets/get/responses/200')
  return summary
}

Deno.test('no produces - an object schema is application/json', () => {
  const result = convertOne({ schema: { type: 'object', properties: { id: { type: 'string' } } } })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.summary, decidedBy('object', 'application/json'))
})

Deno.test('no produces - an array schema is application/json', () => {
  const result = convertOne({ schema: { type: 'array', items: { type: 'string' } } })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.summary, decidedBy('array', 'application/json'))
})

Deno.test('no produces - items without a type is an array', () => {
  const result = convertOne({ schema: { items: { type: 'string' } } })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.summary, decidedBy('array', 'application/json'))
})

Deno.test('no produces - a $ref resolves to the definition it names', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/Pet' },
    definitions: { Pet: { type: 'object', properties: { id: { type: 'string' } } } }
  })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.summary, decidedBy('object', 'application/json'))
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

Deno.test('no produces - allOf with an object member is an object', () => {
  const result = convertOne({
    schema: { allOf: [{ $ref: '#/definitions/Pet' }] },
    definitions: { Pet: { type: 'object' } }
  })
  assertEquals(result.mediaTypes, ['application/json'])
  assertEquals(result.summary, decidedBy('object', 'application/json'))
})

Deno.test('no produces - allOf around a string enum keeps */*', () => {
  // The description-on-ref wrapper: the body is still a string.
  const result = convertOne({
    schema: { allOf: [{ $ref: '#/definitions/Status' }], description: 'The status' },
    definitions: { Status: { type: 'string', enum: ['on', 'off'] } }
  })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.summary, decidedBy('other', '*/*'))
})

Deno.test('no produces - x-anyOf and x-oneOf with an object member are objects', () => {
  // fixUpSchema turns these into anyOf and oneOf with no type.
  assertEquals(convertOne({ schema: { 'x-anyOf': [{ type: 'object' }] } }).mediaTypes, [
    'application/json'
  ])
  assertEquals(
    convertOne({ schema: { 'x-oneOf': [{ type: 'string' }, { type: 'array' }] } }).mediaTypes,
    ['application/json']
  )
})

Deno.test('no produces - anyOf of scalars keeps */*', () => {
  const result = convertOne({ schema: { anyOf: [{ type: 'string' }, { type: 'integer' }] } })
  assertEquals(result.mediaTypes, ['*/*'])
})

Deno.test('no produces - properties or additionalProperties without a type is an object', () => {
  assertEquals(convertOne({ schema: { properties: { id: {} } } }).mediaTypes, ['application/json'])
  assertEquals(convertOne({ schema: { additionalProperties: { type: 'string' } } }).mediaTypes, [
    'application/json'
  ])
})

Deno.test('no produces - a file schema is application/octet-stream and a binary string', () => {
  const result = convertOne({ schema: { type: 'file' } })
  assertEquals(result.mediaTypes, ['application/octet-stream'])
  assertEquals(obj(result.content['application/octet-stream']).schema, {
    type: 'string',
    format: 'binary'
  })
  assertEquals(result.summary, decidedBy('file', 'application/octet-stream'))
})

Deno.test('no produces - a $ref to a file schema is a binary string too', () => {
  // The media type and the schema must agree: before, the media type followed
  // the ref to `file` but the schema stayed a `$ref` to `type: file`.
  const result = convertOne({
    schema: { $ref: '#/definitions/Photo' },
    definitions: { Photo: { type: 'file' } }
  })
  assertEquals(result.mediaTypes, ['application/octet-stream'])
  assertEquals(obj(result.content['application/octet-stream']).schema, {
    type: 'string',
    format: 'binary'
  })
})

Deno.test('no produces - a string schema keeps */*', () => {
  // A bare string could be text/plain or a JSON string; nothing says which.
  const result = convertOne({ schema: { type: 'string' } })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.summary, decidedBy('other', '*/*'))
})

Deno.test('no produces - an untyped schema keeps */*', () => {
  const result = convertOne({ schema: {} })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.summary, decidedBy('other', '*/*'))
})

Deno.test('no produces - a $ref that does not resolve keeps */*', () => {
  // Without warnOnly the converter throws on the dangling ref itself.
  const result = convertOne({ schema: { $ref: '#/definitions/Missing' }, warnOnly: true })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.summary, decidedBy('other', '*/*'))
})

Deno.test('no produces - a $ref with a malformed % escape keeps */* and does not throw', () => {
  // The pointer decode throws URIError; the converter must not.
  const result = convertOne({
    schema: { $ref: '#/definitions/Rate/properties/50%' },
    definitions: { Rate: { type: 'object' } },
    warnOnly: true
  })
  assertEquals(result.mediaTypes, ['*/*'])
})

Deno.test('no produces - a $ref cycle keeps */* and terminates', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/A' },
    definitions: { A: { $ref: '#/definitions/B' }, B: { $ref: '#/definitions/A' } }
  })
  assertEquals(result.mediaTypes, ['*/*'])
})

Deno.test('no produces - the media types named in examples come before the schema', () => {
  const result = convertOne({
    schema: { $ref: '#/definitions/Pet' },
    definitions: { Pet: { type: 'object' } },
    examples: { 'application/xml': '<pet/>' }
  })
  assertEquals(result.mediaTypes, ['application/xml'])
  const xml = obj(result.content['application/xml'])
  assertEquals(xml.schema, { $ref: '#/components/schemas/Pet' })
  assertEquals(xml.examples, { response: { value: '<pet/>' } })
  const expected = toMediaTypeInference()
  expected.responses = 1
  expected.fromExamples = 1
  expected.mediaTypes['application/xml'] = 1
  assertEquals(result.summary, expected)
})

Deno.test('operation produces wins over the schema', () => {
  const result = convertOne({ schema: { type: 'object' }, produces: ['application/xml'] })
  assertEquals(result.mediaTypes, ['application/xml'])
  // Nothing was inferred, so nothing is counted.
  assertEquals(result.summary, toMediaTypeInference())
})

Deno.test('top-level produces wins over the schema', () => {
  const result = convertOne({ schema: { type: 'object' }, topProduces: ['text/csv'] })
  assertEquals(result.mediaTypes, ['text/csv'])
  assertEquals(result.summary, toMediaTypeInference())
})

Deno.test('an explicit empty operation produces keeps */*', () => {
  // A produces key, even an empty one, is the document speaking: no inference,
  // and no fallback to a type that neither level lists.
  const result = convertOne({
    schema: { type: 'object' },
    produces: [],
    topProduces: ['application/xml']
  })
  assertEquals(result.mediaTypes, ['*/*'])
  assertEquals(result.summary, toMediaTypeInference())
})

Deno.test('responses of one operation are inferred one by one', () => {
  const { openapi, mediaTypeInference } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    paths: {
      '/pets/{id}/photo': {
        get: {
          responses: {
            '200': { description: 'ok', schema: { type: 'file' } },
            '404': { description: 'missing', schema: { type: 'object' } },
            '500': { description: 'error', schema: { type: 'string' } }
          }
        }
      }
    }
  })
  const responses = obj(obj(obj(obj(openapi.paths)['/pets/{id}/photo']).get).responses)
  assertEquals(Object.keys(obj(obj(responses['200']).content)), ['application/octet-stream'])
  assertEquals(Object.keys(obj(obj(responses['404']).content)), ['application/json'])
  assertEquals(mediaTypeInference?.responses, 3)
  assertEquals(mediaTypeInference?.unknownSample, ['#/paths/~1pets~1{id}~1photo/get/responses/500'])
})

Deno.test('the */* sample keeps at most five locations', () => {
  const responses: JsonObject = {}
  for (const code of ['200', '201', '202', '203', '204', '205', '206']) {
    responses[code] = { description: 'ok', schema: { type: 'string' } }
  }
  const { mediaTypeInference } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    paths: { '/pets': { get: { responses } } }
  })
  assertEquals(mediaTypeInference?.responses, 7)
  assertEquals(mediaTypeInference?.mediaTypes, { '*/*': 7 })
  assertEquals(mediaTypeInference?.unknownSample.length, 5)
})

Deno.test('a shared response under #/responses is inferred when no produces is anywhere', () => {
  const { openapi, mediaTypeInference } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    responses: { Error: { description: 'error', schema: { type: 'object' } } },
    paths: {}
  })
  const error = obj(obj(obj(openapi.components).responses).Error)
  assertEquals(Object.keys(obj(error.content)), ['application/json'])
  assertEquals(mediaTypeInference?.responses, 1)
})

Deno.test('a shared response keeps */* when an operation that may use it has produces', () => {
  // An XML API with no top-level produces: the operations say XML, so filing
  // the shared error under application/json would contradict them.
  const { openapi, mediaTypeInference } = convertObj({
    swagger: '2.0',
    info: { title: 't', version: '1' },
    responses: { Err: { description: 'error', schema: { type: 'object' } } },
    paths: {
      '/pets': {
        get: {
          produces: ['application/xml'],
          responses: {
            '200': { description: 'ok', schema: { type: 'object' } },
            '400': { $ref: '#/responses/Err' }
          }
        }
      }
    }
  })
  const err = obj(obj(obj(openapi.components).responses).Err)
  assertEquals(Object.keys(obj(err.content)), ['*/*'])
  const ok = obj(obj(obj(obj(obj(openapi.paths)['/pets']).get).responses)['200'])
  assertEquals(Object.keys(obj(ok.content)), ['application/xml'])
  assertEquals(mediaTypeInference, toMediaTypeInference())
})

Deno.test('an OpenAPI 3 document passes through with nothing inferred', () => {
  const { mediaTypeInference } = convertObj({
    openapi: '3.0.0',
    info: { title: 't', version: '1' },
    paths: {}
  })
  assertEquals(mediaTypeInference, toMediaTypeInference())
})
