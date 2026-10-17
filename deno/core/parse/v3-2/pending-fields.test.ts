import { assert, assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// The v3-2 tree does not read any 3.2-only field into the IR yet. Each one
// must surface as a skipped-field warning rather than crash the parse. One
// row per field in the 3.2 dialect table of `core/parse/README.md`; a
// follow-up that reads a field into the IR removes its row here.

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
                }
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
  {
    field: 'media type itemSchema',
    location: 'TEST:paths:/pets:get:responses:200:content:application/jsonl:itemSchema'
  },
  {
    field: 'media type prefixEncoding',
    location: 'TEST:paths:/pets:get:responses:200:content:multipart/mixed:prefixEncoding'
  },
  {
    field: 'media type itemEncoding',
    location: 'TEST:paths:/pets:get:responses:200:content:multipart/mixed:itemEncoding'
  },
  { field: 'components.mediaTypes', location: 'TEST:components:mediaTypes' },
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
  },
  {
    field: 'security scheme deprecated',
    location: 'TEST:components:securitySchemes:legacyKey:deprecated'
  },
  {
    field: 'security scheme oauth2MetadataUrl',
    location: 'TEST:components:securitySchemes:oauth:oauth2MetadataUrl'
  },
  {
    field: 'OAuth flow deviceAuthorization',
    location: 'TEST:components:securitySchemes:oauth:flows:deviceAuthorization'
  }
]

const parse = () => {
  const context = new ParseContext({
    input: { type: 'oas', value: documentObject },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')
  return { context, document: result.value }
}

for (const { field, location } of pendingFields) {
  Deno.test(`v3-2 pending fields - ${field} is a skipped-field warning`, () => {
    const { context } = parse()

    const warning = context.issues.find(issue => issue.location === location)
    assertEquals(warning?.level, 'warning')
    assertEquals(warning?.type, 'UNEXPECTED_PROPERTY')
  })
}

Deno.test('v3-2 pending fields - only querystring and cookie style drop an operation', () => {
  // Known exceptions, left for the operations follow-up: `in: querystring`
  // and `style: cookie` fail the parameter's `v.parse`, which drops the
  // operation. Every other path and component still parses.
  const { context, document } = parse()

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
