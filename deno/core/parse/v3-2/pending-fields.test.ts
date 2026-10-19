import { assert, assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// A 3.2-only field the v3-2 tree does not read into the IR yet must surface
// as a skipped-field warning rather than crash the parse. One row per field
// in the 3.2 dialect table of `core/parse/README.md`; a follow-up that reads
// a field into the IR moves its row from `pendingFields` to `readFields`.

const documentObject = toDocumentObject(
  {
    openapi: '3.2.0',
    $self: 'https://example.com/openapi.json',
    info: { title: 't', version: '0' },
    servers: [{ url: 'https://api.example.com', name: 'production' }],
    tags: [
      { name: 'pets', summary: 'Pets', kind: 'nav' },
      { name: 'cats', parent: 'pets' }
    ],
    paths: {
      '/pets': {
        query: { responses: { '200': { description: 'ok' } } },
        additionalOperations: {
          COPY: { responses: { '200': { description: 'ok' } } }
        },
        get: {
          operationId: 'listPets',
          responses: {
            '200': {
              summary: 'A page of pets',
              description: 'ok',
              content: {
                'application/jsonl': {
                  itemSchema: { type: 'string' },
                  examples: { one: { dataValue: 'a', serializedValue: '"a"' } }
                },
                'multipart/mixed': {
                  schema: { type: 'array', items: { type: 'string' } },
                  prefixEncoding: [{ contentType: 'text/plain' }],
                  itemEncoding: { contentType: 'text/plain' }
                },
                'text/event-stream': { itemSchema: { type: 'string' } },
                'application/x-ndjson': { $ref: '#/components/mediaTypes/Lines' }
              }
            }
          }
        }
      },
      '/search': {
        get: {
          operationId: 'search',
          parameters: [
            {
              name: 'q',
              in: 'querystring',
              content: {
                'application/x-www-form-urlencoded': { schema: { type: 'object' } }
              }
            }
          ],
          responses: { '200': { description: 'ok' } }
        }
      },
      '/session': {
        get: {
          operationId: 'session',
          parameters: [{ name: 'id', in: 'cookie', style: 'cookie', schema: { type: 'string' } }],
          responses: { '200': { description: 'ok' } }
        }
      }
    },
    components: {
      mediaTypes: { Lines: { itemSchema: { type: 'string' } } },
      schemas: {
        Pet: {
          oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }],
          discriminator: { propertyName: 'kind', defaultMapping: '#/components/schemas/Cat' }
        },
        Cat: { type: 'object', properties: { kind: { type: 'string' } } },
        Dog: { type: 'object', properties: { kind: { type: 'string' } } }
      },
      securitySchemes: {
        legacyKey: { type: 'apiKey', name: 'key', in: 'header', deprecated: true },
        oauth: {
          type: 'oauth2',
          oauth2MetadataUrl: 'https://example.com/.well-known/oauth-authorization-server',
          flows: {
            deviceAuthorization: {
              deviceAuthorizationUrl: 'https://example.com/device',
              tokenUrl: 'https://example.com/token',
              scopes: {}
            }
          }
        }
      }
    }
  },
  '3.2 document'
)

const pendingFields: Array<{ field: string; location: string }> = []

const context = new ParseContext({
  input: { type: 'oas', value: documentObject },
  logger: new log.Logger('test', 'ERROR'),
  silent: true
})
const result = context.parse(new StackTrail(['TEST']))

for (const { field, location } of pendingFields) {
  Deno.test(`v3-2 pending fields - ${field} is a skipped-field warning`, () => {
    const warning = context.issues.find(issue => issue.location === location)
    assertEquals(warning?.level, 'warning')
    assertEquals(warning?.type, 'UNEXPECTED_PROPERTY')
  })
}

const toDocument = () => {
  assert(result.type === 'oas')
  return result.value
}

const toPetsResponse = () => {
  const response = toDocument().operations.find(
    operation => operation.path === '/pets' && operation.method === 'get'
  )?.responses['200']
  assert(response !== undefined && !response.isRef())
  return response
}

const toPetsExample = () => {
  const example = toPetsResponse().content?.['application/jsonl']?.examples?.one
  assert(example !== undefined && !example.isRef())
  return example
}

const toOAuth2Scheme = () => {
  const scheme = toDocument().components?.securitySchemes?.oauth?.resolve()
  assert(scheme?.type === 'oauth2')
  return scheme
}

const petsContentLocation = 'TEST:paths:/pets:get:responses:200:content'

