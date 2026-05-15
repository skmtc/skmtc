import { GqlOperationProjectionBase } from '@/dsl/operation/gql/GqlOperationProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import { assertSpyCalls, spy } from '@std/testing/mock'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'

const createMockGqlOperation = (
  overrides?: Partial<{
    rootKind: 'query' | 'mutation' | 'subscription'
    fieldName: string
  }>
) => {
  return new GqlOperation({
    rootKind: overrides?.rootKind ?? 'query',
    fieldName: overrides?.fieldName ?? 'getUsers',
    arguments: [],
    returnType: new OasString({})
  })
}

Deno.test('GqlOperationProjectionBase - constructor stores operation correctly', () => {
  const mockOperation = createMockGqlOperation()

  const operation = new GqlOperationProjectionBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts'
    }),
    generatorKey: 'test-generator|query|getUsers' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.operation, mockOperation)
})

Deno.test('GqlOperationProjectionBase - constructor stores settings correctly', () => {
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('createProduct'),
    exportPath: './operations/products.ts'
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createProduct'
  })

  const operation = new GqlOperationProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|mutation|createProduct' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings, settings)
})

Deno.test('GqlOperationProjectionBase - constructor stores generatorKey correctly', () => {
  const mockOperation = createMockGqlOperation({ fieldName: 'getOrders' })

  const operation = new GqlOperationProjectionBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getOrders'),
      exportPath: './operations/orders.ts'
    }),
    generatorKey: 'typescript-operations|query|getOrders' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.generatorKey, 'typescript-operations|query|getOrders')
})

Deno.test('GqlOperationProjectionBase - has context property from SnippetBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType
  const mockOperation = createMockGqlOperation()

  const operation = new GqlOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getUsers'),
      exportPath: './operations/users.ts'
    }),
    generatorKey: 'test-generator|query|getUsers' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.context, mockContext)
})

Deno.test('GqlOperationProjectionBase - settings.exportPath is accessible', () => {
  const mockOperation = createMockGqlOperation({ fieldName: 'getTypes' })

  const operation = new GqlOperationProjectionBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getTypes'),
      exportPath: './generated/types.ts'
    }),
    generatorKey: 'test-generator|query|getTypes' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.exportPath, './generated/types.ts')
})

Deno.test('GqlOperationProjectionBase - settings.enrichments is accessible when provided', () => {
  const enrichments = { strict: true, nullable: false }
  const settings = new ContentSettings({
    identifier: Identifier.createVariable('validateOperation'),
    exportPath: './operations/validated.ts',
    enrichments,
    variant: 'main'
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'validateOperation'
  })

  const operation = new GqlOperationProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-operations|mutation|validateOperation' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.enrichments, enrichments)
})

Deno.test('GqlOperationProjectionBase - stores all constructor properties correctly', () => {
  const mockContext = { id: 'context-1' } as unknown as GenerateContextType
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('testOperation'),
    exportPath: './operations/test.ts'
  })
  const generatorKey = 'test-gen|query|testOperation' as unknown as GeneratorKey
  const mockOperation = createMockGqlOperation({ fieldName: 'testOperation' })

  const operation = new GqlOperationProjectionBase({
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

Deno.test('GqlOperationProjectionBase - works with different root kinds', () => {
  const create = (rootKind: 'query' | 'mutation' | 'subscription', fieldName: string) => {
    const mockOperation = createMockGqlOperation({ rootKind, fieldName })

    return new GqlOperationProjectionBase({
      context: {} as GenerateContextType,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable(fieldName),
        exportPath: `./operations/${fieldName.toLowerCase()}.ts`
      }),
      generatorKey: `test-gen|${rootKind}|${fieldName}` as unknown as GeneratorKey,
      operation: mockOperation
    })
  }

  const queryOp = create('query', 'getUsers')
  assertEquals(queryOp.operation.rootKind, 'query')

  const mutationOp = create('mutation', 'createUser')
  assertEquals(mutationOp.operation.rootKind, 'mutation')

  const subscriptionOp = create('subscription', 'onUserChange')
  assertEquals(subscriptionOp.operation.rootKind, 'subscription')
})

