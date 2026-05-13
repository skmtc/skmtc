import { OasOperationProjectionBase } from './OasOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import { assertSpyCalls, spy } from '@std/testing/mock'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'

Deno.test('OasOperationProjectionBase - constructor stores operation correctly', () => {
  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
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

Deno.test('OasOperationProjectionBase - constructor stores settings correctly', () => {
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

  const operation = new OasOperationProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|post|/products' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings, settings)
})

Deno.test('OasOperationProjectionBase - constructor stores generatorKey correctly', () => {
  const mockOperation = new OasOperation({
    path: '/orders',
    method: 'get',
    pathItem: undefined,
    operationId: 'getOrders',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
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

Deno.test('OasOperationProjectionBase - has context property from SnippetBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType
  const mockOperation = new OasOperation({
    path: '/users',
    method: 'get',
    pathItem: undefined,
    operationId: 'getUsers',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
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

Deno.test('OasOperationProjectionBase - settings.exportPath is accessible', () => {
  const mockOperation = new OasOperation({
    path: '/types',
    method: 'get',
    pathItem: undefined,
    operationId: 'getTypes',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
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

Deno.test('OasOperationProjectionBase - settings.enrichments is accessible when provided', () => {
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

  const operation = new OasOperationProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-operations|post|/validate' as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.enrichments, enrichments)
})

Deno.test('OasOperationProjectionBase - stores all constructor properties correctly', () => {
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

  const operation = new OasOperationProjectionBase({
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

Deno.test('OasOperationProjectionBase - works with different HTTP methods', () => {
  const createOperation = (method: 'get' | 'post' | 'put' | 'delete', operationId: string) => {
    const mockOperation = new OasOperation({
      path: `/${operationId}`,
      method,
      pathItem: undefined,
      operationId,
      responses: {}
    })

    return new OasOperationProjectionBase({
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

Deno.test(
  'OasOperationProjectionBase - insertOperation calls context.insertOperation with correct params',
  () => {
    const exportPath = './operations/users.ts'

    const mockContext = {
      insertOperation: () => ({}) as any
    } as unknown as GenerateContextType

    const insertOperationSpy = spy(mockContext, 'insertOperation')

    const mockOperation = new OasOperation({
      path: '/users',
      method: 'get',
      pathItem: undefined,
      operationId: 'getUsers',
      responses: {}
    })

    const operation = new OasOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('getUsers'),
        exportPath
      }),
      generatorKey: 'test-gen|get|/users' as GeneratorKey,
      operation: mockOperation
    })

    const mockProjection = { toDefinition: () => ({}) }
    const mockRelatedOperation = new OasOperation({
      path: '/related',
      method: 'post',
      pathItem: undefined,
      operationId: 'relatedOp',
      responses: {}
    })

    operation.insertOperation(mockProjection as any, mockRelatedOperation, {
      noExport: true
    })

    assertSpyCalls(insertOperationSpy, 1)
    assertEquals(insertOperationSpy.calls[0].args[0] as any, {
      projection: mockProjection,
      operation: mockRelatedOperation,
      destinationPath: exportPath,
      noExport: true
    })

    insertOperationSpy.restore()
  }
)

Deno.test('OasOperationProjectionBase - insertOperation without noExport option', () => {
  const exportPath = './api/endpoints.ts'

  const mockContext = {
    insertOperation: () => ({}) as any
  } as unknown as GenerateContextType

  const insertOperationSpy = spy(mockContext, 'insertOperation')

  const mockOperation = new OasOperation({
    path: '/test',
    method: 'get',
    pathItem: undefined,
    operationId: 'testOp',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('testOp'),
      exportPath
    }),
    generatorKey: 'test-gen|get|/test' as GeneratorKey,
    operation: mockOperation
  })

  const mockProjection = { toDefinition: () => ({}) }
  const mockRelatedOp = new OasOperation({
    path: '/related',
    method: 'get',
    pathItem: undefined,
    operationId: 'related',
    responses: {}
  })

  operation.insertOperation(mockProjection as any, mockRelatedOp)

  assertSpyCalls(insertOperationSpy, 1)
  assertEquals(insertOperationSpy.calls[0].args[0] as any, {
    projection: mockProjection,
    operation: mockRelatedOp,
    destinationPath: exportPath,
    noExport: undefined
  })

  insertOperationSpy.restore()
})

Deno.test('OasOperationProjectionBase - insertModel calls context.insertModel with correct params', () => {
  const exportPath = './models/types.ts'

  const mockContext = {
    insertModel: () => ({}) as any
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const mockOperation = new OasOperation({
    path: '/users',
    method: 'post',
    pathItem: undefined,
    operationId: 'createUser',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('createUser'),
      exportPath
    }),
    generatorKey: 'test-gen|post|/users' as GeneratorKey,
    operation: mockOperation
  })

  const mockProjection = { toDefinition: () => ({}) }
  const refName = 'User'

  operation.insertModel(mockProjection as any, refName as any, {
    noExport: false
  })

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[0] as any, mockProjection)
  assertEquals(insertModelSpy.calls[0].args[1] as any, refName)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: false
  })

  insertModelSpy.restore()
})

Deno.test(
  'OasOperationProjectionBase - insertNormalizedModel calls context.insertNormalizedModel with correct params',
  () => {
    const exportPath = './schemas/generated.ts'

    const mockContext = {
      insertNormalizedModel: () => ({}) as any
    } as unknown as GenerateContextType

    const insertNormalizedModelSpy = spy(mockContext, 'insertNormalizedModel')

    const mockOperation = new OasOperation({
      path: '/data',
      method: 'get',
      pathItem: undefined,
      operationId: 'getData',
      responses: {}
    })

    const operation = new OasOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('getData'),
        exportPath
      }),
      generatorKey: 'test-gen|get|/data' as GeneratorKey,
      operation: mockOperation
    })

    const mockProjection = { toDefinition: () => ({}) }
    const mockSchema = { type: 'object', properties: {} }
    const fallbackName = 'GetDataResponse'

    operation.insertNormalizedModel(
      mockProjection as any,
      { schema: mockSchema as any, fallbackName },
      { noExport: true }
    )

    assertSpyCalls(insertNormalizedModelSpy, 1)
    assertEquals(insertNormalizedModelSpy.calls[0].args[0] as any, mockProjection)
    assertEquals(insertNormalizedModelSpy.calls[0].args[1] as any, {
      schema: mockSchema,
      fallbackName,
      destinationPath: exportPath
    })
    assertEquals(insertNormalizedModelSpy.calls[0].args[2] as any, { noExport: true })

    insertNormalizedModelSpy.restore()
  }
)

Deno.test(
  'OasOperationProjectionBase - defineAndRegister calls context.defineAndRegister with correct params',
  () => {
    const exportPath = './helpers/utils.ts'

    const mockContext = {
      defineAndRegister: () => ({}) as any
    } as unknown as GenerateContextType

    const defineAndRegisterSpy = spy(mockContext, 'defineAndRegister')

    const mockOperation = new OasOperation({
      path: '/validate',
      method: 'post',
      pathItem: undefined,
      operationId: 'validate',
      responses: {}
    })

    const operation = new OasOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('validate'),
        exportPath
      }),
      generatorKey: 'test-gen|post|/validate' as GeneratorKey,
      operation: mockOperation
    })

    const identifier = Identifier.createVariable('validateHelper')
    const value = 'validation code'

    operation.defineAndRegister({
      identifier,
      value,
      noExport: true
    })

    assertSpyCalls(defineAndRegisterSpy, 1)
    assertEquals(defineAndRegisterSpy.calls[0].args[0] as any, {
      identifier,
      value,
      destinationPath: exportPath,
      noExport: true
    })

    defineAndRegisterSpy.restore()
  }
)

Deno.test('OasOperationProjectionBase - register calls context.register with correct params', () => {
  const exportPath = './imports/dependencies.ts'

  const mockContext = {
    register: () => {}
  } as unknown as GenerateContextType

  const registerSpy = spy(mockContext, 'register')

  const mockOperation = new OasOperation({
    path: '/api',
    method: 'get',
    pathItem: undefined,
    operationId: 'apiCall',
    responses: {}
  })

  const operation = new OasOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('apiCall'),
      exportPath
    }),
    generatorKey: 'test-gen|get|/api' as GeneratorKey,
    operation: mockOperation
  })

  const imports = { './helper': ['helper'] }
  const reExports = { './utils': [Identifier.createVariable('util')] }

  operation.register({ imports, reExports })

  assertSpyCalls(registerSpy, 1)
  assertEquals(registerSpy.calls[0].args[0] as any, {
    imports,
    reExports,
    destinationPath: exportPath
  })

  registerSpy.restore()
})
