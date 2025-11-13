import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasServer } from './Server.ts'
import { OasServerVariable } from '../serverVariable/ServerVariable.ts'

// Helper to create a mock server variable for testing
const createServerVariable = (defaultValue: string, enums?: string[]): OasServerVariable => {
  return new OasServerVariable({
    default: defaultValue,
    enums
  })
}

Deno.test('OasServer - constructor with only required field (url)', () => {
  const server = new OasServer({
    url: 'https://api.example.com'
  })

  assertEquals(server.oasType, 'server')
  assertEquals(server.url, 'https://api.example.com')
  assertEquals(server.description, undefined)
  assertEquals(server.variables, undefined)
  assertEquals(server.extensionFields, undefined)
})

Deno.test('OasServer - constructor with description field', () => {
  const server = new OasServer({
    url: 'https://api.example.com/v1',
    description: 'Production API server'
  })

  assertEquals(server.url, 'https://api.example.com/v1')
  assertEquals(server.description, 'Production API server')
  assertEquals(server.variables, undefined)
  assertEquals(server.extensionFields, undefined)
})

Deno.test('OasServer - constructor with single variable', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com',
    variables: {
      environment: createServerVariable('api', ['api', 'staging', 'dev'])
    }
  })

  assertEquals(server.url, 'https://{environment}.example.com')
  assertEquals(server.variables !== undefined, true)
  assertEquals(server.variables?.environment.default, 'api')
  assertEquals(server.description, undefined)
  assertEquals(server.extensionFields, undefined)
})

Deno.test('OasServer - constructor with multiple variables', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com/{version}',
    variables: {
      environment: createServerVariable('api', ['api', 'staging']),
      version: createServerVariable('v1', ['v1', 'v2'])
    }
  })

  assertEquals(server.url, 'https://{environment}.example.com/{version}')
  assertEquals(Object.keys(server.variables || {}).length, 2)
  assertEquals(server.variables?.environment.default, 'api')
  assertEquals(server.variables?.version.default, 'v1')
})

Deno.test('OasServer - constructor with extensionFields', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    extensionFields: {
      'x-internal': true,
      'x-region': 'us-east-1'
    }
  })

  assertEquals(server.url, 'https://api.example.com')
  assertEquals(server.extensionFields, {
    'x-internal': true,
    'x-region': 'us-east-1'
  })
  assertEquals(server.description, undefined)
  assertEquals(server.variables, undefined)
})

Deno.test('OasServer - constructor with all fields', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com/{version}',
    description: 'Configurable API server',
    variables: {
      environment: createServerVariable('api', ['api', 'staging']),
      version: createServerVariable('v1')
    },
    extensionFields: { 'x-custom': 'value' }
  })

  assertEquals(server.url, 'https://{environment}.example.com/{version}')
  assertEquals(server.description, 'Configurable API server')
  assertEquals(Object.keys(server.variables || {}).length, 2)
  assertEquals(server.extensionFields, { 'x-custom': 'value' })
  assertEquals(server.oasType, 'server')
})

Deno.test('OasServer - oasType property is always "server"', () => {
  const server1 = new OasServer({ url: 'https://api1.example.com' })
  const server2 = new OasServer({ url: 'https://api2.example.com', description: 'Test' })
  const server3 = new OasServer({
    url: 'https://api3.example.com',
    variables: { env: createServerVariable('prod') }
  })

  assertEquals(server1.oasType, 'server')
  assertEquals(server2.oasType, 'server')
  assertEquals(server3.oasType, 'server')
})

Deno.test('OasServer - isRef() always returns false', () => {
  const server1 = new OasServer({ url: 'https://api.example.com' })
  const server2 = new OasServer({ url: 'https://api.example.com', description: 'Test' })
  const server3 = new OasServer({
    url: 'https://api.example.com',
    variables: { env: createServerVariable('prod') }
  })

  assertEquals(server1.isRef(), false)
  assertEquals(server2.isRef(), false)
  assertEquals(server3.isRef(), false)
})

Deno.test('OasServer - resolve() returns itself', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    description: 'Test server'
  })
  const resolved = server.resolve()

  assertStrictEquals(resolved, server)
  assertEquals(resolved.url, 'https://api.example.com')
  assertEquals(resolved.description, 'Test server')
})

