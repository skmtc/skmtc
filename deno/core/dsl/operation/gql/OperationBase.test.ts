import { GqlOperationBase } from './OperationBase.ts'
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

Deno.test('GqlOperationBase - constructor stores operation correctly', () => {
  const mockOperation = createMockGqlOperation()

  const operation = new GqlOperationBase({
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

Deno.test('GqlOperationBase - constructor stores settings correctly', () => {
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('createProduct'),
    exportPath: './operations/products.ts'
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createProduct'
  })

  const operation = new GqlOperationBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|mutation|createProduct' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings, settings)
})

Deno.test('GqlOperationBase - constructor stores generatorKey correctly', () => {
  const mockOperation = createMockGqlOperation({ fieldName: 'getOrders' })

  const operation = new GqlOperationBase({
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

Deno.test('GqlOperationBase - has context property from ContentBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType
  const mockOperation = createMockGqlOperation()

  const operation = new GqlOperationBase({
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

Deno.test('GqlOperationBase - settings.exportPath is accessible', () => {
  const mockOperation = createMockGqlOperation({ fieldName: 'getTypes' })

  const operation = new GqlOperationBase({
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

Deno.test('GqlOperationBase - settings.enrichments is accessible when provided', () => {
  const enrichments = { strict: true, nullable: false }
  const settings = new ContentSettings({
    identifier: Identifier.createVariable('validateOperation'),
    exportPath: './operations/validated.ts',
    enrichments
  })

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'validateOperation'
  })

  const operation = new GqlOperationBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-operations|mutation|validateOperation' as unknown as GeneratorKey,
    operation: mockOperation
  })

  assertEquals(operation.settings.enrichments, enrichments)
})

Deno.test('GqlOperationBase - stores all constructor properties correctly', () => {
  const mockContext = { id: 'context-1' } as unknown as GenerateContextType
  const settings = ContentSettings.empty({
    identifier: Identifier.createVariable('testOperation'),
    exportPath: './operations/test.ts'
  })
  const generatorKey = 'test-gen|query|testOperation' as unknown as GeneratorKey
  const mockOperation = createMockGqlOperation({ fieldName: 'testOperation' })

  const operation = new GqlOperationBase({
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

Deno.test('GqlOperationBase - works with different root kinds', () => {
  const create = (rootKind: 'query' | 'mutation' | 'subscription', fieldName: string) => {
    const mockOperation = createMockGqlOperation({ rootKind, fieldName })

    return new GqlOperationBase({
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

Deno.test('GqlOperationBase - insertOperation calls context.insertOperation with correct params', () => {
  const exportPath = './operations/users.ts'

  const mockContext = {
    insertOperation: () => ({}) as any
  } as unknown as GenerateContextType

  const insertOperationSpy = spy(mockContext, 'insertOperation')

  const mockOperation = createMockGqlOperation()

  const operation = new GqlOperationBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getUsers'),
      exportPath
    }),
    generatorKey: 'test-gen|query|getUsers' as unknown as GeneratorKey,
    operation: mockOperation
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const mockRelatedOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'relatedOp'
  })

  operation.insertOperation(mockInsertable as any, mockRelatedOperation, {
    noExport: true
  })

  assertSpyCalls(insertOperationSpy, 1)
  assertEquals(insertOperationSpy.calls[0].args[0] as any, {
    insertable: mockInsertable,
    operation: mockRelatedOperation,
    destinationPath: exportPath,
    noExport: true
  })

  insertOperationSpy.restore()
})

Deno.test('GqlOperationBase - insertOperation without noExport option', () => {
  const exportPath = './api/endpoints.ts'

  const mockContext = {
    insertOperation: () => ({}) as any
  } as unknown as GenerateContextType

  const insertOperationSpy = spy(mockContext, 'insertOperation')

  const mockOperation = createMockGqlOperation({ fieldName: 'testOp' })

  const operation = new GqlOperationBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('testOp'),
      exportPath
    }),
    generatorKey: 'test-gen|query|testOp' as unknown as GeneratorKey,
    operation: mockOperation
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const mockRelatedOp = createMockGqlOperation({ fieldName: 'related' })

  operation.insertOperation(mockInsertable as any, mockRelatedOp)

  assertSpyCalls(insertOperationSpy, 1)
  assertEquals(insertOperationSpy.calls[0].args[0] as any, {
    insertable: mockInsertable,
    operation: mockRelatedOp,
    destinationPath: exportPath,
    noExport: undefined
  })

  insertOperationSpy.restore()
})

Deno.test('GqlOperationBase - insertModel calls context.insertModel with correct params', () => {
  const exportPath = './models/types.ts'

  const mockContext = {
    insertModel: () => ({}) as any
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'createUser'
  })

  const operation = new GqlOperationBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('createUser'),
      exportPath
    }),
    generatorKey: 'test-gen|mutation|createUser' as unknown as GeneratorKey,
    operation: mockOperation
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const refName = 'User'

  operation.insertModel(mockInsertable as any, refName as any, {
    noExport: false
  })

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[0] as any, mockInsertable)
  assertEquals(insertModelSpy.calls[0].args[1] as any, refName)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: false
  })

  insertModelSpy.restore()
})

Deno.test('GqlOperationBase - insertNormalizedModel calls context.insertNormalisedModel with correct params', () => {
  const exportPath = './schemas/generated.ts'

  const mockContext = {
    insertNormalisedModel: () => ({}) as any
  } as unknown as GenerateContextType

  const insertNormalisedModelSpy = spy(mockContext, 'insertNormalisedModel')

  const mockOperation = createMockGqlOperation({ fieldName: 'getData' })

  const operation = new GqlOperationBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createVariable('getData'),
      exportPath
    }),
    generatorKey: 'test-gen|query|getData' as unknown as GeneratorKey,
    operation: mockOperation
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const mockSchema = { type: 'object', properties: {} }
  const fallbackName = 'GetDataResponse'

  operation.insertNormalizedModel(
    mockInsertable as any,
    { schema: mockSchema as any, fallbackName },
    { noExport: true }
  )

  assertSpyCalls(insertNormalisedModelSpy, 1)
  assertEquals(insertNormalisedModelSpy.calls[0].args[0] as any, mockInsertable)
  assertEquals(insertNormalisedModelSpy.calls[0].args[1] as any, {
    schema: mockSchema,
    fallbackName,
    destinationPath: exportPath
  })
  assertEquals(insertNormalisedModelSpy.calls[0].args[2] as any, { noExport: true })

  insertNormalisedModelSpy.restore()
})

Deno.test('GqlOperationBase - defineAndRegister calls context.defineAndRegister with correct params', () => {
  const exportPath = './helpers/utils.ts'

  const mockContext = {
    defineAndRegister: () => ({}) as any
  } as unknown as GenerateContextType

  const defineAndRegisterSpy = spy(mockContext, 'defineAndRegister')

  const mockOperation = createMockGqlOperation({
    rootKind: 'mutation',
    fieldName: 'validate'
  })

  const operation = new GqlOperationBase({
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
})

Deno.test('GqlOperationBase - register calls context.register with correct params', () => {
  const exportPath = './imports/dependencies.ts'

  const mockContext = {
    register: () => {}
  } as unknown as GenerateContextType

  const registerSpy = spy(mockContext, 'register')

  const mockOperation = createMockGqlOperation({ fieldName: 'apiCall' })

  const operation = new GqlOperationBase({
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
