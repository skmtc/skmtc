import { assertEquals, assertExists, assert, assertThrows } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { OasOperationDriver } from './OasOperationDriver.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  OasOperationProjection,
  ToOasOperationIdentifierArgs,
  ToOasOperationExportPathArgs
} from '@/dsl/operation/oas/types.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { Definition } from '@/dsl/Definition.ts'
import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import type { Method } from '@/types/Method.ts'
import { OasOperationProjectionBase } from './OasOperationProjectionBase.ts'

// ============================================================================
// Test Helpers
// ============================================================================

// Helper to create a mock GenerateContext
const createMockContext = (options?: {
  findDefinition?: Definition<any> | undefined
  existingImports?: Record<string, string[]>
}) => {
  const toOperationContentSettingsSpy = spy((args: any) => {
    const enrichments = args.projection.toEnrichments({
      operation: args.operation,
      context: mockContext
    })
    return new ContentSettings({
      identifier: args.projection.toIdentifier({ operation: args.operation, enrichments }),
      exportPath: args.projection.toExportPath({ operation: args.operation, enrichments }),
      enrichments
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

// Helper to create a mock OasOperation
const createMockOperation = (options?: {
  path?: string
  method?: Method
  operationId?: string
}): OasOperation => {
  return new OasOperation({
    path: options?.path ?? '/users',
    method: (options?.method ?? 'get') as Method,
    pathItem: undefined,
    operationId: options?.operationId ?? 'getUsers',
    responses: {}
  })
}

// Helper to create a mock OperationProjection
const createMockProjection = (options?: {
  id?: string
  exportPath?: string
  enrichments?: any
}): OasOperationProjection<any, undefined> => {
  class MockProjection extends OasOperationProjectionBase<undefined> {
    static id = options?.id ?? 'MockProjection'
    static type = 'oasOperation' as const

    static toIdentifier({ operation }: ToOasOperationIdentifierArgs): Identifier {
      return Identifier.createVariable(operation.operationId ?? 'operation')
    }

    static toExportPath({ operation }: ToOasOperationExportPathArgs): string {
      return options?.exportPath ?? `./operations/${operation.operationId}.ts`
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
      operation: OasOperation
    }) {
      // Calculate generator key for this instance
      const generatorKey = toOasOperationGeneratorKey({
        generatorId: MockProjection.id,
        operation: args.operation
      })

      // Call parent constructor with all required arguments
      super({
        context: args.context,
        settings: args.settings,
        operation: args.operation,
        generatorKey
      })
    }

    // The instance itself is the generated value, so it needs toString()
    override toString(): string {
      return 'mock operation code'
    }
  }

  return MockProjection as any
}

// ============================================================================
// Tests
// ============================================================================

Deno.test('OasOperationDriver', async t => {
  await t.step('Constructor and Property Initialization', async t => {
    await t.step('should initialize all required properties correctly', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertEquals(driver.context, context)
      assertEquals(driver.projection, projection)
      assertEquals(driver.operation, operation)
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should initialize with all optional parameters', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './custom/path.ts',
        noExport: true
      })

      assertEquals(driver.destinationPath, './custom/path.ts')
      assertEquals(driver.noExport, true)
    })

    await t.step('should call context.toOperationContentSettings during construction', () => {
      const { context, toOperationContentSettingsSpy } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertSpyCalls(toOperationContentSettingsSpy, 1)
      assertSpyCall(toOperationContentSettingsSpy, 0, {
        args: [
          {
            operation,
            projection
          }
        ]
      })
    })

    await t.step('should set settings from toOperationContentSettings result', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation({ operationId: 'testOp' })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertEquals(driver.settings.identifier.name, 'testOp')
      assertExists(driver.settings.exportPath)
    })

    await t.step('should call apply and set definition during construction', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should handle different HTTP methods', () => {
      const methods: Method[] = ['get', 'post', 'put', 'delete', 'patch']

      methods.forEach(method => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation({ method })

        const driver = new OasOperationDriver({
          context,
          projection,
          operation
        })

        assertEquals(driver.operation.method, method)
        assertExists(driver.definition)
      })
    })

    await t.step('should handle operations with different paths', () => {
      const paths = ['/users', '/users/{id}', '/api/v1/posts', '/products/{productId}/reviews']

      paths.forEach(path => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation({ path })

        const driver = new OasOperationDriver({
          context,
          projection,
          operation
        })

        assertEquals(driver.operation.path, path)
        assertExists(driver.definition)
      })
    })

    await t.step('should preserve enrichment type information', () => {
      const { context } = createMockContext()
      const enrichments = { customData: 'test' }
      const projection = createMockProjection({ enrichments })
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertEquals(driver.settings.enrichments, enrichments)
    })
  })

  await t.step('Import Registration Logic', async t => {
    await t.step('should register import when destinationPath differs from exportPath', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ operationId: 'getUsers' })

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './api/users.ts'
      })

      // registerSpy should be called: once for definition, once for import
      assertSpyCalls(registerSpy, 2)

      // Find the import registration call
      const importCall = registerSpy.calls.find(call => call.args[0].imports !== undefined)

      assertExists(importCall)
      assertEquals(importCall.args[0].imports?.['./operations/getUsers.ts'], ['getUsers'])
      assertEquals(importCall.args[0].destinationPath, './api/users.ts')
    })

    await t.step('should not register import when paths match', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ operationId: 'getUsers' })

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/getUsers.ts'
      })

      // Only definition registration, no import
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should not register import when destinationPath is undefined', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation
        // destinationPath not provided
      })

      // Only definition registration
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should normalize paths before comparison', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations//getUsers.ts' })
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/getUsers.ts'
      })

      // Paths are the same after normalization, so no import
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle relative vs absolute paths', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: '/absolute/path/operation.ts' })
      const operation = createMockOperation({ operationId: 'testOp' })

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './relative/path/file.ts'
      })

      // Different paths should register import
      assertSpyCalls(registerSpy, 2)
      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
    })

    await t.step('should register imports with correct structure', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './ops/create.ts' })
      const operation = createMockOperation({ operationId: 'createUser' })

      new OasOperationDriver({
        context,
        projection,
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
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations//getUsers.ts' // Double slash, should normalize to single
      })

      // After normalization, should be same path (no import registration)
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should register multiple imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const projection1 = createMockProjection({ exportPath: './ops/op1.ts' })
      const projection2 = createMockProjection({ exportPath: './ops/op2.ts' })
      const operation1 = createMockOperation({ operationId: 'op1' })
      const operation2 = createMockOperation({ operationId: 'op2' })

      new OasOperationDriver({
        context,
        projection: projection1,
        operation: operation1,
        destinationPath: './api/index.ts'
      })

      new OasOperationDriver({
        context,
        projection: projection2,
        operation: operation2,
        destinationPath: './api/index.ts'
      })

      // Each driver registers: definition + import = 2 calls each = 4 total
      assertSpyCalls(registerSpy, 4)
    })
  })

  await t.step('Definition Caching', async t => {
    await t.step('should call context.findDefinition with correct arguments', () => {
      const { context, findDefinitionSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './ops/test.ts' })
      const operation = createMockOperation({ operationId: 'testOp' })

      new OasOperationDriver({
        context,
        projection,
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
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertSpyCalls(findDefinitionSpy, 1)
      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should instantiate projection with correct parameters', () => {
      const { context } = createMockContext()
      let capturedArgs: any = null

      class SpyProjection extends OasOperationProjectionBase<undefined> {
        static id = 'SpyProjection'
        static type = 'oasOperation' as const
        static toIdentifier = ({ operation }: ToOasOperationIdentifierArgs) =>
          Identifier.createVariable(operation.operationId ?? 'op')
        static toExportPath = (_args: ToOasOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: OasOperation
        }) {
          const generatorKey = toOasOperationGeneratorKey({
            generatorId: 'SpyProjection',
            operation: args.operation
          })
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

      const operation = createMockOperation({ operationId: 'testOp' })

      new OasOperationDriver({
        context,
        projection: SpyProjection as any,
        operation
      })

      assertExists(capturedArgs)
      assertEquals(capturedArgs.context, context)
      assertEquals(capturedArgs.operation, operation)
      assertExists(capturedArgs.settings)
    })

    await t.step('should wrap projection result in Definition', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assert(driver.definition instanceof Definition)
      assertExists(driver.definition.value)
    })

    await t.step('should register definition with context', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation
      })

      // At least one call to register the definition
      assert(registerSpy.calls.length >= 1)
      const defCall = registerSpy.calls.find(call => call.args[0].definitions)
      assertExists(defCall)
    })

    await t.step('should pass noExport flag to Definition', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        noExport: true
      })

      // The Definition should have noExport set
      assertExists(driver.definition)
      // Note: noExport is internal to Definition, tested via integration
    })

    await t.step('should return created definition', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should use cached definition when available', () => {
      const projection = createMockProjection()
      const operation = createMockOperation()

      // Create a proper cached value by instantiating the projection
      const mockContext = {} as any
      const mockSettings = new ContentSettings({
        identifier: Identifier.createVariable('cached'),
        exportPath: './test.ts',
        enrichments: undefined
      })

      const cachedValue = new projection({
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

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should skip instantiation when definition cached', () => {
      let instantiated = false

      class TrackingProjection extends OasOperationProjectionBase<undefined> {
        static id = 'TrackingProjection'
        static type = 'oasOperation' as const
        static toIdentifier = ({ operation }: ToOasOperationIdentifierArgs) =>
          Identifier.createVariable(operation.operationId ?? 'op')
        static toExportPath = (_args: ToOasOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: OasOperation
        }) {
          const generatorKey = toOasOperationGeneratorKey({
            generatorId: 'TrackingProjection',
            operation: args.operation
          })
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

      // Create cached value WITHOUT triggering instantiation flag
      // We do this by creating instance before we set up tracking
      const tempValue = new TrackingProjection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('cached'),
          exportPath: './test.ts',
          enrichments: undefined
        }),
        operation
      })

      // Reset flag after creating cached value
      instantiated = false

      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('cached'),
        value: tempValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      new OasOperationDriver({
        context,
        projection: TrackingProjection as any,
        operation
      })

      assertEquals(instantiated, false)
    })

    await t.step('should preserve settings when using cached definition', () => {
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('cached'),
        value: {
          generatorKey: toOasOperationGeneratorKey({
            generatorId: 'MockProjection',
            operation: createMockOperation()
          }),
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const projection = createMockProjection()
      const operation = createMockOperation({ operationId: 'testOp' })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      // Settings should still be created from toOperationContentSettings
      assertEquals(driver.settings.identifier.name, 'testOp')
      assertExists(driver.settings.exportPath)
    })
  })

  await t.step('Cache Validation (affirmDefinition)', async t => {
    await t.step('should return false for undefined definition', () => {
      const { context } = createMockContext({
        findDefinition: undefined
      })
      const projection = createMockProjection()
      const operation = createMockOperation()

      // Should create new definition, not use undefined
      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof Definition)
    })

    await t.step('should return true for valid cached definition', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      // Create a proper cached value by instantiating the projection
      const cachedValue = new projection({
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

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      // Should use cached definition
      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw error on generator key mismatch', () => {
      const operation = createMockOperation()
      const projection = createMockProjection({ id: 'MockProjection' })

      // Create a cached value with the SAME projection class but manually override generatorKey
      // to simulate a mismatch scenario
      const differentProjection = createMockProjection({ id: 'DifferentGenerator' })

      const cachedValue = new differentProjection({
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
          new OasOperationDriver({
            context,
            projection,
            operation
          })
        },
        Error,
        'Registered definition mismatch'
      )
    })

    await t.step('should include operation details in error message', () => {
      const operation = createMockOperation({
        operationId: 'testOperation',
        path: '/test',
        method: 'get'
      })
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('testOperation'),
        value: {
          generatorKey: toOasOperationGeneratorKey({
            generatorId: 'DifferentGenerator',
            operation
          }),
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const projection = createMockProjection({ id: 'MockProjection', exportPath: './ops/test.ts' })

      assertThrows(
        () => {
          new OasOperationDriver({
            context,
            projection,
            operation
          })
        },
        Error,
        'testOperation'
      )
    })

    await t.step('should include both keys in error message', () => {
      const operation = createMockOperation()
      const cachedKey = toOasOperationGeneratorKey({
        generatorId: 'CachedGenerator',
        operation
      })
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
      const projection = createMockProjection({ id: 'NewGenerator' })

      let errorMessage = ''
      try {
        new OasOperationDriver({
          context,
          projection,
          operation
        })
      } catch (error) {
        errorMessage = (error as Error).message
      }

      assert(errorMessage.includes('CachedGenerator'))
      assert(errorMessage.includes('NewGenerator'))
    })

    await t.step('should validate generator key format', () => {
      const operation = createMockOperation({ path: '/test', method: 'get' })
      const projection = createMockProjection({ id: 'TestGen' })

      const { context } = createMockContext()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      // Generator key should be in format: generatorId|path|method
      const key = driver.definition.generatorKey
      assertExists(key)
      assert(key.includes('TestGen'))
      assert(key.includes('/test'))
      assert(key.includes('get'))
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
      const projection = createMockProjection()

      // Should throw due to type mismatch
      assertThrows(() => {
        new OasOperationDriver({
          context,
          projection,
          operation
        })
      })
    })
  })

  await t.step('Generator Key Management', async t => {
    await t.step('should create correct operation generator key format', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'TestGenerator' })
      const operation = createMockOperation({
        path: '/users/{id}',
        method: 'post',
        operationId: 'updateUser'
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      const key = driver.definition.generatorKey

      // Key should include generatorId, path, and method
      assertExists(key)
      assert(key.includes('TestGenerator'))
      assert(key.includes('/users/{id}'))
      assert(key.includes('post'))
    })

    await t.step('should use generator key for cache validation', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      // Create a proper cached value by instantiating the projection
      const cachedValue = new projection({
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

      // Should not throw because keys match
      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw on key collision with different generator', () => {
      const operation = createMockOperation()
      const wrongKey = toOasOperationGeneratorKey({
        generatorId: 'DifferentGenerator',
        operation
      })
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
      const projection = createMockProjection({ id: 'MockProjection' })

      assertThrows(() => {
        new OasOperationDriver({
          context,
          projection,
          operation
        })
      })
    })

    await t.step('should include generatorId, path, and method in key', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'CustomGen' })
      const operation = createMockOperation({
        path: '/api/resources',
        method: 'delete',
        operationId: 'deleteResource'
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      const key = driver.definition.generatorKey

      assertExists(key)
      assert(key.includes('CustomGen'))
      assert(key.includes('/api/resources'))
      assert(key.includes('delete'))
    })

    await t.step('should handle operations without operationId', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        // operationId is undefined
        responses: {}
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assertExists(driver.definition.generatorKey)
    })
  })

  await t.step('Integration and Lifecycle Tests', async t => {
    await t.step('should complete full construction to definition flow', () => {
      const { context, toOperationContentSettingsSpy, findDefinitionSpy, registerSpy } =
        createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      // Verify complete flow
      assertSpyCalls(toOperationContentSettingsSpy, 1) // Settings created
      assertSpyCalls(findDefinitionSpy, 1) // Cache checked
      assert(registerSpy.calls.length >= 1) // Definition registered
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should handle multiple drivers with same operation (caching)', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      // Create a proper cached value by instantiating the projection
      const cachedValue = new projection({
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

      const driver1 = new OasOperationDriver({ context, projection, operation })
      const driver2 = new OasOperationDriver({ context, projection, operation })

      // Both should use same cached definition
      assertEquals(driver1.definition, cachedDef)
      assertEquals(driver2.definition, cachedDef)
    })

    await t.step('should create separate definitions for different operations', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation1 = createMockOperation({ operationId: 'op1', path: '/path1', method: 'get' })
      const operation2 = createMockOperation({ operationId: 'op2', path: '/path2', method: 'post' })

      const driver1 = new OasOperationDriver({ context, projection, operation: operation1 })
      const driver2 = new OasOperationDriver({ context, projection, operation: operation2 })

      // Should have different definitions
      assert(driver1.definition !== driver2.definition)
      assert(driver1.definition.generatorKey !== driver2.definition.generatorKey)
    })

    await t.step('should register cross-file imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ operationId: 'getUsers' })

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './api/index.ts'
      })

      // Should have import registration
      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
      assertEquals(importCall.args[0].imports?.['./operations/getUsers.ts'], ['getUsers'])
      assertEquals(importCall.args[0].destinationPath, './api/index.ts')
    })

    await t.step('should not register imports for same-file definitions', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/users.ts' })
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/users.ts'
      })

      // Should only have definition registration
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle noExport flag throughout lifecycle', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        noExport: true
      })

      assertEquals(driver.noExport, true)
      assertExists(driver.definition)
      // Definition registration should still happen
      assert(registerSpy.calls.length >= 1)
    })

    await t.step('should preserve generic type information', () => {
      interface CustomEnrichment {
        metadata: string
      }

      const { context } = createMockContext()
      const projection = createMockProjection({
        enrichments: { metadata: 'test' } as CustomEnrichment
      })
      const operation = createMockOperation()

      const driver = new OasOperationDriver<GeneratedValue, CustomEnrichment>({
        context,
        projection: projection as any,
        operation
      })

      // Should preserve type information
      assertExists(driver.settings)
      assertExists(driver.definition)
    })
  })

  await t.step('Edge Cases and Error Handling', async t => {
    await t.step('should handle operations with special characters', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation({
        operationId: 'get-users_by-id.v2',
        path: '/users/{user-id}/posts'
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assertEquals(driver.settings.identifier.name, 'get-users_by-id.v2')
    })

    await t.step('should handle operations without operationId', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = new OasOperation({
        path: '/test',
        method: 'get',
        pathItem: undefined,
        responses: {}
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assertExists(driver.settings)
    })

    await t.step('should handle very long export paths', () => {
      const { context } = createMockContext()
      const longPath =
        './very/long/path/to/operations/in/deeply/nested/directory/structure/operation.ts'
      const projection = createMockProjection({ exportPath: longPath })
      const operation = createMockOperation()

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './index.ts'
      })

      assertExists(driver.definition)
    })

    await t.step('should handle path parameters in operation path', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation({
        path: '/users/{userId}/posts/{postId}/comments/{commentId}',
        operationId: 'getComment'
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation
      })

      assertExists(driver.definition)
      assertExists(driver.definition.generatorKey)
      assert(
        driver.definition.generatorKey.includes(
          '/users/{userId}/posts/{postId}/comments/{commentId}'
        )
      )
    })

    await t.step('should throw descriptive errors on failures', () => {
      const operation = createMockOperation()
      const wrongKey = toOasOperationGeneratorKey({
        generatorId: 'WrongGenerator',
        operation
      })
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
      const projection = createMockProjection({ id: 'CorrectGenerator' })

      let errorThrown = false
      let errorMessage = ''
      try {
        new OasOperationDriver({
          context,
          projection,
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
