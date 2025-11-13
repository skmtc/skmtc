import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerVariableV3, toServerVariablesV3, toOptionalServerVariablesV3 } from './toServerVariableV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasServerVariable } from './ServerVariable.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toServerVariableV3 - basic server variable with only default', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'v1'
  }
  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasServerVariable.default, 'v1')
  assertEquals(oasServerVariable.description, undefined)
  assertEquals(oasServerVariable.enums, undefined)
  assertEquals(oasServerVariable.oasType, 'serverVariable')
})

Deno.test('toServerVariableV3 - server variable with description and enums', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'api',
    description: 'API subdomain',
    enum: ['api', 'api-staging', 'api-dev']
  }
  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasServerVariable.default, 'api')
  assertEquals(oasServerVariable.description, 'API subdomain')
  assertEquals(oasServerVariable.enums, ['api', 'api-staging', 'api-dev'])
  assertEquals(oasServerVariable.oasType, 'serverVariable')
})

Deno.test('toServerVariableV3 - server variable with extension fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'prod',
    description: 'Environment',
    'x-internal': true,
    'x-region': 'us-east-1'
  } as any

  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasServerVariable.default, 'prod')
  assertEquals(oasServerVariable.description, 'Environment')
  assertEquals(oasServerVariable.extensionFields?.['x-internal'], true)
  assertEquals(oasServerVariable.extensionFields?.['x-region'], 'us-east-1')
})

Deno.test('toServerVariableV3 - server variable with all optional fields', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'v1',
    description: 'API version',
    enum: ['v1', 'v2', 'v3'],
    'x-custom': 'metadata'
  } as any

  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasServerVariable.default, 'v1')
  assertEquals(oasServerVariable.description, 'API version')
  assertEquals(oasServerVariable.enums, ['v1', 'v2', 'v3'])
  assertEquals(oasServerVariable.extensionFields?.['x-custom'], 'metadata')
})

Deno.test('toServerVariableV3 - extension fields are properly extracted', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'api',
    'x-field1': 'value1',
    'x-field2': { nested: 'value' }
  } as any

  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  // Extension fields should be extracted and stored separately
  assertEquals(oasServerVariable.extensionFields?.['x-field1'], 'value1')
  assertEquals(oasServerVariable.extensionFields?.['x-field2'], { nested: 'value' })
})

Deno.test('toServerVariablesV3 - converts empty object', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariables: Record<string, OpenAPIV3.ServerVariableObject> = {}

  const result = toServerVariablesV3({
    serverVariables,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {})
})

Deno.test('toServerVariablesV3 - converts single server variable', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariables: Record<string, OpenAPIV3.ServerVariableObject> = {
    version: {
      default: 'v1',
      description: 'API version',
      enum: ['v1', 'v2']
    }
  }

  const result = toServerVariablesV3({
    serverVariables,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(Object.keys(result).length, 1)
  assertEquals(result.version.default, 'v1')
  assertEquals(result.version.description, 'API version')
  assertEquals(result.version.enums, ['v1', 'v2'])
})

Deno.test('toServerVariablesV3 - converts multiple server variables', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariables: Record<string, OpenAPIV3.ServerVariableObject> = {
    environment: {
      default: 'prod',
      enum: ['prod', 'staging', 'dev']
    },
    version: {
      default: 'v1',
      enum: ['v1', 'v2']
    },
    region: {
      default: 'us-east-1',
      description: 'AWS region'
    }
  }

  const result = toServerVariablesV3({
    serverVariables,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(Object.keys(result).length, 3)
  assertEquals(result.environment.default, 'prod')
  assertEquals(result.version.default, 'v1')
  assertEquals(result.region.default, 'us-east-1')
  assertEquals(result.region.description, 'AWS region')
})

Deno.test('toOptionalServerVariablesV3 - returns undefined when input is undefined', () => {
  const stackTrail = new StackTrail(['TEST'])

  const result = toOptionalServerVariablesV3({
    serverVariables: undefined,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toOptionalServerVariablesV3 - converts when input is provided', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariables: Record<string, OpenAPIV3.ServerVariableObject> = {
    version: {
      default: 'v1'
    }
  }

  const result = toOptionalServerVariablesV3({
    serverVariables,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result !== undefined, true)
  assertEquals(result?.version.default, 'v1')
})
