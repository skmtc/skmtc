import { toOperationBase } from './toOperationBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OperationBase } from '@/dsl/operation/OperationBase.ts'
import * as v from 'valibot'

Deno.test('toOperationBase - returns a class constructor', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toOperationBase - sets static id from config', () => {
  const OperationClass = toOperationBase({
    id: 'typescript-operations',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.id, 'typescript-operations')
})

Deno.test('toOperationBase - sets static type to operation', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.type, 'operation')
})

Deno.test('toOperationBase - sets static toIdentifier from config', () => {
  const identifierFn = (operation: OasOperation) =>
    Identifier.createVariable(operation.operationId || 'operation')

  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: identifierFn,
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const identifier = OperationClass.toIdentifier(mockOperation)
  assertEquals(identifier.name, 'getUsers')
  // Verify identifier has expected properties
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toOperationBase - sets static toExportPath from config', () => {
  const exportPathFn = (operation: OasOperation) => `./generated/${operation.operationId}.ts`

  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: exportPathFn
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'post',
    pathItem: undefined,
    operationId: 'createUser',
    responses: {}
  })

  const exportPath = OperationClass.toExportPath(mockOperation)
  assertEquals(exportPath, './generated/createUser.ts')
})

Deno.test('toOperationBase - toEnrichments returns undefined when no enrichmentSchema provided', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
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
    context: { settings: {} } as GenerateContextType
  })

  assertEquals(enrichments, undefined)
})

Deno.test('toOperationBase - toEnrichments returns undefined when no enrichments in context', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
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
    context: { settings: {} } as GenerateContextType
  })

  assertEquals(enrichments, undefined)
})

Deno.test('toOperationBase - toIdentifier works with different operations', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) =>
      Identifier.createVariable(`${operation.method}${operation.operationId}`),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'Users',
    responses: {}
  })
  const getUsersIdentifier = OperationClass.toIdentifier(getUsersOperation)
  assertEquals(getUsersIdentifier.name, 'getUsers')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'Product',
    responses: {}
  })
  const createProductIdentifier = OperationClass.toIdentifier(createProductOperation)
  assertEquals(createProductIdentifier.name, 'postProduct')
})

Deno.test('toOperationBase - toExportPath works with different operations', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./types/${operation.method}-${operation.operationId}.d.ts`
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'users',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath(getUsersOperation), './types/get-users.d.ts')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'product',
    responses: {}
  })
  assertEquals(OperationClass.toExportPath(createProductOperation), './types/post-product.d.ts')
})

Deno.test('toOperationBase - constructor creates correct generatorKey', () => {
  const OperationClass = toOperationBase({
    id: 'api-client',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
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
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts',
      enrichments: undefined
    } as any
  })

  // Verify generatorKey has expected format: id|path|method
  assertEquals(instance.generatorKey, 'api-client|/users|get')
})

Deno.test('toOperationBase - instance is OperationBase', () => {
  const OperationClass = toOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
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
      identifier: Identifier.createVariable('createProduct'),
      exportPath: './operations/products.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof OperationBase, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toOperationBase - toEnrichments validates with schema', () => {
  const OperationClass = toOperationBase<{ enabled: boolean; timeout?: number }>({
    id: 'api-client',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`,
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
              enabled: true,
              timeout: 5000
            }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext
  })

  assertEquals(enrichments, {
    enabled: true,
    timeout: 5000
  })
})

Deno.test('toOperationBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toOperationBase({
    id: 'rest-api',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
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
            put: { customValue: 'found-it', flag: true }
          }
        }
      }
    }
  } as any

  const enrichments = OperationClass.toEnrichments({
    operation: mockOperation,
    context: mockContext
  })

  // Verify it retrieved from the correct path: enrichments.{id}.{path}.{method}
  assertEquals(enrichments, { customValue: 'found-it', flag: true })
})