const readFields: Array<{
  field: string
  location: string
  toValue: () => unknown
  expected: unknown
}> = [
  {
    field: '$self',
    location: 'TEST:$self',
    toValue: () => toDocument().$self,
    expected: 'https://example.com/openapi.json'
  },
  {
    field: 'response summary',
    location: 'TEST:paths:/pets:get:responses:200:summary',
    toValue: () => toPetsResponse().summary,
    expected: 'A page of pets'
  },
  {
    field: 'example dataValue',
    location:
      'TEST:paths:/pets:get:responses:200:content:application/jsonl:examples:examples:one:dataValue',
    toValue: () => toPetsExample().dataValue,
    expected: 'a'
  },
  {
    field: 'example serializedValue',
    location:
      'TEST:paths:/pets:get:responses:200:content:application/jsonl:examples:examples:one:serializedValue',
    toValue: () => toPetsExample().serializedValue,
    expected: '"a"'
  },
  {
    field: 'tag parent',
    location: 'TEST:tags:parent',
    toValue: () => toDocument().tags?.map(tag => tag.parent),
    expected: [undefined, 'pets']
  },
  {
    field: 'tag kind',
    location: 'TEST:tags:kind',
    toValue: () => toDocument().tags?.map(tag => tag.kind),
    expected: ['nav', undefined]
  },
  {
    field: 'tag summary',
    location: 'TEST:tags:summary',
    toValue: () => toDocument().tags?.map(tag => tag.summary),
    expected: ['Pets', undefined]
  },
  {
    field: 'server name',
    location: 'TEST:servers:https%3A//api.example.com:name',
    toValue: () => toDocument().servers?.map(server => server.name),
    expected: ['production']
  },
  {
    field: 'discriminator defaultMapping',
    location: 'TEST:components:schemas:Pet:oneOf:discriminator:defaultMapping',
    toValue: () => {
      const pet = Object.entries(toDocument().components?.schemas ?? {}).find(
        ([refName]) => refName === 'Pet'
      )?.[1]
      assert(pet !== undefined && !pet.isRef() && pet.type === 'union')
      return pet.discriminator?.defaultMapping
    },
    expected: '#/components/schemas/Cat'
  },
  {
    field: 'media type itemSchema',
    location: `${petsContentLocation}:text/event-stream:itemSchema`,
    toValue: () => toPetsResponse().content?.['text/event-stream']?.itemSchema?.type,
    expected: 'string'
  },
  {
    field: 'media type prefixEncoding',
    location: `${petsContentLocation}:multipart/mixed:prefixEncoding`,
    toValue: () => toPetsResponse().content?.['multipart/mixed']?.prefixEncoding,
    expected: [{ contentType: 'text/plain' }]
  },
  {
    field: 'media type itemEncoding',
    location: `${petsContentLocation}:multipart/mixed:itemEncoding`,
    toValue: () => toPetsResponse().content?.['multipart/mixed']?.itemEncoding,
    expected: { contentType: 'text/plain' }
  },
  {
    // Not stored on the components; resolved into the content entry that
    // references it.
    field: 'components.mediaTypes',
    location: 'TEST:components:mediaTypes',
    toValue: () => toPetsResponse().content?.['application/x-ndjson']?.itemSchema?.type,
    expected: 'string'
  },
  {
    field: 'security scheme deprecated',
    location: 'TEST:components:securitySchemes:legacyKey:deprecated',
    toValue: () => toDocument().components?.securitySchemes?.legacyKey?.resolve().deprecated,
    expected: true
  },
  {
    field: 'security scheme oauth2MetadataUrl',
    location: 'TEST:components:securitySchemes:oauth:oauth2MetadataUrl',
    toValue: () => toOAuth2Scheme().oauth2MetadataUrl,
    expected: 'https://example.com/.well-known/oauth-authorization-server'
  },
  {
    field: 'OAuth flow deviceAuthorization',
    location: 'TEST:components:securitySchemes:oauth:flows:deviceAuthorization',
    toValue: () => toOAuth2Scheme().flows.deviceAuthorization,
    expected: {
      deviceAuthorizationUrl: 'https://example.com/device',
      tokenUrl: 'https://example.com/token',
      scopes: {}
    }
  }
]

for (const { field, location, toValue, expected } of readFields) {
  Deno.test(`v3-2 pending fields - ${field} is read into the IR`, () => {
    assertEquals(toValue(), expected)
    assertEquals(
      context.issues.filter(issue => issue.location === location),
      []
    )
  })
}

