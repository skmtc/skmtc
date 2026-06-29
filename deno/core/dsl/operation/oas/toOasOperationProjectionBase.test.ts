import { toOasOperationProjectionBase } from './toOasOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { TsSnippet, createVariable } from '@skmtc/lang-typescript'
import type {
  ToOasOperationIdentifierNameArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import * as v from 'valibot'

/**
 * The all-undefined enrichment umbrella a no-enrichment generator's
 * `toEnrichments` resolves to (parsed through `emptyEnrichmentSchema`).
 * The pure `toIdentifierName` / `toExportPath` statics receive this when
 * the projection declares no enrichments.
 */
const emptyEnrichments: Enrichments = {
  subject: undefined,
  generator: undefined,
  stack: undefined
}

Deno.test('toOasOperationProjectionBase - returns a class constructor', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toOasOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'typescript-operations',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(OperationClass.id, 'typescript-operations')
})

Deno.test('toOasOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(OperationClass.type, 'oasOperation')
})

Deno.test('toOasOperationProjectionBase - sets static toIdentifierName from config', () => {
  const identifierNameFn = ({ operation }: ToOasOperationIdentifierNameArgs<Enrichments>) =>
    operation.operationId || 'operation'

  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: identifierNameFn,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const name = OperationClass.toIdentifierName({ operation: mockOperation, enrichments: emptyEnrichments, variant: 'main' })
  assertEquals(name, 'getUsers')
  assertEquals(OperationClass.toIdentifierType(mockOperation, {} as GenerateContextType).type, 'variable')
})

Deno.test('toOasOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToOasOperationExportPathArgs<Enrichments>) =>
    `./generated/${operation.operationId}.ts`

  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: exportPathFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'post',
    pathItem: undefined,
    operationId: 'createUser',
    responses: {}
  })

  const exportPath = OperationClass.toExportPath({ operation: mockOperation, enrichments: emptyEnrichments, variant: 'main' })
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test('toOasOperationProjectionBase - toEnrichments returns an all-undefined umbrella for the empty schema', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
})

Deno.test('toOasOperationProjectionBase - toEnrichments returns an all-undefined umbrella when no enrichments in context', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
})

Deno.test('toOasOperationProjectionBase - toIdentifierName works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => `${operation.method}${operation.operationId}`,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'Users',
    responses: {}
  })
  const getUsersName = OperationClass.toIdentifierName({ operation: getUsersOperation, enrichments: emptyEnrichments, variant: 'main' })
  assertEquals(getUsersName, 'getUsers')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'Product',
    responses: {}
  })
  const createProductName = OperationClass.toIdentifierName({ operation: createProductOperation, enrichments: emptyEnrichments, variant: 'main' })
  assertEquals(createProductName, 'postProduct')
})

Deno.test('toOasOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./types/${operation.method}-${operation.operationId}.d.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'users',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath({ operation: getUsersOperation, enrichments: emptyEnrichments, variant: 'main' }), './types/get-users.d.ts')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'product',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath({ operation: createProductOperation, enrichments: emptyEnrichments, variant: 'main' }), './types/post-product.d.ts')
})

Deno.test('toOasOperationProjectionBase - constructor creates correct generatorKey', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'api-client',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const mockContext = {} as GenerateContextType

  const instance = new OperationClass({
    context: mockContext,
    operation: mockOperation,
    settings: {
      identifier: createVariable('getUsers'),
      exportPath: './operations/users.ts',
      enrichments: undefined,
      variant: 'main'
    } as any
  })

  // Verify generatorKey has expected format: id|path|method|variant
  assertEquals(instance.generatorKey, 'api-client|/users|get|main')
})

Deno.test('toOasOperationProjectionBase - instance is OasOperationProjectionBase', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'createProduct',
    responses: {}
  })

  const mockContext = {} as GenerateContextType

  const instance = new OperationClass({
    context: mockContext,
    operation: mockOperation,
    settings: {
      identifier: createVariable('createProduct'),
      exportPath: './operations/products.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof TsSnippet, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toOasOperationProjectionBase - toEnrichments validates with schema', () => {
  const OperationClass = toOasOperationProjectionBase<{
    subject?: { enabled: boolean; timeout?: number }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'api-client',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(
          v.object({
            enabled: v.boolean(),
            timeout: v.optional(v.number())
          })
        ),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const mockContext = {
    settings: {
      enrichments: {
        'api-client': {
          '/users': {
            get: {
              main: {
                enabled: true,
                timeout: 5000
              }
            }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext,
    variant: 'main'
  })

  assertEquals(enrichments.subject, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toOasOperationProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toOasOperationProjectionBase<{
    subject?: { customValue: string; flag: boolean }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'rest-api',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(
          v.object({
            customValue: v.string(),
            flag: v.boolean()
          })
        ),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockOperation = new OasOperation({
    path: '/products/{id}',
    method: 'put',
    pathItem: undefined,
    operationId: 'updateProduct',
    responses: {}
  })

  // Place enrichments at the specific nested path that should be retrieved
  const mockContext = {
    settings: {
      enrichments: {
        'rest-api': {
          '/products/{id}': {
            put: { main: { customValue: 'found-it', flag: true } }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext,
    variant: 'main'
  })

  // Retrieves the subject from enrichments.{id}.{path}.{method}.{variant}
  assertEquals(enrichments.subject, { customValue: 'found-it', flag: true })
})

Deno.test('toOasOperationProjectionBase - toEnrichmentDefaults returns undefined when not configured', () => {
  const OperationClass = toOasOperationProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const defaults = OperationClass.toEnrichmentDefaults({
    operation: mockOperation,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(defaults, undefined)
})

Deno.test('toOasOperationProjectionBase - toEnrichmentDefaults returns the computed seed when configured', () => {
  const OperationClass = toOasOperationProjectionBase<{
    subject?: { title: string }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'forms',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(v.object({ title: v.string() })),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      }),
    // Seeds the subject scope from the operation; run-constant scopes stay undefined.
    toEnrichmentDefaults: ({ operation }) => ({
      subject: { title: `${operation.method} ${operation.path}` },
      generator: undefined,
      stack: undefined
    })
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'post',
    pathItem: undefined,
    operationId: 'createUser',
    responses: {}
  })

  const defaults = OperationClass.toEnrichmentDefaults({
    operation: mockOperation,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(defaults, {
    subject: { title: 'post /users' },
    generator: undefined,
    stack: undefined
  })
})
