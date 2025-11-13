import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasServerVariable } from './ServerVariable.ts'

Deno.test('OasServerVariable - constructor with only required field (default)', () => {
  const serverVar = new OasServerVariable({
    default: 'v1'
  })

  assertEquals(serverVar.oasType, 'serverVariable')
  assertEquals(serverVar.default, 'v1')
  assertEquals(serverVar.description, undefined)
  assertEquals(serverVar.enums, undefined)
  assertEquals(serverVar.extensionFields, undefined)
})

Deno.test('OasServerVariable - constructor with description field', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    description: 'API subdomain for the service'
  })

  assertEquals(serverVar.default, 'api')
  assertEquals(serverVar.description, 'API subdomain for the service')
  assertEquals(serverVar.enums, undefined)
  assertEquals(serverVar.extensionFields, undefined)
})

Deno.test('OasServerVariable - constructor with enums field', () => {
  const serverVar = new OasServerVariable({
    default: 'v1',
    enums: ['v1', 'v2', 'v3']
  })

  assertEquals(serverVar.default, 'v1')
  assertEquals(serverVar.enums, ['v1', 'v2', 'v3'])
  assertEquals(serverVar.description, undefined)
  assertEquals(serverVar.extensionFields, undefined)
})

Deno.test('OasServerVariable - constructor with extensionFields', () => {
  const serverVar = new OasServerVariable({
    default: 'prod',
    extensionFields: {
      'x-internal': true,
      'x-region': 'us-east-1'
    }
  })

  assertEquals(serverVar.default, 'prod')
  assertEquals(serverVar.extensionFields, {
    'x-internal': true,
    'x-region': 'us-east-1'
  })
  assertEquals(serverVar.description, undefined)
  assertEquals(serverVar.enums, undefined)
})

Deno.test('OasServerVariable - constructor with all fields', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    description: 'API subdomain',
    enums: ['api', 'api-staging', 'api-dev'],
    extensionFields: { 'x-custom': 'value' }
  })

  assertEquals(serverVar.default, 'api')
  assertEquals(serverVar.description, 'API subdomain')
  assertEquals(serverVar.enums, ['api', 'api-staging', 'api-dev'])
  assertEquals(serverVar.extensionFields, { 'x-custom': 'value' })
  assertEquals(serverVar.oasType, 'serverVariable')
})

Deno.test('OasServerVariable - oasType property is always "serverVariable"', () => {
  const serverVar1 = new OasServerVariable({ default: 'v1' })
  const serverVar2 = new OasServerVariable({ default: 'v2', description: 'Test' })
  const serverVar3 = new OasServerVariable({ default: 'v3', enums: ['v3', 'v4'] })

  assertEquals(serverVar1.oasType, 'serverVariable')
  assertEquals(serverVar2.oasType, 'serverVariable')
  assertEquals(serverVar3.oasType, 'serverVariable')
})

Deno.test('OasServerVariable - isRef() always returns false', () => {
  const serverVar1 = new OasServerVariable({ default: 'v1' })
  const serverVar2 = new OasServerVariable({ default: 'v2', description: 'Test' })
  const serverVar3 = new OasServerVariable({ default: 'v3', enums: ['v3'] })

  assertEquals(serverVar1.isRef(), false)
  assertEquals(serverVar2.isRef(), false)
  assertEquals(serverVar3.isRef(), false)
})

Deno.test('OasServerVariable - resolve() returns itself', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    description: 'Test'
  })
  const resolved = serverVar.resolve()

  assertStrictEquals(resolved, serverVar)
  assertEquals(resolved.default, 'api')
  assertEquals(resolved.description, 'Test')
})

Deno.test('OasServerVariable - resolveOnce() returns itself', () => {
  const serverVar = new OasServerVariable({
    default: 'prod',
    enums: ['prod', 'staging']
  })
  const resolved = serverVar.resolveOnce()

  assertStrictEquals(resolved, serverVar)
  assertEquals(resolved.default, 'prod')
  assertEquals(resolved.enums, ['prod', 'staging'])
})

Deno.test('OasServerVariable - toJsonSchema() with minimal fields (only default)', () => {
  const serverVar = new OasServerVariable({
    default: 'v1'
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: undefined,
    default: 'v1',
    enum: undefined
  })
})

Deno.test('OasServerVariable - toJsonSchema() with description', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    description: 'API subdomain'
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: 'API subdomain',
    default: 'api',
    enum: undefined
  })
})

Deno.test('OasServerVariable - toJsonSchema() with enums array', () => {
  const serverVar = new OasServerVariable({
    default: 'v1',
    enums: ['v1', 'v2', 'v3']
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: undefined,
    default: 'v1',
    enum: ['v1', 'v2', 'v3']
  })
})