Deno.test('OasServer - resolveOnce() returns itself', () => {
  const server = new OasServer({
    url: 'https://api.example.com/v1',
    variables: { env: createServerVariable('prod') }
  })
  const resolved = server.resolveOnce()

  assertStrictEquals(resolved, server)
  assertEquals(resolved.url, 'https://api.example.com/v1')
  assertEquals(resolved.variables?.env.default, 'prod')
})

Deno.test('OasServer - toJsonSchema() with minimal fields (only url)', () => {
  const server = new OasServer({
    url: 'https://api.example.com'
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: undefined,
    url: 'https://api.example.com',
    variables: undefined
  })
})

Deno.test('OasServer - toJsonSchema() with description', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    description: 'Production API'
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: 'Production API',
    url: 'https://api.example.com',
    variables: undefined
  })
})

Deno.test('OasServer - toJsonSchema() with variables', () => {
  const envVar = createServerVariable('api', ['api', 'staging'])
  const server = new OasServer({
    url: 'https://{environment}.example.com',
    variables: {
      environment: envVar
    }
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertEquals(jsonSchema.url, 'https://{environment}.example.com')
  assertEquals(jsonSchema.variables?.environment, envVar)
})

Deno.test('OasServer - toJsonSchema() with all fields', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com/{version}',
    description: 'Configurable server',
    variables: {
      environment: createServerVariable('api'),
      version: createServerVariable('v1')
    },
    extensionFields: { 'x-custom': 'value' }
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertEquals(jsonSchema.description, 'Configurable server')
  assertEquals(jsonSchema.url, 'https://{environment}.example.com/{version}')
  assertEquals(Object.keys(jsonSchema.variables || {}).length, 2)
})

Deno.test('OasServer - toJsonSchema() excludes extensionFields', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    extensionFields: {
      'x-internal': true,
      'x-custom': 'should not appear'
    }
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertEquals(jsonSchema.hasOwnProperty('extensionFields'), false)
  assertEquals((jsonSchema as any)['x-internal'], undefined)
  assertEquals((jsonSchema as any)['x-custom'], undefined)
  assertEquals(Object.keys(jsonSchema).length, 3)
})

Deno.test('OasServer - toJsonSchema() preserves variables as-is', () => {
  const envVar = createServerVariable('prod', ['prod', 'staging', 'dev'])
  const server = new OasServer({
    url: 'https://{environment}.example.com',
    variables: {
      environment: envVar
    }
  })

  const jsonSchema = server.toJsonSchema({} as any)

  assertStrictEquals(jsonSchema.variables?.environment, envVar)
})

Deno.test('OasServer - empty variables object', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    variables: {}
  })

  assertEquals(server.variables, {})
  assertEquals(server.toJsonSchema({} as any).variables, {})
})

Deno.test('OasServer - empty extensionFields object', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    extensionFields: {}
  })

  assertEquals(server.extensionFields, {})
})

Deno.test('OasServer - multiple instances are independent', () => {
  const server1 = new OasServer({
    url: 'https://api1.example.com',
    description: 'Server 1'
  })
  const server2 = new OasServer({
    url: 'https://api2.example.com',
    description: 'Server 2'
  })

  assertEquals(server1 !== server2, true)
  assertEquals(server1.url, 'https://api1.example.com')
  assertEquals(server2.url, 'https://api2.example.com')
  assertEquals(server1.description, 'Server 1')
  assertEquals(server2.description, 'Server 2')
})

Deno.test('OasServer - various URL formats', () => {
  const httpServer = new OasServer({ url: 'http://api.example.com' })
  const httpsServer = new OasServer({ url: 'https://api.example.com' })
  const withPath = new OasServer({ url: 'https://api.example.com/v1/users' })
  const withPort = new OasServer({ url: 'https://api.example.com:8080' })
  const withTemplate = new OasServer({ url: 'https://{subdomain}.example.com/{version}' })

  assertEquals(httpServer.url, 'http://api.example.com')
  assertEquals(httpsServer.url, 'https://api.example.com')
  assertEquals(withPath.url, 'https://api.example.com/v1/users')
  assertEquals(withPort.url, 'https://api.example.com:8080')
  assertEquals(withTemplate.url, 'https://{subdomain}.example.com/{version}')
})

