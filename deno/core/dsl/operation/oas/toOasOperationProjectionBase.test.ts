import { toOasOperationProjectionBase } from './toOasOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { TsSnippet, createVariable } from '@skmtc/lang-typescript'
import type {
  ToOasOperationIdentifierNameArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'

Deno.test('toOasOperationProjectionBase - returns a class constructor', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toOasOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'typescript-operations',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.id, 'typescript-operations')
})

Deno.test('toOasOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.type, 'oasOperation')
})

Deno.test('toOasOperationProjectionBase - sets static toIdentifierName from config', () => {
  const identifierNameFn = ({ operation }: ToOasOperationIdentifierNameArgs) =>
    operation.operationId || 'operation'

  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: identifierNameFn,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const name = OperationClass.toIdentifierName({ operation: mockOperation, enrichments: undefined, variant: 'main' })
  assertEquals(name, 'getUsers')
  assertEquals(OperationClass.toIdentifierType(mockOperation, {} as GenerateContextType).kind, 'variable')
})

Deno.test('toOasOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToOasOperationExportPathArgs) =>
    `./generated/${operation.operationId}.ts`

  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: exportPathFn
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'post',
    pathItem: undefined,
    operationId: 'createUser',
    responses: {}
  })

  const exportPath = OperationClass.toExportPath({ operation: mockOperation, enrichments: undefined, variant: 'main' })
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test('toOasOperationProjectionBase - toEnrichments returns undefined when no enrichmentSchema provided', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
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

  assertEquals(enrichments, undefined)
})

Deno.test('toOasOperationProjectionBase - toEnrichments returns undefined when no enrichments in context', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
    // No enrichment schema provided
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

  assertEquals(enrichments, undefined)
})

Deno.test('toOasOperationProjectionBase - toIdentifierName works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => `${operation.method}${operation.operationId}`,
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'Users',
    responses: {}
  })
  const getUsersName = OperationClass.toIdentifierName({ operation: getUsersOperation, enrichments: undefined, variant: 'main' })
  assertEquals(getUsersName, 'getUsers')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'Product',
    responses: {}
  })
  const createProductName = OperationClass.toIdentifierName({ operation: createProductOperation, enrichments: undefined, variant: 'main' })
  assertEquals(createProductName, 'postProduct')
})

Deno.test('toOasOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./types/${operation.method}-${operation.operationId}.d.ts`
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'users',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath({ operation: getUsersOperation, enrichments: undefined, variant: 'main' }), './types/get-users.d.ts')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'product',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath({ operation: createProductOperation, enrichments: undefined, variant: 'main' }), './types/post-product.d.ts')
})

Deno.test('toOasOperationProjectionBase - constructor creates correct generatorKey', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'api-client',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
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
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'test-operation',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
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
  const OperationClass = toOasOperationProjectionBase<{ enabled: boolean; timeout?: number }>({
    base: TsSnippet,
    id: 'api-client',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        enabled: v.boolean(),
        timeout: v.optional(v.number())
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

  assertEquals(enrichments, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toOasOperationProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toOasOperationProjectionBase({
    base: TsSnippet,
    id: 'rest-api',
    toIdentifierName: ({ operation }) => operation.operationId || 'operation',
    toIdentifierType: () => ({ kind: 'variable' }),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
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

  // Retrieves from enrichments.{id}.{path}.{method}.{variant}
  assertEquals(enrichments, { customValue: 'found-it', flag: true })
})
