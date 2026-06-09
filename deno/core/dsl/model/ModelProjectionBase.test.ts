import { typescript } from '@skmtc/lang-typescript'
import { ModelProjectionBase } from './ModelProjectionBase.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { assertEquals } from '@std/assert/equals'
import { assertSpyCalls, spy } from '@std/testing/mock'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'

Deno.test('ModelProjectionBase - constructor stores refName correctly', () => {
  const model = new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - constructor stores settings correctly', () => {
  const settings = ContentSettings.empty({
    identifier: Identifier.createType('Product'),
    exportPath: './models/product.ts'
  })

  const model = new ModelProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'test-generator|Product' as GeneratorKey,
    refName: 'Product' as RefName
  })

  assertEquals(model.settings, settings)
})

Deno.test('ModelProjectionBase - constructor stores generatorKey correctly', () => {
  const model = new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - has context property from SnippetBase', () => {
  const mockContext = { name: 'test-context' } as unknown as GenerateContextType

  const model = new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - settings.exportPath is accessible', () => {
  const model = new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - settings.enrichments is accessible when provided', () => {
  const enrichments = { strict: true, nullable: false }
  const settings = new ContentSettings({
    identifier: Identifier.createType('Validated'),
    exportPath: './models/validated.ts',
    enrichments,
    variant: 'main'
  })

  const model = new ModelProjectionBase({
    context: {} as GenerateContextType,
    settings,
    generatorKey: 'validation-models|Validated' as GeneratorKey,
    refName: 'Validated' as RefName
  })

  assertEquals(model.settings.enrichments, enrichments)
})

Deno.test('ModelProjectionBase - stores all constructor properties correctly', () => {
  const mockContext = { id: 'context-1' } as unknown as GenerateContextType
  const settings = ContentSettings.empty({
    identifier: Identifier.createType('TestModel'),
    exportPath: './models/test.ts'
  })
  const generatorKey = 'test-gen|TestModel' as GeneratorKey
  const refName = 'TestModel' as RefName

  const model = new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - works with different refNames', () => {
  const createModel = (refName: RefName) => new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - works with different generatorKeys', () => {
  const createModel = (key: GeneratorKey) => new ModelProjectionBase({
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

Deno.test('ModelProjectionBase - insertModel calls context.insertModel with correct params', () => {
  const exportPath = './models/user.ts'

  const mockContext = {
    insertModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const model = new ModelProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('User'),
      exportPath
    }),
    generatorKey: 'test-generator|User' as GeneratorKey,
    refName: 'User' as RefName
  })

  const mockProjection = { toDefinition: () => ({}) }
  const refName = 'Address' as RefName

  model.insertModel(mockProjection as any, refName, { noExport: false })

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[0] as any, mockProjection)
  assertEquals(insertModelSpy.calls[0].args[1] as any, refName)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: false,
    variant: undefined
  })

  insertModelSpy.restore()
})

Deno.test('ModelProjectionBase - insertModel without noExport option', () => {
  const exportPath = './generated/models.ts'

  const mockContext = {
    insertModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertModelSpy = spy(mockContext, 'insertModel')

  const model = new ModelProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Product'),
      exportPath
    }),
    generatorKey: 'test-generator|Product' as GeneratorKey,
    refName: 'Product' as RefName
  })

  const mockProjection = { toDefinition: () => ({}) }
  const refName = 'Category' as RefName

  model.insertModel(mockProjection as any, refName)

  assertSpyCalls(insertModelSpy, 1)
  assertEquals(insertModelSpy.calls[0].args[2] as any, {
    destinationPath: exportPath,
    noExport: undefined,
    variant: undefined
  })

  insertModelSpy.restore()
})

Deno.test('ModelProjectionBase - insertNormalizedModel calls context.insertNormalizedModel with correct params', () => {
  const exportPath = './schemas/types.ts'

  const mockContext = {
    insertNormalizedModel: () => ({} as any)
  } as unknown as GenerateContextType

  const insertNormalizedModelSpy = spy(mockContext, 'insertNormalizedModel')

  const model = new ModelProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Order'),
      exportPath
    }),
    generatorKey: 'test-generator|Order' as GeneratorKey,
    refName: 'Order' as RefName
  })

  const mockProjection = { toDefinition: () => ({}) }
  const mockSchema = { type: 'object', properties: {} }
  const fallbackName = 'OrderItem'

  model.insertNormalizedModel(
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
  assertEquals(insertNormalizedModelSpy.calls[0].args[2] as any, { noExport: true, variant: undefined })

  insertNormalizedModelSpy.restore()
})

Deno.test('ModelProjectionBase - register calls context.register with correct params', () => {
  const exportPath = './types/models.ts'

  const mockContext = {
    register: () => {},
    resolveLang: (_id: string): Lang => typescript
  } as unknown as GenerateContextType

  const registerSpy = spy(mockContext, 'register')

  const model = new ModelProjectionBase({
    context: mockContext,
    settings: ContentSettings.empty({
      identifier: Identifier.createType('Base'),
      exportPath
    }),
    // A 3-segment model key (`id|refName|variant`) so the derived
    // `generatorId` cleanly resolves to `test-generator`.
    generatorKey: 'test-generator|Base|main' as GeneratorKey,
    refName: 'Base' as RefName
  })

  model.register({ imports: { './utils': ['helper'] } })

  assertSpyCalls(registerSpy, 1)
  // The projection base routes the concise form through `langRegister`, which
  // resolves the language by `generatorId`, converts imports to standardised
  // `ImportBase[]` via `lang.toImports`, and hands the neutral args (carrying
  // `generatorId`, not `createFile`) to `context.register` — the engine owns
  // the language lookup. (Re-exports await a `ReExportBase` seam and are not
  // threaded through this path yet.)
  const registered = registerSpy.calls[0].args[0] as any
  assertEquals(registered.destinationPath, exportPath)
  assertEquals(registered.imports.length, 1)
  assertEquals(registered.imports[0].mergeKey(), './utils')
  assertEquals(registered.imports[0].toString(), `import {helper} from './utils'`)
  assertEquals(registered.generatorId, 'test-generator')

  registerSpy.restore()
})