Deno.test(
  'GqlOperationProjectionBase - insertOperation calls context.insertOperation with correct params',
  () => {
    const exportPath = './operations/users.ts'

    const mockContext = {
      insertOperation: () => ({}) as any
    } as unknown as GenerateContextType

    const insertOperationSpy = spy(mockContext, 'insertOperation')

    const mockOperation = createMockGqlOperation()

    const operation = new GqlOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('getUsers'),
        exportPath
      }),
      generatorKey: 'test-gen|query|getUsers' as unknown as GeneratorKey,
      operation: mockOperation
    })

    const mockProjection = { toDefinition: () => ({}) }
    const mockRelatedOperation = createMockGqlOperation({
      rootKind: 'mutation',
      fieldName: 'relatedOp'
    })

    operation.insertOperation(mockProjection as any, mockRelatedOperation, {
      noExport: true
    })

    assertSpyCalls(insertOperationSpy, 1)
    assertEquals(insertOperationSpy.calls[0].args[0] as any, {
      projection: mockProjection,
      operation: mockRelatedOperation,
      destinationPath: exportPath,
      noExport: true,
      variant: undefined
    })

    insertOperationSpy.restore()
  }
)

Deno.test('GqlOperationProjectionBase - insertOperation without noExport option', () => {
  const exportPath = './api/endpoints.ts'

  const mockContext = {
    insertOperation: () => ({}) as any
  } as unknown as GenerateContextType

  const insertOperationSpy = spy(mockContext, 'insertOperation')

  const mockOperation = createMockGqlOperation({ fieldName: 'testOp' })

  const operation = new GqlOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('testOp'),
      exportPath
    }),
    generatorKey: 'test-gen|query|testOp' as unknown as GeneratorKey,
    operation: mockOperation
  })

  const mockProjection = { toDefinition: () => ({}) }
  const mockRelatedOp = createMockGqlOperation({ fieldName: 'related' })

  operation.insertOperation(mockProjection as any, mockRelatedOp)

  assertSpyCalls(insertOperationSpy, 1)
  assertEquals(insertOperationSpy.calls[0].args[0] as any, {
    projection: mockProjection,
    operation: mockRelatedOp,
    destinationPath: exportPath,
    noExport: undefined,
    variant: undefined
  })

  insertOperationSpy.restore()
})

Deno.test('GqlOperationProjectionBase - insertModel calls context.insertModel with correct params', () => {
  const exportPath = './models/types.ts'

  const mockContext = {
    insertModel: () => ({}) as any
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const operation = new GqlOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('createUser'),
      exportPath
    }),
    generatorKey: 'test-gen|mutation|createUser' as unknown as GeneratorKey,
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
  'GqlOperationProjectionBase - insertNormalizedModel calls context.insertNormalizedModel with correct params',
  () => {
    const exportPath = './schemas/generated.ts'

    const mockContext = {
      insertNormalizedModel: () => ({}) as any
    } as unknown as GenerateContextType

    const insertNormalizedModelSpy = spy(mockContext, 'insertNormalizedModel')

    const mockOperation = createMockGqlOperation({ fieldName: 'getData' })

    const operation = new GqlOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('getData'),
        exportPath
      }),
      generatorKey: 'test-gen|query|getData' as unknown as GeneratorKey,
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
  'GqlOperationProjectionBase - defineAndRegister calls context.defineAndRegister with correct params',
  () => {
    const exportPath = './helpers/utils.ts'

    const mockContext = {
      defineAndRegister: () => ({}) as any
    } as unknown as GenerateContextType

    const defineAndRegisterSpy = spy(mockContext, 'defineAndRegister')

    const mockOperation = createMockGqlOperation({
      rootKind: 'mutation',
      fieldName: 'validate'
    })

    const operation = new GqlOperationProjectionBase({
      context: mockContext,
      settings: ContentSettings.empty({
        identifier: Identifier.createVariable('validate'),
        exportPath
      }),
      generatorKey: 'test-gen|mutation|validate' as unknown as GeneratorKey,
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

Deno.test('GqlOperationProjectionBase - register calls context.register with correct params', () => {
  const exportPath = './imports/dependencies.ts'

  const mockContext = {
    register: () => {}
  } as unknown as GenerateContextType

  const registerSpy = spy(mockContext, 'register')

  const mockOperation = createMockGqlOperation({ fieldName: 'apiCall' })

  const operation = new GqlOperationProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('apiCall'),
      exportPath
    }),
    generatorKey: 'test-gen|query|apiCall' as unknown as GeneratorKey,
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
