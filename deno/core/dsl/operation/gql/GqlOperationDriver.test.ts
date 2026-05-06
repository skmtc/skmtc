import { assertEquals, assertExists, assert, assertThrows } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { GqlOperationDriver } from './GqlOperationDriver.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GqlOperationInsertable } from './types.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { GqlOperation, type GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'
import { GqlOperationBase } from './GqlOperationBase.ts'

// ============================================================================
// Test Helpers
// ============================================================================

const toKey = (generatorId: string, operation: GqlOperation): GeneratorKey =>
  `${generatorId}|${operation.rootKind}|${operation.fieldName}` as unknown as GeneratorKey

const createMockContext = (options?: {
  findDefinition?: Definition<any> | undefined
  existingImports?: Record<string, string[]>
}) => {
  const toOperationContentSettingsSpy = spy((args: any) => {
    return new ContentSettings({
      identifier: args.insertable.toIdentifier(args.operation),
      exportPath: args.insertable.toExportPath(args.operation),
      enrichments: args.insertable.toEnrichments({
        operation: args.operation,
        context: mockContext
      })
    })
  })

  const findDefinitionSpy = spy((_args: any) => options?.findDefinition)
  const registerSpy = spy((_args: any) => {})

  const mockContext = {
    toOperationContentSettings: toOperationContentSettingsSpy,
    findDefinition: findDefinitionSpy,
    register: registerSpy
  } as unknown as GenerateContextType

  return {
    context: mockContext,
    toOperationContentSettingsSpy,
    findDefinitionSpy,
    registerSpy
  }
}

const createMockOperation = (options?: {
  rootKind?: GqlRootKind
  fieldName?: string
}): GqlOperation => {
  return new GqlOperation({
    rootKind: options?.rootKind ?? 'query',
    fieldName: options?.fieldName ?? 'getUsers',
    arguments: [],
    returnType: new OasString({})
  })
}

const createMockInsertable = (options?: {
  id?: string
  exportPath?: string
  enrichments?: any
}): GqlOperationInsertable<any, undefined> => {
  class MockInsertable extends GqlOperationBase<undefined> {
    static id = options?.id ?? 'MockInsertable'
    static type = 'operation' as const

    static toIdentifier(operation: GqlOperation): Identifier {
      return Identifier.createVariable(operation.fieldName)
    }

    static toExportPath(operation: GqlOperation): string {
      return options?.exportPath ?? `./operations/${operation.fieldName}.ts`
    }

    static toEnrichments(): undefined {
      return options?.enrichments
    }

    static createIdentifier(name: string): Identifier {
      return Identifier.createVariable(name)
    }

    constructor(args: {
      context: GenerateContextType
      settings: ContentSettings<undefined>
      operation: GqlOperation
    }) {
      const generatorKey = toKey(MockInsertable.id, args.operation)

      super({
        context: args.context,
        settings: args.settings,
        operation: args.operation,
        generatorKey
      })
    }

    override toString(): string {
      return 'mock operation code'
    }
  }

  return MockInsertable as any
}

// ============================================================================
// Tests
// ============================================================================

Deno.test('GqlOperationDriver', async t => {
  await t.step('Constructor and Property Initialization', async t => {
    await t.step('should initialize all required properties correctly', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.context, context)
      assertEquals(driver.insertable, insertable)
      assertEquals(driver.operation, operation)
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should initialize with all optional parameters', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './custom/path.ts',
        noExport: true
      })

      assertEquals(driver.destinationPath, './custom/path.ts')
      assertEquals(driver.noExport, true)
    })

    await t.step('should call context.toOperationContentSettings during construction', () => {
      const { context, toOperationContentSettingsSpy } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertSpyCalls(toOperationContentSettingsSpy, 1)
      assertSpyCall(toOperationContentSettingsSpy, 0, {
        args: [
          {
            operation,
            insertable
          }
        ]
      })
    })

    await t.step('should set settings from toOperationContentSettings result', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation({ fieldName: 'testOp' })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.settings.identifier.name, 'testOp')
      assertExists(driver.settings.exportPath)
    })

    await t.step('should call apply and set definition during construction', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should handle different root kinds', () => {
      const rootKinds: GqlRootKind[] = ['query', 'mutation', 'subscription']

      rootKinds.forEach(rootKind => {
        const { context } = createMockContext()
        const insertable = createMockInsertable()
        const operation = createMockOperation({ rootKind })

        const driver = new GqlOperationDriver({
          context,
          insertable,
          operation
        })

        assertEquals(driver.operation.rootKind, rootKind)
        assertExists(driver.definition)
      })
    })

    await t.step('should handle operations with different field names', () => {
      const fieldNames = ['users', 'userById', 'createPost', 'onUserChange']

      fieldNames.forEach(fieldName => {
        const { context } = createMockContext()
        const insertable = createMockInsertable()
        const operation = createMockOperation({ fieldName })

        const driver = new GqlOperationDriver({
          context,
          insertable,
          operation
        })

        assertEquals(driver.operation.fieldName, fieldName)
        assertExists(driver.definition)
      })
    })

    await t.step('should preserve enrichment type information', () => {
      const { context } = createMockContext()
      const enrichments = { customData: 'test' }
      const insertable = createMockInsertable({ enrichments })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.settings.enrichments, enrichments)
    })
  })

  await t.step('Import Registration Logic', async t => {
    await t.step('should register import when destinationPath differs from exportPath', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './api/users.ts'
      })

      assertSpyCalls(registerSpy, 2)

      const importCall = registerSpy.calls.find(call => call.args[0].imports !== undefined)

      assertExists(importCall)
      assertEquals(importCall.args[0].imports?.['./operations/getUsers.ts'], ['getUsers'])
      assertEquals(importCall.args[0].destinationPath, './api/users.ts')
    })

    await t.step('should not register import when paths match', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './operations/getUsers.ts'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should not register import when destinationPath is undefined', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should normalize paths before comparison', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations//getUsers.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './operations/getUsers.ts'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle relative vs absolute paths', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: '/absolute/path/operation.ts' })
      const operation = createMockOperation({ fieldName: 'testOp' })

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './relative/path/file.ts'
      })

      assertSpyCalls(registerSpy, 2)
      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
    })

    await t.step('should register imports with correct structure', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './ops/create.ts' })
      const operation = createMockOperation({ rootKind: 'mutation', fieldName: 'createUser' })

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './api/handlers.ts'
      })

      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)

      assertEquals(importCall.args[0], {
        imports: {
          './ops/create.ts': ['createUser']
        },
        destinationPath: './api/handlers.ts'
      })
    })

    await t.step('should normalize paths with redundant separators', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './operations//getUsers.ts'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should register multiple imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const insertable1 = createMockInsertable({ exportPath: './ops/op1.ts' })
      const insertable2 = createMockInsertable({ exportPath: './ops/op2.ts' })
      const operation1 = createMockOperation({ fieldName: 'op1' })
      const operation2 = createMockOperation({ fieldName: 'op2' })

      new GqlOperationDriver({
        context,
        insertable: insertable1,
        operation: operation1,
        destinationPath: './api/index.ts'
      })

      new GqlOperationDriver({
        context,
        insertable: insertable2,
        operation: operation2,
        destinationPath: './api/index.ts'
      })

      assertSpyCalls(registerSpy, 4)
    })
  })

  await t.step('Definition Caching', async t => {
    await t.step('should call context.findDefinition with correct arguments', () => {
      const { context, findDefinitionSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './ops/test.ts' })
      const operation = createMockOperation({ fieldName: 'testOp' })

      new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertSpyCalls(findDefinitionSpy, 1)
      assertSpyCall(findDefinitionSpy, 0, {
        args: [
          {
            name: 'testOp',
            exportPath: './ops/test.ts'
          }
        ]
      })
    })

    await t.step('should create new definition when not cached', () => {
      const { context, findDefinitionSpy } = createMockContext({
        findDefinition: undefined
      })
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertSpyCalls(findDefinitionSpy, 1)
      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should instantiate insertable with correct parameters', () => {
      const { context } = createMockContext()
      let capturedArgs: any = null

      class SpyInsertable extends GqlOperationBase<undefined> {
        static id = 'SpyInsertable'
        static type = 'operation' as const
        static toIdentifier = (op: GqlOperation) => Identifier.createVariable(op.fieldName)
        static toExportPath = () => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: GqlOperation
        }) {
          const generatorKey = toKey('SpyInsertable', args.operation)
          super({
            context: args.context,
            settings: args.settings,
            operation: args.operation,
            generatorKey
          })
          capturedArgs = args
        }

        override toString() {
          return 'test'
        }
      }

      const operation = createMockOperation({ fieldName: 'testOp' })

      new GqlOperationDriver({
        context,
        insertable: SpyInsertable as any,
        operation
      })

      assertExists(capturedArgs)
      assertEquals(capturedArgs.context, context)
      assertEquals(capturedArgs.operation, operation)
      assertExists(capturedArgs.settings)
    })

    await t.step('should wrap insertable result in Definition', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assert(driver.definition instanceof Definition)
      assertExists(driver.definition.value)
    })

    await t.step('should register definition with context', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assert(registerSpy.calls.length >= 1)
      const defCall = registerSpy.calls.find(call => call.args[0].definitions)
      assertExists(defCall)
    })

    await t.step('should pass noExport flag to Definition', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation,
        noExport: true
      })

      assertExists(driver.definition)
    })

    await t.step('should return created definition', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should use cached definition when available', () => {
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const mockContext = {} as any
      const mockSettings = new ContentSettings({
        identifier: Identifier.createVariable('cached'),
        exportPath: './test.ts',
        enrichments: undefined
      })

      const cachedValue = new insertable({
        context: mockContext,
        settings: mockSettings,
        operation
      })

      const cachedDef = new Definition({
        context: mockContext,
        identifier: Identifier.createVariable('cached'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should skip instantiation when definition cached', () => {
      let instantiated = false

      class TrackingInsertable extends GqlOperationBase<undefined> {
        static id = 'TrackingInsertable'
        static type = 'operation' as const
        static toIdentifier = (op: GqlOperation) => Identifier.createVariable(op.fieldName)
        static toExportPath = () => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: GqlOperation
        }) {
          const generatorKey = toKey('TrackingInsertable', args.operation)
          super({
            context: args.context,
            settings: args.settings,
            operation: args.operation,
            generatorKey
          })
          instantiated = true
        }

        override toString() {
          return 'test'
        }
      }

      const operation = createMockOperation()

      const tempValue = new TrackingInsertable({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('cached'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      instantiated = false

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('cached'),
        value: tempValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      new GqlOperationDriver({
        context,
        insertable: TrackingInsertable as any,
        operation
      })

      assertEquals(instantiated, false)
    })

    await t.step('should preserve settings when using cached definition', () => {
      const operation = createMockOperation({ fieldName: 'testOp' })
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('cached'),
        value: {
          generatorKey: toKey('MockInsertable', operation),
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const insertable = createMockInsertable()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.settings.identifier.name, 'testOp')
      assertExists(driver.settings.exportPath)
    })
  })

  await t.step('Cache Validation (affirmDefinition)', async t => {
    await t.step('should return false for undefined definition', () => {
      const { context } = createMockContext({
        findDefinition: undefined
      })
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should return true for valid cached definition', () => {
      const operation = createMockOperation()
      const insertable = createMockInsertable()

      const cachedValue = new insertable({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw error on generator key mismatch', () => {
      const operation = createMockOperation()
      const insertable = createMockInsertable({ id: 'MockInsertable' })

      const differentInsertable = createMockInsertable({ id: 'DifferentGenerator' })

      const cachedValue = new differentInsertable({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      assertThrows(
        () => {
          new GqlOperationDriver({
            context,
            insertable,
            operation
          })
        },
        Error,
        'Registered definition mismatch'
      )
    })

    await t.step('should include operation details in error message', () => {
      const operation = createMockOperation({ fieldName: 'testOperation', rootKind: 'query' })
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('testOperation'),
        value: {
          generatorKey: toKey('DifferentGenerator', operation),
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const insertable = createMockInsertable({
        id: 'MockInsertable',
        exportPath: './ops/test.ts'
      })

      assertThrows(
        () => {
          new GqlOperationDriver({
            context,
            insertable,
            operation
          })
        },
        Error,
        'testOperation'
      )
    })

    await t.step('should include both keys in error message', () => {
      const operation = createMockOperation()
      const cachedKey = toKey('CachedGenerator', operation)
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: {
          generatorKey: cachedKey,
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const insertable = createMockInsertable({ id: 'NewGenerator' })

      let errorMessage = ''
      try {
        new GqlOperationDriver({
          context,
          insertable,
          operation
        })
      } catch (error) {
        errorMessage = (error as Error).message
      }

      assert(errorMessage.includes('CachedGenerator'))
      assert(errorMessage.includes('NewGenerator'))
    })

    await t.step('should validate generator key format', () => {
      const operation = createMockOperation({ rootKind: 'query', fieldName: 'test' })
      const insertable = createMockInsertable({ id: 'TestGen' })

      const { context } = createMockContext()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      const key = driver.definition.generatorKey as unknown as string
      assertExists(key)
      assert(key.includes('TestGen'))
      assert(key.includes('query'))
      assert(key.includes('test'))
    })

    await t.step('should handle edge case of wrong value type', () => {
      const operation = createMockOperation()
      const wrongDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: {
          generatorKey: 'wrong-type-key',
          toString: () => 'wrong'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: wrongDef
      })
      const insertable = createMockInsertable()

      assertThrows(() => {
        new GqlOperationDriver({
          context,
          insertable,
          operation
        })
      })
    })
  })

  await t.step('Generator Key Management', async t => {
    await t.step('should create correct operation generator key format', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable({ id: 'TestGenerator' })
      const operation = createMockOperation({
        rootKind: 'mutation',
        fieldName: 'updateUser'
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      const key = driver.definition.generatorKey as unknown as string

      assertExists(key)
      assert(key.includes('TestGenerator'))
      assert(key.includes('mutation'))
      assert(key.includes('updateUser'))
    })

    await t.step('should use generator key for cache validation', () => {
      const operation = createMockOperation()
      const insertable = createMockInsertable()

      const cachedValue = new insertable({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw on key collision with different generator', () => {
      const operation = createMockOperation()
      const wrongKey = toKey('DifferentGenerator', operation)
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: {
          generatorKey: wrongKey,
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const insertable = createMockInsertable({ id: 'MockInsertable' })

      assertThrows(() => {
        new GqlOperationDriver({
          context,
          insertable,
          operation
        })
      })
    })

    await t.step('should include generatorId, rootKind, and fieldName in key', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable({ id: 'CustomGen' })
      const operation = createMockOperation({
        rootKind: 'subscription',
        fieldName: 'onResourceChange'
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      const key = driver.definition.generatorKey as unknown as string

      assertExists(key)
      assert(key.includes('CustomGen'))
      assert(key.includes('subscription'))
      assert(key.includes('onResourceChange'))
    })
  })

  await t.step('Integration and Lifecycle Tests', async t => {
    await t.step('should complete full construction to definition flow', () => {
      const { context, toOperationContentSettingsSpy, findDefinitionSpy, registerSpy } =
        createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertSpyCalls(toOperationContentSettingsSpy, 1)
      assertSpyCalls(findDefinitionSpy, 1)
      assert(registerSpy.calls.length >= 1)
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should handle multiple drivers with same operation (caching)', () => {
      const operation = createMockOperation()
      const insertable = createMockInsertable()

      const cachedValue = new insertable({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver1 = new GqlOperationDriver({ context, insertable, operation })
      const driver2 = new GqlOperationDriver({ context, insertable, operation })

      assertEquals(driver1.definition, cachedDef)
      assertEquals(driver2.definition, cachedDef)
    })

    await t.step('should create separate definitions for different operations', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation1 = createMockOperation({ fieldName: 'op1', rootKind: 'query' })
      const operation2 = createMockOperation({ fieldName: 'op2', rootKind: 'mutation' })

      const driver1 = new GqlOperationDriver({
        context,
        insertable,
        operation: operation1
      })
      const driver2 = new GqlOperationDriver({
        context,
        insertable,
        operation: operation2
      })

      assert(driver1.definition !== driver2.definition)
      assert(driver1.definition.generatorKey !== driver2.definition.generatorKey)
    })

    await t.step('should register cross-file imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './api/index.ts'
      })

      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
      assertEquals(importCall.args[0].imports?.['./operations/getUsers.ts'], ['getUsers'])
      assertEquals(importCall.args[0].destinationPath, './api/index.ts')
    })

    await t.step('should not register imports for same-file definitions', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable({ exportPath: './operations/users.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './operations/users.ts'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle noExport flag throughout lifecycle', () => {
      const { context, registerSpy } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation,
        noExport: true
      })

      assertEquals(driver.noExport, true)
      assertExists(driver.definition)
      assert(registerSpy.calls.length >= 1)
    })

    await t.step('should preserve generic type information', () => {
      interface CustomEnrichment {
        metadata: string
      }

      const { context } = createMockContext()
      const insertable = createMockInsertable({
        enrichments: { metadata: 'test' } as CustomEnrichment
      })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver<GeneratedValue, CustomEnrichment>({
        context,
        insertable: insertable as any,
        operation
      })

      assertExists(driver.settings)
      assertExists(driver.definition)
    })
  })

  await t.step('Edge Cases and Error Handling', async t => {
    await t.step('should handle field names with special characters', () => {
      const { context } = createMockContext()
      const insertable = createMockInsertable()
      const operation = createMockOperation({
        fieldName: 'get_users_by_id_v2'
      })

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation
      })

      assertExists(driver.definition)
      assertEquals(driver.settings.identifier.name, 'get_users_by_id_v2')
    })

    await t.step('should handle very long export paths', () => {
      const { context } = createMockContext()
      const longPath =
        './very/long/path/to/operations/in/deeply/nested/directory/structure/operation.ts'
      const insertable = createMockInsertable({ exportPath: longPath })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        insertable,
        operation,
        destinationPath: './index.ts'
      })

      assertExists(driver.definition)
    })

    await t.step('should throw descriptive errors on failures', () => {
      const operation = createMockOperation()
      const wrongKey = toKey('WrongGenerator', operation)
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('test'),
        value: {
          generatorKey: wrongKey,
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const insertable = createMockInsertable({ id: 'CorrectGenerator' })

      let errorThrown = false
      let errorMessage = ''
      try {
        new GqlOperationDriver({
          context,
          insertable,
          operation
        })
      } catch (error) {
        errorThrown = true
        errorMessage = (error as Error).message
      }

      assert(errorThrown)
      assert(errorMessage.length > 0)
      assert(errorMessage.includes('generator key') || errorMessage.includes('mismatch'))
    })
  })
})
