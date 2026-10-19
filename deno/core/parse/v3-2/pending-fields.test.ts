import { assert, assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// Each 3.2-only field the v3-2 tree does not read into the IR yet must
// surface as a skipped-field warning rather than crash the parse. One row
// per pending field in the 3.2 dialect table of `core/parse/README.md`; a
// follow-up that reads a field into the IR replaces its row with a positive
// assertion below.

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

const pendingFields: Array<{ field: string; location: string }> = [
  { field: '$self', location: 'TEST:$self' },
  { field: 'path item query', location: 'TEST:paths:/pets:query' },
  { field: 'additionalOperations', location: 'TEST:paths:/pets:additionalOperations' },
  { field: 'response summary', location: 'TEST:paths:/pets:get:responses:200:summary' },
  {
    field: 'example dataValue',
    location:
      'TEST:paths:/pets:get:responses:200:content:application/jsonl:examples:examples:one:dataValue'
  },
  {
    field: 'example serializedValue',
    location:
      'TEST:paths:/pets:get:responses:200:content:application/jsonl:examples:examples:one:serializedValue'
  },
  { field: 'tag parent', location: 'TEST:tags:parent' },
  { field: 'tag kind', location: 'TEST:tags:kind' },
  { field: 'tag summary', location: 'TEST:tags:summary' },
  { field: 'server name', location: 'TEST:servers:https%3A//api.example.com:name' },
  {
    field: 'discriminator defaultMapping',
    location: 'TEST:components:schemas:Pet:oneOf:discriminator:defaultMapping'
  }
]

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

const issuesAt = (location: string) =>
  context.issues.filter(
    issue => issue.location === location || issue.location.startsWith(`${location}:`)
  )

const toPetsContent = () => {
  assert(result.type === 'oas')
  const operation = result.value.operations.find(({ path }) => path === '/pets')
  const response = operation?.responses['200']?.resolve()
  assert(response?.content)
  return response.content
}

const toSecurityScheme = (name: string) => {
  assert(result.type === 'oas')
  return result.value.components?.securitySchemes?.[name]?.resolve()
}

const petsContentLocation = 'TEST:paths:/pets:get:responses:200:content'

const resolvedFields: Array<{ field: string; location: string; assertIr: () => void }> = [
  {
    field: 'media type itemSchema',
    location: `${petsContentLocation}:text/event-stream:itemSchema`,
    assertIr: () => {
      assertEquals(toPetsContent()['text/event-stream']?.itemSchema?.type, 'string')
    }
  },
  {
    field: 'media type prefixEncoding',
    location: `${petsContentLocation}:multipart/mixed:prefixEncoding`,
    assertIr: () => {
      assertEquals(toPetsContent()['multipart/mixed']?.prefixEncoding, [
        { contentType: 'text/plain' }
      ])
    }
  },
  {
    field: 'media type itemEncoding',
    location: `${petsContentLocation}:multipart/mixed:itemEncoding`,
    assertIr: () => {
      assertEquals(toPetsContent()['multipart/mixed']?.itemEncoding, { contentType: 'text/plain' })
    }
  },
  {
    field: 'components.mediaTypes',
    location: 'TEST:components:mediaTypes',
    assertIr: () => {
      // Not stored on the components; resolved into the content entry that
      // references it.
      assertEquals(toPetsContent()['application/x-ndjson']?.itemSchema?.type, 'string')
      assertEquals(issuesAt(`${petsContentLocation}:application/x-ndjson`), [])
    }
  },
  {
    field: 'security scheme deprecated',
    location: 'TEST:components:securitySchemes:legacyKey:deprecated',
    assertIr: () => {
      assertEquals(toSecurityScheme('legacyKey')?.deprecated, true)
    }
  },
  {
    field: 'security scheme oauth2MetadataUrl',
    location: 'TEST:components:securitySchemes:oauth:oauth2MetadataUrl',
    assertIr: () => {
      const scheme = toSecurityScheme('oauth')
      assert(scheme?.type === 'oauth2')
      assertEquals(
        scheme.oauth2MetadataUrl,
        'https://example.com/.well-known/oauth-authorization-server'
      )
    }
  },
  {
    field: 'OAuth flow deviceAuthorization',
    location: 'TEST:components:securitySchemes:oauth:flows:deviceAuthorization',
    assertIr: () => {
      const scheme = toSecurityScheme('oauth')
      assert(scheme?.type === 'oauth2')
      assertEquals(scheme.flows.deviceAuthorization, {
        deviceAuthorizationUrl: 'https://example.com/device',
        tokenUrl: 'https://example.com/token',
        scopes: {}
      })
    }
  }
]

for (const { field, location, assertIr } of resolvedFields) {
  Deno.test(`v3-2 pending fields - ${field} is on the IR with no warning`, () => {
    assertIr()
    assertEquals(issuesAt(location), [])
  })
}

Deno.test('v3-2 pending fields - only querystring and cookie style drop an operation', () => {
  // Known exceptions, left for the operations follow-up: `in: querystring`
  // and `style: cookie` fail the parameter's `v.parse`, which drops the
  // operation. Every other path and component still parses.
  assert(result.type === 'oas')
  const document = result.value

  const errors = context.issues.filter(issue => issue.level === 'error')
  assertEquals(
    errors.map(({ type, location }) => ({ type, location })),
    [
      { type: 'INVALID_OPERATION', location: 'TEST:paths:/search:get:get' },
      { type: 'INVALID_OPERATION', location: 'TEST:paths:/session:get:get' }
    ]
  )
  assertEquals(
    document.operations.map(operation => `${operation.method} ${operation.path}`),
    ['get /pets']
  )
  assertEquals(Object.keys(document.components?.securitySchemes ?? {}), ['legacyKey', 'oauth'])
})

Deno.test('v3-2 pending fields - path-level querystring and cookie style skip only their path', () => {
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
            '/session': { parameters: [cookieStyle], get: ok },
            '/other': { get: ok }
          },
          webhooks: {
            searched: { parameters: [querystring], post: ok },
            loggedIn: { parameters: [cookieStyle], post: ok },
            other: { post: ok }
          }
        },
        'path-level pending fields'
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
      { type: 'INVALID_OPERATION', location: 'TEST:paths:/search' },
      { type: 'INVALID_OPERATION', location: 'TEST:paths:/session' },
      { type: 'INVALID_OPERATION', location: 'TEST:webhooks:searched' },
      { type: 'INVALID_OPERATION', location: 'TEST:webhooks:loggedIn' }
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
