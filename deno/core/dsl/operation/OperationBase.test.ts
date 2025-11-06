import { OperationBase } from './OperationBase.ts'
import { assertEquals } from '@std/assert/equals'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'

Deno.test('OperationBase - constructor stores operation correctly', () => {
  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const operation = new OperationBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts'
    }),
    generatorKey: 'test-generator|get|/users' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.operation, mockOperation)
})

Deno.test('OperationBase - constructor stores settings correctly', () => {
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('createProduct'),
    exportPath: './operations/products.ts'
  })

  const mockOperation = new OasOperation({
    path: '/products',
    method: 'post',
    pathItem: undefined,
    operationId: 'createProduct',
    responses: {}
  })

  const operation = new OperationBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|post|/products' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings, settings)
})

Deno.test('OperationBase - constructor stores generatorKey correctly', () => {
  const mockOperation = new OasOperation({
    path: '/orders',
    method: 'get',
    pathItem: undefined,
    operationId: 'getOrders',
    responses: {}
  })

  const operation = new OperationBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getOrders'),
      exportPath: './operations/orders.ts'
    }),
    generatorKey: 'typescript-operations|get|/orders' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.generatorKey, 'typescript-operations|get|/orders')
})

Deno.test('OperationBase - has context property from ContentBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType
  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const operation = new OperationBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts'
    }),
    generatorKey: 'test-generator|get|/users' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.context, mockContext)
})

Deno.test('OperationBase - settings.exportPath is accessible', () => {
  const mockOperation = new OasOperation({
    path: '/types',
    method: 'get',
    pathItem: undefined,
    operationId: 'getTypes',
    responses: {}
  })

  const operation = new OperationBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getTypes'),
      exportPath: './generated/types.ts'
    }),
    generatorKey: 'test-generator|get|/types' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.exportPath, './generated/types.ts')
})

Deno.test('OperationBase - settings.enrichments is accessible when provided', () => {
  const enrichments = { strict: true, nullable: false }
  const settings = new ContentSettings({
    identifier: Identifier.createVariable('validateOperation'),
    exportPath: './operations/validated.ts',
    enrichments
  })

  const mockOperation = new OasOperation({
    path: '/validate',
    method: 'post',
    pathItem: undefined,
    operationId: 'validateOperation',
    responses: {}
  })

  const operation = new OperationBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-operations|post|/validate' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.enrichments, enrichments)
})

Deno.test('OperationBase - stores all constructor properties correctly', () => {
  const mockContext = { id: 'context-1' } as unknown as GenerateContextType
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('testOperation'),
    exportPath: './operations/test.ts'
  })
  const generatorKey = 'test-gen|get|/test' as GeneratorKey
  const mockOperation = new OasOperation({
    path: '/test',
    method: 'get',
    pathItem: undefined,
    operationId: 'testOperation',
    responses: {}
  })

  const operation = new OperationBase({
    context: mockContext,
    settings,
    generatorKey,
    operation: mockOperation
  })

  assertEquals(operation.context, mockContext)
  assertEquals(operation.settings, settings)
  assertEquals(operation.generatorKey, generatorKey)
  assertEquals(operation.operation, mockOperation)
})

Deno.test('OperationBase - works with different HTTP methods', () => {
  const createOperation = (method: 'get' | 'post' | 'put' | 'delete', operationId: string) => {
    const mockOperation = new OasOperation({
      path: `/${operationId}`,
      method,
      pathItem: undefined,
      operationId,
      responses: {}
    })

    return new OperationBase({
      context: {} as GenerateContextType,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable(operationId),
        exportPath: `./operations/${operationId.toLowerCase()}.ts`
      }),
      generatorKey: `test-gen|${method}|/${operationId}` as GeneratorKey,
      operation: mockOperation
    })
  }

  const getOperation = createOperation('get', 'getUsers')
  assertEquals(getOperation.operation.method, 'get')

  const postOperation = createOperation('post', 'createUser')
  assertEquals(postOperation.operation.method, 'post')

  const putOperation = createOperation('put', 'updateUser')
  assertEquals(putOperation.operation.method, 'put')

  const deleteOperation = createOperation('delete', 'deleteUser')
  assertEquals(deleteOperation.operation.method, 'delete')
})