Deno.test('v3-2 pending fields - a content $ref into components.mediaTypes leaves no issue at its entry', () => {
  const entryLocation = `${petsContentLocation}:application/x-ndjson`
  assertEquals(
    context.issues.filter(
      issue => issue.location === entryLocation || issue.location.startsWith(`${entryLocation}:`)
    ),
    []
  )
})

Deno.test('v3-2 pending fields - path item query is an operation', () => {
  assert(result.type === 'oas')
  assertEquals(
    context.issues.find(issue => issue.location === 'TEST:paths:/pets:query'),
    undefined
  )
  assert(result.value.operations.some(({ method, path }) => method === 'query' && path === '/pets'))
})

Deno.test('v3-2 pending fields - additionalOperations is UNSUPPORTED_OPERATION_METHOD', () => {
  const warning = context.issues.find(
    issue => issue.location === 'TEST:paths:/pets:additionalOperations:COPY'
  )
  assertEquals(warning?.level, 'warning')
  assertEquals(warning?.type, 'UNSUPPORTED_OPERATION_METHOD')
  assertEquals(
    context.issues.find(issue => issue.location === 'TEST:paths:/pets:additionalOperations'),
    undefined
  )
})

Deno.test('v3-2 pending fields - querystring, cookie style and query operations parse', () => {
  assert(result.type === 'oas')
  const document = result.value

  const errors = context.issues.filter(issue => issue.level === 'error')
  assertEquals(errors, [])
  assertEquals(
    document.operations.map(operation => `${operation.method} ${operation.path}`),
    ['query /pets', 'get /pets', 'get /search', 'get /session']
  )
  assertEquals(Object.keys(document.components?.securitySchemes ?? {}), ['legacyKey', 'oauth'])
})

Deno.test('v3-2 pending fields - path-level querystring and cookie style parse', () => {
  const ok = { responses: { '200': { description: 'ok' } } }
  const querystring = {
    name: 'q',
    in: 'querystring',
    content: { 'application/x-www-form-urlencoded': { schema: { type: 'object' } } }
  }
  const cookieStyle = { name: 'id', in: 'cookie', style: 'cookie', schema: { type: 'string' } }

  const pathLevelContext = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        {
          openapi: '3.2.0',
          info: { title: 't', version: '0' },
          paths: {
            '/search': { parameters: [querystring], get: ok },
            '/session': { parameters: [cookieStyle], get: ok }
          },
          webhooks: {
            searched: { parameters: [querystring], post: ok },
            loggedIn: { parameters: [cookieStyle], post: ok }
          }
        },
        'path-level 3.2 parameters'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const pathLevelResult = pathLevelContext.parse(new StackTrail(['TEST']))

  assert(pathLevelResult.type === 'oas')
  assertEquals(
    pathLevelContext.issues.filter(issue => issue.level === 'error'),
    []
  )
  assertEquals(
    pathLevelResult.value.operations.map(operation => `${operation.method} ${operation.path}`),
    ['get /search', 'get /session']
  )
  assertEquals(
    pathLevelResult.value.webhooks.map(webhook => `${webhook.method} ${webhook.name}`),
    ['post searched', 'post loggedIn']
  )
})

Deno.test('v3-2 pending fields - an invalid path-level parameter skips only its path', () => {
  const ok = { responses: { '200': { description: 'ok' } } }
  const body = { name: 'payload', in: 'body', schema: { type: 'object' } }

  const pathLevelContext = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        {
          openapi: '3.2.0',
          info: { title: 't', version: '0' },
          paths: {
            '/upload': { parameters: [body], get: ok },
            '/other': { get: ok }
          },
          webhooks: {
            uploaded: { parameters: [body], post: ok },
            other: { post: ok }
          }
        },
        'invalid path-level parameter'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const pathLevelResult = pathLevelContext.parse(new StackTrail(['TEST']))

  assert(pathLevelResult.type === 'oas')
  const errors = pathLevelContext.issues.filter(issue => issue.level === 'error')
  assertEquals(
    errors.map(({ type, location }) => ({ type, location })),
    [
      { type: 'INVALID_OPERATION', location: 'TEST:paths:/upload' },
      { type: 'INVALID_OPERATION', location: 'TEST:webhooks:uploaded' }
    ]
  )
  assertEquals(
    pathLevelResult.value.operations.map(operation => `${operation.method} ${operation.path}`),
    ['get /other']
  )
  assertEquals(
    pathLevelResult.value.webhooks.map(webhook => `${webhook.method} ${webhook.name}`),
    ['post other']
  )
})
