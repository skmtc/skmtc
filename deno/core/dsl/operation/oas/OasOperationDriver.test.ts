import { createVariable, typescript } from '@skmtc/lang-typescript'
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
import { DefinitionBase } from '@/dsl/Definition.ts'
import { TsDefinition } from '@skmtc/lang-typescript'
import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import type { Method } from '@/types/Method.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'

// ============================================================================
// Test Helpers
// ============================================================================

// Helper to create a mock GenerateContext
const createMockContext = (options?: {
  findDefinition?: DefinitionBase<any> | undefined
  existingImports?: Record<string, string[]>
}) => {
  const toOperationContentSettingsSpy = spy((args: any) => {
    const variant: string = args.variant ?? 'main'
    const enrichments = args.projection.toEnrichments({
      operation: args.operation,
      context: mockContext,
      variant
    })
    return new ContentSettings({
      identifier: args.projection.toIdentifier({ operation: args.operation, enrichments, variant }),
      exportPath: args.projection.toExportPath({ operation: args.operation, enrichments, variant }),
      enrichments,
      variant
    })
  })

  const findDefinitionSpy = spy((_args: any) => options?.findDefinition)
  const registerSpy = spy((_args: any) => {})

  const mockContext = {
    toOperationContentSettings: toOperationContentSettingsSpy,
    findDefinition: findDefinitionSpy,
    register: registerSpy,
    // The Driver pre-ensures destination files caller-side through the
    // projection's static lang: file-miss → `addFile(lang.createFile(...))`.
    getFile: spy(() => undefined),
    addFile: spy(() => {})
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
  isSupported?: () => boolean
}): OasOperationProjection<any, undefined> => {
  class MockProjection extends SnippetBase {
    static id = options?.id ?? 'MockProjection'
    static type = 'oasOperation' as const
    // The static the Driver reads (`this.projection.lang`) — stands in for
    // the static a real projection inherits from its lang snippet base.
    static lang = typescript
    static isSupported = options?.isSupported

    static toIdentifier({ operation }: ToOasOperationIdentifierArgs): Identifier {
      return createVariable(operation.operationId ?? 'operation')
    }

    static toExportPath({ operation }: ToOasOperationExportPathArgs): string {
      return options?.exportPath ?? `./operations/${operation.operationId}.ts`
    }

    static toEnrichments(): undefined {
      return options?.enrichments
    }

    static createIdentifier(name: string): Identifier {
      return createVariable(name)
    }

    settings: ContentSettings<undefined>
    operation: OasOperation

    constructor(args: {
      context: GenerateContextType
      settings: ContentSettings<undefined>
      operation: OasOperation
    }) {
      // Calculate generator key for this instance
      const generatorKey = toOasOperationGeneratorKey({
        generatorId: MockProjection.id,
        operation: args.operation,
        variant: 'main'
      })

      super({ context: args.context, generatorKey })

      this.settings = args.settings
      this.operation = args.operation
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
        operation,
        variant: 'main'
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
        noExport: true,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assertSpyCalls(toOperationContentSettingsSpy, 1)
      assertSpyCall(toOperationContentSettingsSpy, 0, {
        args: [
          {
            operation,
            projection,
            variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof DefinitionBase)
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
          operation,
          variant: 'main'
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
          operation,
          variant: 'main'
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
        operation,
        variant: 'main'
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
        destinationPath: './api/users.ts',
        variant: 'main'
      })

      // registerSpy should be called: once for definition, once for import
      assertSpyCalls(registerSpy, 2)

      // Find the import registration call
      const importCall = registerSpy.calls.find(call => call.args[0].imports !== undefined)

      assertExists(importCall)
      assertEquals(importCall.args[0].imports[0].mergeKey(), './operations/getUsers.ts')
      assertEquals(
        importCall.args[0].imports[0].toString(),
        `import {getUsers} from './operations/getUsers.ts'`
      )
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
        destinationPath: './operations/getUsers.ts',
        variant: 'main'
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
        operation,
        // destinationPath not provided
        variant: 'main'
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
        destinationPath: './operations/getUsers.ts',
        variant: 'main'
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
        destinationPath: './relative/path/file.ts',
        variant: 'main'
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
        destinationPath: './api/handlers.ts',
        variant: 'main'
      })

      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)

      // `imports` is a standardised `ImportBase[]` built by `lang.toImport`;
      // the engine no longer sees the concise record form.
      assertEquals(importCall.args[0].imports.length, 1)
      assertEquals(importCall.args[0].imports[0].mergeKey(), './ops/create.ts')
      assertEquals(
        importCall.args[0].imports[0].toString(),
        `import {createUser} from './ops/create.ts'`
      )
      assertEquals(importCall.args[0].destinationPath, './api/handlers.ts')
    })

    await t.step('should normalize paths with redundant separators', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations//getUsers.ts', // Double slash, should normalize to single
        variant: 'main'
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
        destinationPath: './api/index.ts',
        variant: 'main'
      })

      new OasOperationDriver({
        context,
        projection: projection2,
        operation: operation2,
        destinationPath: './api/index.ts',
        variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assertSpyCalls(findDefinitionSpy, 1)
      assertExists(driver.definition)
      assert(driver.definition instanceof DefinitionBase)
    })

    await t.step('should instantiate projection with correct parameters', () => {
      const { context } = createMockContext()
      let capturedArgs: any = null

      class SpyProjection extends SnippetBase {
        static id = 'SpyProjection'
        static type = 'oasOperation' as const
        static lang = typescript
        static toIdentifier = ({ operation }: ToOasOperationIdentifierArgs) =>
          createVariable(operation.operationId ?? 'op')
        static toExportPath = (_args: ToOasOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: OasOperation
        }) {
          const generatorKey = toOasOperationGeneratorKey({
            generatorId: 'SpyProjection',
            operation: args.operation,
            variant: 'main'
          })
          super({ context: args.context, generatorKey })
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assert(driver.definition instanceof DefinitionBase)
      assertExists(driver.definition.value)
    })

    await t.step('should register definition with context', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      new OasOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
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
        noExport: true,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof DefinitionBase)
    })

    await t.step('should use cached definition when available', () => {
      const projection = createMockProjection()
      const operation = createMockOperation()

      // Create a proper cached value by instantiating the projection
      const mockContext = {} as any
      const mockSettings = new ContentSettings({
        identifier: createVariable('cached'),
        exportPath: './test.ts',
        enrichments: undefined,
        variant: 'main'
      })

      const cachedValue = new projection({
        context: mockContext,
        settings: mockSettings,
        operation
      })

      const cachedDef = new TsDefinition({
        context: mockContext,
        identifier: createVariable('cached'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should skip instantiation when definition cached', () => {
      let instantiated = false

      class TrackingProjection extends SnippetBase {
        static id = 'TrackingProjection'
        static type = 'oasOperation' as const
        static lang = typescript
        static toIdentifier = ({ operation }: ToOasOperationIdentifierArgs) =>
          createVariable(operation.operationId ?? 'op')
        static toExportPath = (_args: ToOasOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: OasOperation
        }) {
          const generatorKey = toOasOperationGeneratorKey({
            generatorId: 'TrackingProjection',
            operation: args.operation,
            variant: 'main'
          })
          super({ context: args.context, generatorKey })
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
          identifier: createVariable('cached'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
        }),
        operation
      })

      // Reset flag after creating cached value
      instantiated = false

      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('cached'),
        value: tempValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      new OasOperationDriver({
        context,
        projection: TrackingProjection as any,
        operation,
        variant: 'main'
      })

      assertEquals(instantiated, false)
    })

    await t.step('should preserve settings when using cached definition', () => {
      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('cached'),
        value: {
          generatorKey: toOasOperationGeneratorKey({
            generatorId: 'MockProjection',
            operation: createMockOperation(),
      variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof DefinitionBase)
    })

    await t.step('should return true for valid cached definition', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      // Create a proper cached value by instantiating the projection
      const cachedValue = new projection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
        }),
        operation
      })

      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
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
          identifier: createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
        }),
        operation
      })

      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
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
            operation,
            variant: 'main'
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
      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('testOperation'),
        value: {
          generatorKey: toOasOperationGeneratorKey({
            generatorId: 'DifferentGenerator',
            operation,
            variant: 'main'
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
            operation,
            variant: 'main'
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
        operation,
        variant: 'main'
        })
      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
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
          operation,
          variant: 'main'
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
        operation,
        variant: 'main'
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
      const wrongDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
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
          operation,
          variant: 'main'
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
        operation,
        variant: 'main'
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
          identifier: createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
        }),
        operation
      })

      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      // Should not throw because keys match
      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw on key collision with different generator', () => {
      const operation = createMockOperation()
      const wrongKey = toOasOperationGeneratorKey({
        generatorId: 'DifferentGenerator',
        operation,
        variant: 'main'
        })
      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
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
          operation,
          variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
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
          identifier: createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
        }),
        operation
      })

      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
        value: cachedValue
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })

      const driver1 = new OasOperationDriver({ context, projection, operation, variant: 'main' })
      const driver2 = new OasOperationDriver({ context, projection, operation, variant: 'main' })

      // Both should use same cached definition
      assertEquals(driver1.definition, cachedDef)
      assertEquals(driver2.definition, cachedDef)
    })

    await t.step('should create separate definitions for different operations', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation1 = createMockOperation({ operationId: 'op1', path: '/path1', method: 'get' })
      const operation2 = createMockOperation({ operationId: 'op2', path: '/path2', method: 'post' })

      const driver1 = new OasOperationDriver({ context, projection, operation: operation1, variant: 'main' })
      const driver2 = new OasOperationDriver({ context, projection, operation: operation2, variant: 'main' })

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
        destinationPath: './api/index.ts',
        variant: 'main'
      })

      // Should have import registration
      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
      assertEquals(importCall.args[0].imports[0].mergeKey(), './operations/getUsers.ts')
      assertEquals(
        importCall.args[0].imports[0].toString(),
        `import {getUsers} from './operations/getUsers.ts'`
      )
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
        destinationPath: './operations/users.ts',
        variant: 'main'
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
        noExport: true,
        variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
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
        destinationPath: './index.ts',
        variant: 'main'
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
        operation,
        variant: 'main'
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
        operation,
        variant: 'main'
        })
      const cachedDef = new TsDefinition({
        context: {} as any,
        identifier: createVariable('test'),
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
          operation,
          variant: 'main'
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

  await t.step('Variant validation', async t => {
    await t.step(
      "default 'main' variant succeeds even when the peer has no enrichments configured",
      () => {
        // The Driver is constructed without an explicit variant — defaults to
        // 'main'. The peer has no enrichments at all. This must succeed (it's
        // the variants-unaware path that every existing call site uses).
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation()

        const driver = new OasOperationDriver({
          context,
          projection,
          operation,
          variant: 'main'
        })

        assertExists(driver.definition)
      }
    )

    await t.step('explicit non-main variant throws when the peer has no enrichments', () => {
      // The Driver receives `variant: 'description'` but the peer has no
      // enrichment block — silent reuse of `'main'` would be the wrong thing
      // to do (caller asked deliberately). Throw at the call site instead.
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'unconfigured-peer' })
      const operation = createMockOperation()

      assertThrows(
        () =>
          new OasOperationDriver({
            context,
            projection,
            operation,
            variant: 'description'
          }),
        Error,
        "Cannot insert variant 'description'"
      )
    })

    await t.step('explicit variant throws when the peer declares a different one', () => {
      // Peer's enrichment block declares `main` + `customer`. Caller asks
      // for `description`. Throw with the available variants listed.
      const projection = createMockProjection({ id: 'peer-gen' })
      const operation = createMockOperation({ path: '/quotes/{id}', method: 'patch' })

      const { context } = createMockContext()
      // deno-lint-ignore no-explicit-any — context settings is typed minimally here
      ;(context as any).settings = {
        enrichments: {
          'peer-gen': {
            '/quotes/{id}': {
              patch: { main: {}, customer: {} }
            }
          }
        }
      }

      assertThrows(
        () =>
          new OasOperationDriver({
            context,
            projection,
            operation,
            variant: 'description'
          }),
        Error,
        'Available variants: main, customer'
      )
    })

    await t.step('explicit variant succeeds when the peer declares it', () => {
      const projection = createMockProjection({ id: 'peer-gen' })
      const operation = createMockOperation({ path: '/quotes/{id}', method: 'patch' })

      const { context } = createMockContext()
      // deno-lint-ignore no-explicit-any
      ;(context as any).settings = {
        enrichments: {
          'peer-gen': {
            '/quotes/{id}': {
              patch: { main: {}, customer: {} }
            }
          }
        }
      }

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        variant: 'customer'
      })

      assertEquals(driver.variant, 'customer')
      assertEquals(driver.settings.variant, 'customer')
    })

    await t.step(
      'variants-aware Projection that forgets to vary toIdentifier collides on second variant',
      () => {
        // A variants-aware Projection MUST incorporate variant into its
        // identifier or its (name, exportPath) cache key collides across
        // variants. The first variant's Definition lands in the file with
        // generatorKey `…|main`; the second variant builds key `…|customer`.
        // `findDefinition` hits the cached entry, `affirmDefinition`
        // compares keys, sees the variant mismatch, and throws.
        const operation = createMockOperation({ path: '/quotes/{id}', method: 'patch' })

        // Cached definition was registered as the 'main' variant — its
        // generatorKey reflects that.
        const mainKey = toOasOperationGeneratorKey({
          generatorId: 'forgetful-form',
          operation,
          variant: 'main'
        })
        const cachedDef = new TsDefinition({
          context: {} as any,
          identifier: createVariable('getQuotesForm'),
          value: {
            generatorKey: mainKey,
            toString: () => 'cached'
          } as any
        })

        const { context } = createMockContext({ findDefinition: cachedDef })
        // deno-lint-ignore no-explicit-any
        ;(context as any).settings = {
          enrichments: {
            'forgetful-form': {
              '/quotes/{id}': {
                patch: { main: {}, customer: {} }
              }
            }
          }
        }

        const projection = createMockProjection({ id: 'forgetful-form' })

        // Now construct the 'customer' variant. The Driver computes
        // generatorKey `…|customer` for this call, looks up by
        // (name, exportPath), finds the 'main' Definition, and throws
        // because keys differ.
        assertThrows(
          () =>
            new OasOperationDriver({
              context,
              projection,
              operation,
              variant: 'customer'
            }),
          Error,
          'Registered definition mismatch'
        )
      }
    )

    await t.step('destinationPath threads through alongside an explicit variant', () => {
      // `destinationPath` and `variant` are independent axes — passing
      // both should land the import-registration in the right place
      // AND build the per-variant Definition. A regression here would
      // mean variants-aware Projections that peer-compose can't
      // configure their import target.
      const projection = createMockProjection({ id: 'peer-gen' })
      const operation = createMockOperation({ path: '/quotes/{id}', method: 'patch' })

      const { context, registerSpy } = createMockContext()
      // deno-lint-ignore no-explicit-any
      ;(context as any).settings = {
        enrichments: {
          'peer-gen': {
            '/quotes/{id}': { patch: { main: {}, customer: {} } }
          }
        }
      }

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './consumer/file.ts',
        variant: 'customer'
      })

      assertEquals(driver.destinationPath, './consumer/file.ts')
      assertEquals(driver.variant, 'customer')

      // Driver registered an import into destinationPath because the
      // projection's own exportPath differs.
      const importRegistration = registerSpy.calls.find(
        c => c.args[0].destinationPath === './consumer/file.ts'
      )
      assertExists(importRegistration)
    })

    await t.step('noExport flag propagates through with an explicit variant', () => {
      const projection = createMockProjection({ id: 'peer-gen' })
      const operation = createMockOperation({ path: '/quotes/{id}', method: 'patch' })

      const { context } = createMockContext()
      // deno-lint-ignore no-explicit-any
      ;(context as any).settings = {
        enrichments: {
          'peer-gen': {
            '/quotes/{id}': { patch: { main: {}, customer: {} } }
          }
        }
      }

      const driver = new OasOperationDriver({
        context,
        projection,
        operation,
        noExport: true,
        variant: 'customer'
      })

      assertEquals(driver.noExport, true)
      assertEquals(driver.variant, 'customer')
    })
  })

  await t.step('Peer support validation', async t => {
    await t.step('insertion succeeds when the peer supports the operation', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ isSupported: () => true })
      const operation = createMockOperation()

      const driver = new OasOperationDriver({ context, projection, operation, variant: 'main' })

      assertExists(driver.definition)
    })

    await t.step('insertion throws when the peer does not support the operation', () => {
      // `insertOperation` against a peer whose `isSupported` returns
      // false must throw. Capability is not a filter — unlike skip /
      // include, which the dependency path intentionally bypasses, a
      // peer that has declared an operation unsupported cannot produce
      // a valid Definition for it. The throw unwinds into
      // GenerateContext's per-item try/catch, so the *calling*
      // generator is recorded as `error` and the run continues.
      const { context } = createMockContext()
      const projection = createMockProjection({
        id: 'unsupporting-peer',
        isSupported: () => false
      })
      const operation = createMockOperation({ path: '/reports', method: 'get' })

      assertThrows(
        () => new OasOperationDriver({ context, projection, operation, variant: 'main' }),
        Error,
        'does not support this operation'
      )
    })

    await t.step(
      'a peer with no isSupported static is treated as supporting every operation',
      () => {
        // A hand-rolled projection may omit the static entirely. Absence
        // must not false-negative — the Driver treats "no isSupported"
        // as "supports everything" (the projection-base factory default
        // is `() => true` anyway).
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation()

        const driver = new OasOperationDriver({ context, projection, operation, variant: 'main' })

        assertExists(driver.definition)
      }
    )
  })
})
