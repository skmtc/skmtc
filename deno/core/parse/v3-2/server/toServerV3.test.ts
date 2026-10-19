import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerV3, toServersV3, toOptionalServersV3 } from './toServerV3.ts'
import { assertEquals } from '@std/assert/equals'
import type { OasServer } from '@/oas/server/Server.ts'
import { StackTrail } from '@/context/StackTrail.ts'

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
