import { ModelBase } from './ModelBase.ts'
import { assertEquals } from '@std/assert/equals'
import { assertSpyCalls, spy } from '@std/testing/mock'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'

Deno.test('ModelBase - constructor stores refName correctly', () => {
  const model = new ModelBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('User'),
      exportPath: './models/user.ts'
    }),
    generatorKey: 'test-generator|User' as GeneratorKey,
    refName: 'User' as RefName
  })

  assertEquals(model.refName, 'User')
})

Deno.test('ModelBase - constructor stores settings correctly', () => {
  const settings = ContentSettings.empty({
    identifier: Identifier.createType('Product'),
    exportPath: './models/product.ts'
  })

  const model = new ModelBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|Product' as GeneratorKey,
    refName: 'Product' as RefName
  })

  assertEquals(model.settings, settings)
})

Deno.test('ModelBase - constructor stores generatorKey correctly', () => {
  const model = new ModelBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Order'),
      exportPath: './models/order.ts'
    }),
    generatorKey: 'typescript-models|Order' as GeneratorKey,
    refName: 'Order' as RefName
  })

  assertEquals(model.generatorKey, 'typescript-models|Order')
})

Deno.test('ModelBase - has context property from ContentBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType

  const model = new ModelBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('User'),
      exportPath: './models/user.ts'
    }),
    generatorKey: 'test-generator|User' as GeneratorKey,
    refName: 'User' as RefName
  })

  assertEquals(model.context, mockContext)
})

Deno.test('ModelBase - settings.exportPath is accessible', () => {
  const model = new ModelBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Type'),
      exportPath: './generated/types.ts'
    }),
    generatorKey: 'test-generator|Type' as GeneratorKey,
    refName: 'Type' as RefName
  })

  assertEquals(model.settings.exportPath, './generated/types.ts')
})

Deno.test('ModelBase - settings.enrichments is accessible when provided', () => {
  const enrichments = { strict: true, nullable: false }
  const settings = new ContentSettings({
    identifier: Identifier.createType('Validated'),
    exportPath: './models/validated.ts',
    enrichments
  })

  const model = new ModelBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-models|Validated' as GeneratorKey,
    refName: 'Validated' as RefName
  })

  assertEquals(model.settings.enrichments, enrichments)
})

Deno.test('ModelBase - stores all constructor properties correctly', () => {
  const mockContext = { id: 'context-1' } as unknown as GenerateContextType
  const settings = ContentSettings.empty({
    identifier: Identifier.createType('TestModel'),
    exportPath: './models/test.ts'
  })
  const generatorKey = 'test-gen|TestModel' as GeneratorKey
  const refName = 'TestModel' as RefName

  const model = new ModelBase({
    context: mockContext,
    settings,
    generatorKey,
    refName
  })

  assertEquals(model.context, mockContext)
  assertEquals(model.settings, settings)
  assertEquals(model.generatorKey, generatorKey)
  assertEquals(model.refName, refName)
})

Deno.test('ModelBase - works with different refNames', () => {
  const createModel = (refName: RefName) => new ModelBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createType(refName),
      exportPath: `./models/${refName.toLowerCase()}.ts`
    }),
    generatorKey: `test-gen|${refName}` as GeneratorKey,
    refName
  })

  const userModel = createModel('User' as RefName)
  assertEquals(userModel.refName, 'User')

  const productModel = createModel('Product' as RefName)
  assertEquals(productModel.refName, 'Product')

  const orderModel = createModel('Order' as RefName)
  assertEquals(orderModel.refName, 'Order')
})

Deno.test('ModelBase - works with different generatorKeys', () => {
  const createModel = (key: GeneratorKey) => new ModelBase({
    context: {} as GenerateContextType,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Test'),
      exportPath: './models/test.ts'
    }),
    generatorKey: key,
    refName: 'Test' as RefName
  })

  const tsModel = createModel('typescript|Test' as GeneratorKey)
  assertEquals(tsModel.generatorKey, 'typescript|Test')

  const zodModel = createModel('zod|Test' as GeneratorKey)
  assertEquals(zodModel.generatorKey, 'zod|Test')
})

Deno.test('ModelBase - insertModel calls context.insertModel with correct params', () => {
  const exportPath = './models/user.ts'

  const mockContext = {
    insertModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const model = new ModelBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('User'),
      exportPath
    }),
    generatorKey: 'test-generator|User' as GeneratorKey,
    refName: 'User' as RefName
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const refName = 'Address' as RefName

  model.insertModel(mockInsertable as any, refName, { noExport: false })

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[0] as any, mockInsertable)
  assertEquals(insertModelSpy.calls[0].args[1] as any, refName)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: false
  })

  insertModelSpy.restore()
})

Deno.test('ModelBase - insertModel without noExport option', () => {
  const exportPath = './generated/models.ts'

  const mockContext = {
    insertModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const model = new ModelBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Product'),
      exportPath
    }),
    generatorKey: 'test-generator|Product' as GeneratorKey,
    refName: 'Product' as RefName
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const refName = 'Category' as RefName

  model.insertModel(mockInsertable as any, refName)

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: undefined
  })

  insertModelSpy.restore()
})

Deno.test('ModelBase - insertNormalizedModel calls context.insertNormalisedModel with correct params', () => {
  const exportPath = './schemas/types.ts'

  const mockContext = {
    insertNormalisedModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertNormalisedModelSpy = spy(mockContext, 'insertNormalisedModel')

  const model = new ModelBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Order'),
      exportPath
    }),
    generatorKey: 'test-generator|Order' as GeneratorKey,
    refName: 'Order' as RefName
  })

  const mockInsertable = { toDefinition: () => ({}) }
  const mockSchema = { type: 'object', properties: {} }
  const fallbackName = 'OrderItem'

  model.insertNormalizedModel(
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

Deno.test('ModelBase - register calls context.register with correct params', () => {
  const exportPath = './types/models.ts'

  const mockContext = {
    register: () => {}
  } as unknown as GenerateContextType

  const registerSpy = spy(mockContext, 'register')

  const model = new ModelBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Base'),
      exportPath
    }),
    generatorKey: 'test-generator|Base' as GeneratorKey,
    refName: 'Base' as RefName
  })

  const imports = { './utils': ['helper'] }
  const reExports = { './types': [Identifier.createType('BaseType')] }

  model.register({ imports, reExports })

  assertSpyCalls(registerSpy, 1)
  assertEquals(registerSpy.calls[0].args[0] as any, {
    imports,
    reExports,
    destinationPath: exportPath
  })

  registerSpy.restore()
})