Deno.test('OasServer - URL with variable placeholders matches variables', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com/{version}',
    variables: {
      environment: createServerVariable('api', ['api', 'staging', 'dev']),
      version: createServerVariable('v1', ['v1', 'v2', 'v3'])
    }
  })

  assertEquals(server.url.includes('{environment}'), true)
  assertEquals(server.url.includes('{version}'), true)
  assertEquals(server.variables?.environment !== undefined, true)
  assertEquals(server.variables?.version !== undefined, true)
})

Deno.test('OasServer - extensionFields stores custom properties', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    extensionFields: {
      'x-internal': true,
      'x-region': 'us-east-1',
      'x-metadata': { key: 'value' }
    }
  })

  assertEquals(server.extensionFields, {
    'x-internal': true,
    'x-region': 'us-east-1',
    'x-metadata': { key: 'value' }
  })
})

Deno.test('OasServer - extensionFields supports various value types', () => {
  const server = new OasServer({
    url: 'https://api.example.com',
    extensionFields: {
      'x-string': 'text',
      'x-number': 42,
      'x-boolean': true,
      'x-array': [1, 2, 3],
      'x-object': { nested: 'value' },
      'x-null': null
    }
  })

  assertEquals(server.extensionFields?.['x-string'], 'text')
  assertEquals(server.extensionFields?.['x-number'], 42)
  assertEquals(server.extensionFields?.['x-boolean'], true)
  assertEquals(server.extensionFields?.['x-array'], [1, 2, 3])
  assertEquals(server.extensionFields?.['x-object'], { nested: 'value' })
  assertEquals(server.extensionFields?.['x-null'], null)
})

Deno.test('OasServer - typical production server', () => {
  const server = new OasServer({
    url: 'https://api.example.com/v1',
    description: 'Production API server'
  })

  assertEquals(server.url, 'https://api.example.com/v1')
  assertEquals(server.description, 'Production API server')
  assertEquals(server.oasType, 'server')

  const jsonSchema = server.toJsonSchema({} as any)
  assertEquals(jsonSchema.url, 'https://api.example.com/v1')
  assertEquals(jsonSchema.description, 'Production API server')
})

Deno.test('OasServer - multi-environment server with variables', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com',
    description: 'Multi-environment API',
    variables: {
      environment: createServerVariable('prod', ['prod', 'staging', 'dev'])
    }
  })

  assertEquals(server.url, 'https://{environment}.example.com')
  assertEquals(server.description, 'Multi-environment API')
  assertEquals(server.variables?.environment.default, 'prod')
  assertEquals(server.variables?.environment.enums, ['prod', 'staging', 'dev'])

  const jsonSchema = server.toJsonSchema({} as any)
  assertEquals(jsonSchema.url, 'https://{environment}.example.com')
  assertEquals(jsonSchema.variables?.environment.default, 'prod')
})

Deno.test('OasServer - server with URL templating for environment and version', () => {
  const server = new OasServer({
    url: 'https://{environment}.example.com/{version}',
    description: 'Configurable API server',
    variables: {
      environment: createServerVariable('api', ['api', 'api-staging', 'api-dev']),
      version: createServerVariable('v1', ['v1', 'v2', 'v3'])
    }
  })

  assertEquals(server.url, 'https://{environment}.example.com/{version}')
  assertEquals(server.description, 'Configurable API server')
  assertEquals(server.variables?.environment.default, 'api')
  assertEquals(server.variables?.version.default, 'v1')

  const jsonSchema = server.toJsonSchema({} as any)
  assertEquals(jsonSchema.description, 'Configurable API server')
  assertEquals(jsonSchema.url, 'https://{environment}.example.com/{version}')
  assertEquals((jsonSchema.variables as any)?.environment.enums, ['api', 'api-staging', 'api-dev'])
  assertEquals((jsonSchema.variables as any)?.version.enums, ['v1', 'v2', 'v3'])
})