Deno.test('OasServerVariable - toJsonSchema() with all fields', () => {
  const serverVar = new OasServerVariable({
    default: 'prod',
    description: 'Environment',
    enums: ['prod', 'staging', 'dev'],
    extensionFields: { 'x-custom': 'value' }
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  assertEquals(jsonSchema, {
    description: 'Environment',
    default: 'prod',
    enum: ['prod', 'staging', 'dev']
  })
})

Deno.test('OasServerVariable - toJsonSchema() maps enums to enum property', () => {
  const serverVar = new OasServerVariable({
    default: 'v1',
    enums: ['v1', 'v2']
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  // The class property is 'enums' but JSON schema property is 'enum'
  assertEquals(jsonSchema.enum, ['v1', 'v2'])
  assertEquals((jsonSchema as any).enums, undefined)
})

Deno.test('OasServerVariable - toJsonSchema() excludes extensionFields', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    extensionFields: {
      'x-internal': true,
      'x-custom': 'should not appear'
    }
  })

  const jsonSchema = serverVar.toJsonSchema({} as any)

  assertEquals(jsonSchema.hasOwnProperty('extensionFields'), false)
  assertEquals((jsonSchema as any)['x-internal'], undefined)
  assertEquals((jsonSchema as any)['x-custom'], undefined)
  assertEquals(Object.keys(jsonSchema).length, 3) // Only description, default, enum
})

Deno.test('OasServerVariable - empty enums array', () => {
  const serverVar = new OasServerVariable({
    default: 'v1',
    enums: []
  })

  assertEquals(serverVar.enums, [])
  assertEquals(serverVar.toJsonSchema({} as any).enum, [])
})

Deno.test('OasServerVariable - empty extensionFields object', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    extensionFields: {}
  })

  assertEquals(serverVar.extensionFields, {})
})

Deno.test('OasServerVariable - multiple instances are independent', () => {
  const serverVar1 = new OasServerVariable({
    default: 'v1',
    description: 'Version 1'
  })
  const serverVar2 = new OasServerVariable({
    default: 'v2',
    description: 'Version 2'
  })

  assertEquals(serverVar1 !== serverVar2, true)
  assertEquals(serverVar1.default, 'v1')
  assertEquals(serverVar2.default, 'v2')
  assertEquals(serverVar1.description, 'Version 1')
  assertEquals(serverVar2.description, 'Version 2')
})

Deno.test('OasServerVariable - default value can be any string', () => {
  const emptyDefault = new OasServerVariable({ default: '' })
  const specialChars = new OasServerVariable({ default: 'v1.2.3-beta' })
  const withSlash = new OasServerVariable({ default: 'api/v1' })

  assertEquals(emptyDefault.default, '')
  assertEquals(specialChars.default, 'v1.2.3-beta')
  assertEquals(withSlash.default, 'api/v1')
})

Deno.test('OasServerVariable - extensionFields stores custom properties', () => {
  const serverVar = new OasServerVariable({
    default: 'prod',
    extensionFields: {
      'x-internal': true,
      'x-region': 'us-east-1',
      'x-metadata': { key: 'value' }
    }
  })

  assertEquals(serverVar.extensionFields, {
    'x-internal': true,
    'x-region': 'us-east-1',
    'x-metadata': { key: 'value' }
  })
})

Deno.test('OasServerVariable - extensionFields supports various value types', () => {
  const serverVar = new OasServerVariable({
    default: 'api',
    extensionFields: {
      'x-string': 'text',
      'x-number': 42,
      'x-boolean': true,
      'x-array': [1, 2, 3],
      'x-object': { nested: 'value' },
      'x-null': null
    }
  })

  assertEquals(serverVar.extensionFields?.['x-string'], 'text')
  assertEquals(serverVar.extensionFields?.['x-number'], 42)
  assertEquals(serverVar.extensionFields?.['x-boolean'], true)
  assertEquals(serverVar.extensionFields?.['x-array'], [1, 2, 3])
  assertEquals(serverVar.extensionFields?.['x-object'], { nested: 'value' })
  assertEquals(serverVar.extensionFields?.['x-null'], null)
})

Deno.test('OasServerVariable - typical usage for environment selection', () => {
  const environment = new OasServerVariable({
    default: 'prod',
    description: 'Environment for the API server',
    enums: ['prod', 'staging', 'dev']
  })

  assertEquals(environment.default, 'prod')
  assertEquals(environment.description, 'Environment for the API server')
  assertEquals(environment.enums, ['prod', 'staging', 'dev'])
  assertEquals(environment.oasType, 'serverVariable')

  const jsonSchema = environment.toJsonSchema({} as any)
  assertEquals(jsonSchema.default, 'prod')
  assertEquals(jsonSchema.enum, ['prod', 'staging', 'dev'])
})

Deno.test('OasServerVariable - typical usage for API versioning', () => {
  const version = new OasServerVariable({
    default: 'v1',
    description: 'API version',
    enums: ['v1', 'v2', 'v3']
  })

  assertEquals(version.default, 'v1')
  assertEquals(version.description, 'API version')
  assertEquals(version.enums, ['v1', 'v2', 'v3'])

  // Verify toJsonSchema works correctly
  const jsonSchema = version.toJsonSchema({} as any)
  assertEquals(jsonSchema.description, 'API version')
  assertEquals(jsonSchema.default, 'v1')
  assertEquals(jsonSchema.enum, ['v1', 'v2', 'v3'])
})
