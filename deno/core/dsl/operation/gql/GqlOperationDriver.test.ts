import { typescript } from '@skmtc/lang-typescript'
import { assertEquals, assertExists, assert, assertThrows } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { GqlOperationDriver } from './GqlOperationDriver.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  GqlOperationProjection,
  ToGqlOperationIdentifierArgs,
  ToGqlOperationExportPathArgs
} from './types.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { Definition, DefinitionBase } from '@/dsl/Definition.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { GqlOperation, type GqlRootKind } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'
import { GqlOperationProjectionBase } from './GqlOperationProjectionBase.ts'

// ============================================================================
// Test Helpers
// ============================================================================

const toKey = (
  generatorId: string,
  operation: GqlOperation,
  variant: string = 'main'
): GeneratorKey =>
  `${generatorId}|${operation.rootKind}|${operation.fieldName}|${variant}` as unknown as GeneratorKey

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

const createMockProjection = (options?: {
  id?: string
  exportPath?: string
  enrichments?: any
  isSupported?: () => boolean
}): GqlOperationProjection<any, undefined> => {
  class MockProjection extends GqlOperationProjectionBase<undefined> {
    static lang = typescript
    static id = options?.id ?? 'MockProjection'
    static type = 'gqlOperation' as const
    static isSupported = options?.isSupported

    static toIdentifier({ operation }: ToGqlOperationIdentifierArgs): Identifier {
      return Identifier.createVariable(operation.fieldName)
    }

    static toExportPath({ operation }: ToGqlOperationExportPathArgs): string {
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
      const generatorKey = toKey(MockProjection.id, args.operation)

      super({
        context: args.context,
        lang: typescript,
        settings: args.settings,
        operation: args.operation,
        generatorKey
      })
    }

    override toString(): string {
      return 'mock operation code'
    }
  }

  return MockProjection as any
}

// ============================================================================
// Tests
// ============================================================================

