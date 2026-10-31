import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerV3, toServersV3, toOptionalServersV3 } from './toServerV3.ts'
import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert'
import * as log from '@std/log'
import type { OasServer } from '@/oas/server/Server.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

Deno.test('toServerV3 - basic server with only url', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = { url: 'https://api.example.com' }
  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.url, 'https://api.example.com')
  assertEquals(oasServer.description, undefined)
  assertEquals(oasServer.variables, undefined)
  assertEquals(oasServer.oasType, 'server')
})

Deno.test('toServerV3 - server with description', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = {
    url: 'https://api.example.com/v1',
    description: 'Production API server'
  }
  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.url, 'https://api.example.com/v1')
  assertEquals(oasServer.description, 'Production API server')
  assertEquals(oasServer.oasType, 'server')
})

Deno.test('toServerV3 - server with variables', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = {
    url: 'https://{environment}.example.com',
    description: 'Configurable server',
    variables: {
      environment: {
        default: 'api',
        enum: ['api', 'staging', 'dev']
      }
    }
  }
  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.url, 'https://{environment}.example.com')
  assertEquals(oasServer.description, 'Configurable server')
  assertEquals(oasServer.variables !== undefined, true)
  assertEquals(oasServer.variables?.environment.default, 'api')
  assertEquals(oasServer.variables?.environment.enums, ['api', 'staging', 'dev'])
})

Deno.test('toServerV3 - server with extension fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = {
    url: 'https://api.example.com',
    description: 'API server',
    'x-internal': true,
    'x-region': 'us-east-1'
  } as any

  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.url, 'https://api.example.com')
  assertEquals(oasServer.description, 'API server')
  assertEquals(oasServer.extensionFields?.['x-internal'], true)
  assertEquals(oasServer.extensionFields?.['x-region'], 'us-east-1')
})

Deno.test('toServerV3 - server with all optional fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = {
    url: 'https://{environment}.example.com/{version}',
    description: 'Multi-environment API',
    variables: {
      environment: {
        default: 'prod',
        enum: ['prod', 'staging', 'dev']
      },
      version: {
        default: 'v1',
        enum: ['v1', 'v2']
      }
    },
    'x-custom': 'metadata'
  } as any

  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.url, 'https://{environment}.example.com/{version}')
  assertEquals(oasServer.description, 'Multi-environment API')
  assertEquals(oasServer.variables?.environment.default, 'prod')
  assertEquals(oasServer.variables?.version.default, 'v1')
  assertEquals(oasServer.extensionFields?.['x-custom'], 'metadata')
})

Deno.test('toServerV3 - extension fields are properly extracted', () => {
  const stackTrail = new StackTrail(['TEST'])
  const server: OpenAPIV3.ServerObject = {
    url: 'https://api.example.com',
    'x-field1': 'value1',
    'x-field2': { nested: 'value' }
  } as any

  const oasServer = toServerV3({ server, stackTrail, context: mockParseContext })

  assertEquals(oasServer.extensionFields?.['x-field1'], 'value1')
  assertEquals(oasServer.extensionFields?.['x-field2'], { nested: 'value' })
})

Deno.test('toServersV3 - converts empty array', () => {
  const stackTrail = new StackTrail(['TEST'])
  const servers: OpenAPIV3.ServerObject[] = []

  const result = toServersV3({ servers, stackTrail, context: mockParseContext })

  assertEquals(result, [])
})

Deno.test('toServersV3 - converts single server', () => {
  const stackTrail = new StackTrail(['TEST'])
  const servers: OpenAPIV3.ServerObject[] = [
    {
      url: 'https://api.example.com',
      description: 'Production server'
    }
  ]

  const result = toServersV3({ servers, stackTrail, context: mockParseContext })

  assertEquals(result.length, 1)
  assertEquals(result[0].url, 'https://api.example.com')
  assertEquals(result[0].description, 'Production server')
})

Deno.test('toServersV3 - converts multiple servers', () => {
  const stackTrail = new StackTrail(['TEST'])
  const servers: OpenAPIV3.ServerObject[] = [
    {
      url: 'https://api.example.com',
      description: 'Production server'
    },
    {
      url: 'https://staging.example.com',
      description: 'Staging server'
    },
    {
      url: 'https://dev.example.com',
      description: 'Development server'
    }
  ]

  const result = toServersV3({ servers, stackTrail, context: mockParseContext })

  assertEquals(result.length, 3)
  assertEquals(result[0].url, 'https://api.example.com')
  assertEquals(result[1].url, 'https://staging.example.com')
  assertEquals(result[2].url, 'https://dev.example.com')
  assertEquals(result[0].description, 'Production server')
  assertEquals(result[1].description, 'Staging server')
  assertEquals(result[2].description, 'Development server')
})

