import { toOasOperationProjectionBase } from './toOasOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasOperationProjectionBase } from '@/dsl/operation/oas/OasOperationProjectionBase.ts'
import type {
  ToOasOperationIdentifierArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import * as v from 'valibot'

Deno.test('toOasOperationProjectionBase - returns a class constructor', () => {
  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(typeof OperationClass, 'function')
  assertEquals(typeof OperationClass.prototype, 'object')
})

Deno.test('toOasOperationProjectionBase - sets static id from config', () => {
  const OperationClass = toOasOperationProjectionBase({
    id: 'typescript-operations',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.id, 'typescript-operations')
})

Deno.test('toOasOperationProjectionBase - sets static type to operation', () => {
  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  assertEquals(OperationClass.type, 'oasOperation')
})

Deno.test('toOasOperationProjectionBase - sets static toIdentifier from config', () => {
  const identifierFn = ({ operation }: ToOasOperationIdentifierArgs) =>
    Identifier.createVariable(operation.operationId || 'operation')

  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: identifierFn,
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const identifier = OperationClass.toIdentifier({ operation: mockOperation, enrichments: undefined, variant: 'main' })
  assertEquals(identifier.name, 'getUsers')
  // Verify identifier has expected properties
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toOasOperationProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ operation }: ToOasOperationExportPathArgs) =>
    `./generated/${operation.operationId}.ts`

  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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

Deno.test('toOasOperationProjectionBase - toIdentifier works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) =>
      Identifier.createVariable(`${operation.method}${operation.operationId}`),
    toExportPath: ({ operation }) => `./operations/${operation.operationId}.ts`
  })

  const getUsersOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'Users',
    responses: {}
  })
  const getUsersIdentifier = OperationClass.toIdentifier({ operation: getUsersOperation, enrichments: undefined, variant: 'main' })
  assertEquals(getUsersIdentifier.name, 'getUsers')

  const createProductOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'Product',
    responses: {}
  })
  const createProductIdentifier = OperationClass.toIdentifier({ operation: createProductOperation, enrichments: undefined, variant: 'main' })
  assertEquals(createProductIdentifier.name, 'postProduct')
})

Deno.test('toOasOperationProjectionBase - toExportPath works with different operations', () => {
  const OperationClass = toOasOperationProjectionBase({
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
    id: 'api-client',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
      identifier: Identifier.createVariable('getUsers'),
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
    id: 'test-operation',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
      identifier: Identifier.createVariable('createProduct'),
      exportPath: './operations/products.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof OasOperationProjectionBase, true)
  assertEquals(instance instanceof OperationClass, true)
})

Deno.test('toOasOperationProjectionBase - toEnrichments validates with schema', () => {
  const OperationClass = toOasOperationProjectionBase<{ enabled: boolean; timeout?: number }>({
    id: 'api-client',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
    id: 'rest-api',
    toIdentifier: ({ operation }) => Identifier.createVariable(operation.operationId || 'operation'),
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