Deno.test('GqlOperationDriver', async t => {
  await t.step('Constructor and Property Initialization', async t => {
    await t.step('should initialize all required properties correctly', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
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

      const driver = new GqlOperationDriver({
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

      new GqlOperationDriver({
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
      const operation = createMockOperation({ fieldName: 'testOp' })

      const driver = new GqlOperationDriver({
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

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertExists(driver.definition)
      assert(driver.definition instanceof DefinitionBase)
    })

    await t.step('should handle different root kinds', () => {
      const rootKinds: GqlRootKind[] = ['query', 'mutation', 'subscription']

      rootKinds.forEach(rootKind => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation({ rootKind })

        const driver = new GqlOperationDriver({
          context,
          projection,
          operation,
          variant: 'main'
        })

        assertEquals(driver.operation.rootKind, rootKind)
        assertExists(driver.definition)
      })
    })

    await t.step('should handle operations with different field names', () => {
      const fieldNames = ['users', 'userById', 'createPost', 'onUserChange']

      fieldNames.forEach(fieldName => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation({ fieldName })

        const driver = new GqlOperationDriver({
          context,
          projection,
          operation,
          variant: 'main'
        })

        assertEquals(driver.operation.fieldName, fieldName)
        assertExists(driver.definition)
      })
    })

    await t.step('should preserve enrichment type information', () => {
      const { context } = createMockContext()
      const enrichments = { customData: 'test' }
      const projection = createMockProjection({ enrichments })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
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
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './api/users.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 2)

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
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/getUsers.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should not register import when destinationPath is undefined', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should normalize paths before comparison', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations//getUsers.ts' })
      const operation = createMockOperation()

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/getUsers.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle relative vs absolute paths', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: '/absolute/path/operation.ts' })
      const operation = createMockOperation({ fieldName: 'testOp' })

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './relative/path/file.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 2)
      const importCall = registerSpy.calls.find(call => call.args[0].imports)
      assertExists(importCall)
    })

    await t.step('should register imports with correct structure', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './ops/create.ts' })
      const operation = createMockOperation({ rootKind: 'mutation', fieldName: 'createUser' })

      new GqlOperationDriver({
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

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations//getUsers.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should register multiple imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const projection1 = createMockProjection({ exportPath: './ops/op1.ts' })
      const projection2 = createMockProjection({ exportPath: './ops/op2.ts' })
      const operation1 = createMockOperation({ fieldName: 'op1' })
      const operation2 = createMockOperation({ fieldName: 'op2' })

      new GqlOperationDriver({
        context,
        projection: projection1,
        operation: operation1,
        destinationPath: './api/index.ts',
        variant: 'main'
      })

      new GqlOperationDriver({
        context,
        projection: projection2,
        operation: operation2,
        destinationPath: './api/index.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 4)
    })
  })

  await t.step('Definition Caching', async t => {
    await t.step('should call context.findDefinition with correct arguments', () => {
      const { context, findDefinitionSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './ops/test.ts' })
      const operation = createMockOperation({ fieldName: 'testOp' })

      new GqlOperationDriver({
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

      const driver = new GqlOperationDriver({
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

      class SpyProjection extends GqlOperationProjectionBase<undefined> {
        static lang = typescript
        static id = 'SpyProjection'
        static type = 'gqlOperation' as const
        static toIdentifier = ({ operation }: ToGqlOperationIdentifierArgs) =>
          Identifier.createVariable(operation.fieldName)
        static toExportPath = (_args: ToGqlOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: GqlOperation
        }) {
          const generatorKey = toKey('SpyProjection', args.operation)
          super({
            context: args.context,
            lang: typescript,
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

      const driver = new GqlOperationDriver({
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

      new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assert(registerSpy.calls.length >= 1)
      const defCall = registerSpy.calls.find(call => call.args[0].definitions)
      assertExists(defCall)
    })

    await t.step('should pass noExport flag to Definition', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        noExport: true,
        variant: 'main'
      })

      assertExists(driver.definition)
    })

    await t.step('should return created definition', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
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

      const mockContext = {} as any
      const mockSettings = new ContentSettings({
        identifier: Identifier.createVariable('cached'),
        exportPath: './test.ts',
        enrichments: undefined,
        variant: 'main'
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

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should skip instantiation when definition cached', () => {
      let instantiated = false

      class TrackingProjection extends GqlOperationProjectionBase<undefined> {
        static lang = typescript
        static id = 'TrackingProjection'
        static type = 'gqlOperation' as const
        static toIdentifier = ({ operation }: ToGqlOperationIdentifierArgs) =>
          Identifier.createVariable(operation.fieldName)
        static toExportPath = (_args: ToGqlOperationExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => Identifier.createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          operation: GqlOperation
        }) {
          const generatorKey = toKey('TrackingProjection', args.operation)
          super({
            context: args.context,
            lang: typescript,
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

      const tempValue = new TrackingProjection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('cached'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
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
        projection: TrackingProjection as any,
        operation,
        variant: 'main'
      })

      assertEquals(instantiated, false)
    })

    await t.step('should preserve settings when using cached definition', () => {
      const operation = createMockOperation({ fieldName: 'testOp' })
      const cachedDef = new Definition({
        context: {} as any,
        identifier: Identifier.createVariable('cached'),
        value: {
          generatorKey: toKey('MockProjection', operation),
          toString: () => 'cached'
        } as any
      })

      const { context } = createMockContext({
        findDefinition: cachedDef
      })
      const projection = createMockProjection()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
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
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
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

      const cachedValue = new projection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
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
        projection,
        operation,
        variant: 'main'
      })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should throw error on generator key mismatch', () => {
      const operation = createMockOperation()
      const projection = createMockProjection({ id: 'MockProjection' })

      const differentProjection = createMockProjection({ id: 'DifferentGenerator' })

      const cachedValue = new differentProjection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
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
      const projection = createMockProjection({
        id: 'MockProjection',
        exportPath: './ops/test.ts'
      })

      assertThrows(
        () => {
          new GqlOperationDriver({
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
      const projection = createMockProjection({ id: 'NewGenerator' })

      let errorMessage = ''
      try {
        new GqlOperationDriver({
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
      const operation = createMockOperation({ rootKind: 'query', fieldName: 'test' })
      const projection = createMockProjection({ id: 'TestGen' })

      const { context } = createMockContext()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
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
      const projection = createMockProjection()

      assertThrows(() => {
        new GqlOperationDriver({
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
        rootKind: 'mutation',
        fieldName: 'updateUser'
      })

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      const key = driver.definition.generatorKey as unknown as string

      assertExists(key)
      assert(key.includes('TestGenerator'))
      assert(key.includes('mutation'))
      assert(key.includes('updateUser'))
    })

    await t.step('should use generator key for cache validation', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      const cachedValue = new projection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
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
        projection,
        operation,
        variant: 'main'
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
      const projection = createMockProjection({ id: 'MockProjection' })

      assertThrows(() => {
        new GqlOperationDriver({
          context,
          projection,
          operation,
          variant: 'main'
        })
      })
    })

    await t.step('should include generatorId, rootKind, and fieldName in key', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'CustomGen' })
      const operation = createMockOperation({
        rootKind: 'subscription',
        fieldName: 'onResourceChange'
      })

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
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
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertSpyCalls(toOperationContentSettingsSpy, 1)
      assertSpyCalls(findDefinitionSpy, 1)
      assert(registerSpy.calls.length >= 1)
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should handle multiple drivers with same operation (caching)', () => {
      const operation = createMockOperation()
      const projection = createMockProjection()

      const cachedValue = new projection({
        context: {} as any,
        settings: new ContentSettings({
          identifier: Identifier.createVariable('test'),
          exportPath: './test.ts',
          enrichments: undefined,
        variant: 'main'
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

      const driver1 = new GqlOperationDriver({ context, projection, operation, variant: 'main' })
      const driver2 = new GqlOperationDriver({ context, projection, operation, variant: 'main' })

      assertEquals(driver1.definition, cachedDef)
      assertEquals(driver2.definition, cachedDef)
    })

    await t.step('should create separate definitions for different operations', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation1 = createMockOperation({ fieldName: 'op1', rootKind: 'query' })
      const operation2 = createMockOperation({ fieldName: 'op2', rootKind: 'mutation' })

      const driver1 = new GqlOperationDriver({
        context,
        projection,
        operation: operation1,
        variant: 'main'
      })
      const driver2 = new GqlOperationDriver({
        context,
        projection,
        operation: operation2,
        variant: 'main'
      })

      assert(driver1.definition !== driver2.definition)
      assert(driver1.definition.generatorKey !== driver2.definition.generatorKey)
    })

    await t.step('should register cross-file imports correctly', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './operations/getUsers.ts' })
      const operation = createMockOperation({ fieldName: 'getUsers' })

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './api/index.ts',
        variant: 'main'
      })

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

      new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './operations/users.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should handle noExport flag throughout lifecycle', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        noExport: true,
        variant: 'main'
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
      const projection = createMockProjection({
        enrichments: { metadata: 'test' } as CustomEnrichment
      })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver<GeneratedValue, CustomEnrichment>({
        context,
        projection: projection as any,
        operation,
        variant: 'main'
      })

      assertExists(driver.settings)
      assertExists(driver.definition)
    })
  })

  await t.step('Edge Cases and Error Handling', async t => {
    await t.step('should handle field names with special characters', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const operation = createMockOperation({
        fieldName: 'get_users_by_id_v2'
      })

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        variant: 'main'
      })

      assertExists(driver.definition)
      assertEquals(driver.settings.identifier.name, 'get_users_by_id_v2')
    })

    await t.step('should handle very long export paths', () => {
      const { context } = createMockContext()
      const longPath =
        './very/long/path/to/operations/in/deeply/nested/directory/structure/operation.ts'
      const projection = createMockProjection({ exportPath: longPath })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({
        context,
        projection,
        operation,
        destinationPath: './index.ts',
        variant: 'main'
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
      const projection = createMockProjection({ id: 'CorrectGenerator' })

      let errorThrown = false
      let errorMessage = ''
      try {
        new GqlOperationDriver({
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

  await t.step('Peer support validation', async t => {
    await t.step('insertion succeeds when the peer supports the operation', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ isSupported: () => true })
      const operation = createMockOperation()

      const driver = new GqlOperationDriver({ context, projection, operation, variant: 'main' })

      assertExists(driver.definition)
    })

    await t.step('insertion throws when the peer does not support the operation', () => {
      // GraphQL counterpart to the OAS-side check — see OasOperationDriver
      // for the full rationale. A peer whose `isSupported` returns false
      // cannot produce a valid Definition; the Driver throws so the
      // calling generator is recorded as `error`.
      const { context } = createMockContext()
      const projection = createMockProjection({
        id: 'unsupporting-peer',
        isSupported: () => false
      })
      const operation = createMockOperation({ rootKind: 'mutation', fieldName: 'archiveReport' })

      assertThrows(
        () => new GqlOperationDriver({ context, projection, operation, variant: 'main' }),
        Error,
        'does not support this operation'
      )
    })

    await t.step(
      'a peer with no isSupported static is treated as supporting every operation',
      () => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const operation = createMockOperation()

        const driver = new GqlOperationDriver({ context, projection, operation, variant: 'main' })

        assertExists(driver.definition)
      }
    )
  })
})
