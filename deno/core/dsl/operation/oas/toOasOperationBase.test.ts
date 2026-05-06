import { toOasOperationBase } from './toOasOperationBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasOperationBase } from '@/dsl/operation/oas/OasOperationBase.ts'
import * as v from 'valibot'

Deno.test('toOasOperationBase - returns a class constructor', () => {
  const OperationClass = toOasOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toOasOperationBase - sets static id from config', () => {
  const OperationClass = toOasOperationBase({
    id: 'typescript-operations',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.id, 'typescript-operations')
})

Deno.test('toOasOperationBase - sets static type to operation', () => {
  const OperationClass = toOasOperationBase({
    id: 'test-operation',
    toIdentifier: (operation) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: (operation) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.type, 'oasOperation')
})

Deno.test('toOasOperationBase - sets static toIdentifier from config', () => {
  const identifierFn = (operation: OasOperation) =>
    Identifier.createVariable(operation.operationId || 'operation')

  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - sets static toExportPath from config', () => {
  const exportPathFn = (operation: OasOperation) => `./generated/${operation.operationId}.ts`

  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - toEnrichments returns undefined when no enrichmentSchema provided', () => {
  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - toEnrichments returns undefined when no enrichments in context', () => {
  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - toIdentifier works with different operations', () => {
  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - toExportPath works with different operations', () => {
  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - constructor creates correct generatorKey', () => {
  const OperationClass = toOasOperationBase({
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

Deno.test('toOasOperationBase - instance is OasOperationBase', () => {
  const OperationClass = toOasOperationBase({
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

  assertEquals(instance instanceof OasOperationBase, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toOasOperationBase - toEnrichments validates with schema', () => {
  const OperationClass = toOasOperationBase<{ enabled: boolean; timeout?: number }>({
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

Deno.test('toOasOperationBase - toEnrichments retrieves from correct nested path', () => {
  const OperationClass = toOasOperationBase({
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