Deno.test('toOptionalServersV3 - returns undefined when input is undefined', () => {
  const stackTrail = new StackTrail(['TEST'])

  const result = toOptionalServersV3({
    servers: undefined,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toOptionalServersV3 - converts when input is provided', () => {
  const stackTrail = new StackTrail(['TEST'])
  const servers: OpenAPIV3.ServerObject[] = [
    {
      url: 'https://api.example.com'
    }
  ]

  const result = toOptionalServersV3({
    servers,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result !== undefined, true)
  assertEquals(result?.length, 1)
  assertEquals(result?.[0].url, 'https://api.example.com')
})

const ok = { responses: { '200': { description: 'ok' } } }

const parseDocument = (document: Record<string, unknown>) => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: toDocumentObject(
        {
          openapi: '3.1.0',
          info: { title: 't', version: '0' },
          paths: { '/pets': { get: ok } },
          ...document
        },
        '3.1 document'
      )
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  return {
    issues: context.issues.map(({ level, type, location }) => ({ level, type, location })),
    document: result.value
  }
}

const toUrls = (servers: OasServer[] | undefined) => servers?.map(({ url }) => url)

const invalidServer = (location: string) => ({
  level: 'error',
  type: 'INVALID_OPERATION',
  location
})

Deno.test('toServersV3 - a url that is an object is one issue at its index', () => {
  const { issues, document } = parseDocument({
    servers: [
      {
        url: {
          'Fn::Sub': 'https://{restapi-id}.execute-api.${AWS::Region}.amazonaws.com/{stageName}'
        }
      }
    ]
  })

  assertEquals(issues, [invalidServer('TEST:servers:0')])
  assertEquals(toUrls(document.servers), [])
  assertEquals(
    document.operations.map(({ path }) => path),
    ['/pets']
  )
})

Deno.test('toServersV3 - a null url is one issue at its index', () => {
  const { issues, document } = parseDocument({
    servers: [{ url: null, description: 'Generated server url' }]
  })

  assertEquals(issues, [invalidServer('TEST:servers:0')])
  assertEquals(toUrls(document.servers), [])
  assertEquals(
    document.operations.map(({ path }) => path),
    ['/pets']
  )
})

Deno.test('toServersV3 - string entries are one issue each at their index', () => {
  const { issues, document } = parseDocument({
    servers: ['https://api.doma.xyz', 'https://api-testnet.doma.xyz']
  })

  assertEquals(issues, [invalidServer('TEST:servers:0'), invalidServer('TEST:servers:1')])
  assertEquals(toUrls(document.servers), [])
  assertEquals(
    document.operations.map(({ path }) => path),
    ['/pets']
  )
})

Deno.test('toServersV3 - a null entry is one issue and the other servers parse', () => {
  const { issues, document } = parseDocument({
    servers: [{ url: 'https://www.telegram-finder.io' }, null]
  })

  assertEquals(issues, [invalidServer('TEST:servers:1')])
  assertEquals(toUrls(document.servers), ['https://www.telegram-finder.io'])
  assertEquals(
    document.operations.map(({ path }) => path),
    ['/pets']
  )
})

Deno.test('toServersV3 - a bad path-item server is one issue at its index', () => {
  const { issues, document } = parseDocument({
    paths: { '/pets': { servers: [null, { url: 'https://path.example.com' }], get: ok } }
  })

  assertEquals(issues, [invalidServer('TEST:paths:/pets:servers:0')])
  assertEquals(toUrls(document.operations[0].pathItem?.servers), ['https://path.example.com'])
})

Deno.test('toServersV3 - a bad operation server is one issue at its index', () => {
  const { issues, document } = parseDocument({
    paths: {
      '/pets': { get: { ...ok, servers: [{ url: 'https://op.example.com' }, 'https://x'] } }
    }
  })

  assertEquals(issues, [invalidServer('TEST:paths:/pets:get:servers:1')])
  assertEquals(toUrls(document.operations[0].servers), ['https://op.example.com'])
})

Deno.test('toServersV3 - a string url is not a trail frame', () => {
  const { issues } = parseDocument({
    servers: [{ url: 'https://api.example.com', unexpected: true }]
  })

  assertEquals(
    issues.map(({ location }) => location),
    ['TEST:servers:0:unexpected']
  )
})

Deno.test('toServersV3 - a link server is not checked by the servers entry guard', () => {
  const { issues, document } = parseDocument({
    paths: {
      '/pets': {
        get: {
          responses: {
            '200': {
              description: 'ok',
              links: { self: { operationId: 'getPets', server: { url: { 'Fn::Sub': 'x' } } } }
            }
          }
        }
      }
    }
  })

  assertEquals(issues, [])
  assertEquals(Object.keys(document.operations[0].responses), ['200'])
})
