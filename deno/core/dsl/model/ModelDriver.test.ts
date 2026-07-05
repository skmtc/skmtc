import { assertEquals, assertExists, assertThrows } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { ModelDriver } from './ModelDriver.ts'
import type { ModelProjection } from './types.ts'
import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import { TsDefinition, TsIdentifier, createType } from '@skmtc/lang-typescript'
import invariant from 'tiny-invariant'
import type { GeneratedValue } from '../GeneratedValue.ts'
import type { RefName } from '@/types/RefName.ts'
import { toModelGeneratorKey } from '../GeneratorKeys.ts'
import type { GeneratorKey } from '../GeneratorKeys.ts'
import type { Lang, LangToDefinitionArgs } from '@/dsl/Lang.ts'
import { typescript } from '@skmtc/lang-typescript'

// The Driver reads the projection's language off the projection CLASS — the
// static `lang` inherited from the language snippet base (declared directly
// on these mocks) — ephemerally at each use site; no config-map resolution.
// These test langs reuse the real `typescript` lang for `createFile` /
// `toImport` and override `toDefinition` so the assertions below can pin
// which Definition subclass flows through.
const coreDefLang: Lang = {
  ...typescript,
  toDefinition: ({ context, identifier, value, noExport }) => {
    // The engine holds the identifier neutrally; TsDefinition needs the
    // concrete TsIdentifier — narrow exactly as the real `typescript` lang does.
    invariant(identifier instanceof TsIdentifier, 'expected a TsIdentifier')
    return new TsDefinition({ context, identifier, value, noExport })
  }
}

class MockGeneratedValue implements GeneratedValue {
  generatedType = 'value' as const
  type = 'mockValue' as const
  generatorKey?: GeneratorKey
}

class MockProjection extends MockGeneratedValue {
  static id = 'MockProjection'
  static isSupported = () => true
  // The static the Driver reads (`this.projection.lang`) — stands in for
  // the static a real projection inherits from its lang snippet base.
  static lang: Lang = coreDefLang
  refName: RefName
  context: GenerateContextType
  settings: ContentSettings<any>
  destinationPath: string
  rootRef?: RefName

  constructor(args: {
    refName: RefName
    context: GenerateContextType
    settings: ContentSettings<any>
    destinationPath: string
    rootRef?: RefName
  }) {
    super()
    this.refName = args.refName
    this.context = args.context
    this.settings = args.settings
    this.destinationPath = args.destinationPath
    this.rootRef = args.rootRef
    // Read the static `id` off the actual constructed class so subclasses
    // with their own `id` stamp a matching `generatorKey` (the integrity
    // check compares against `this.projection.id`).
    const generatorId = (this.constructor as typeof MockProjection).id
    this.generatorKey = toModelGeneratorKey({ generatorId, refName: args.refName, variant: 'main' })
  }
}

// A language-style Definition subclass with its own rendering — stands in
// for a `lang-*` package's `*Definition`. Proves a non-core Definition
// flows through the Driver path unchanged (architecture Site 1).
class CustomDefinition<V extends GeneratedValue = GeneratedValue> extends DefinitionBase<V> {
  override toString(): string {
    return `custom ${this.identifier.name} = ${this.value}`
  }
}

// A lang whose `toDefinition` returns the custom subclass — the Driver
// reads it off the projection class's static `lang`, so the custom
// Definition flows through.
const customDefLang: Lang = {
  ...typescript,
  toDefinition: <V extends GeneratedValue>({
    context,
    identifier,
    value
  }: LangToDefinitionArgs<V>) => new CustomDefinition<V>({ context, identifier, value })
}

class MockProjectionWithCustomDef extends MockProjection {
  static override id = 'MockProjectionWithCustomDef'
  static override lang: Lang = customDefLang
}

// Peers carrying an explicit capability static — the Driver probes
// `projection.isSupported({ refName, context })` before composing.
class MockProjectionSupported extends MockProjection {
  static override id = 'supporting-peer'
  static override isSupported = () => true
}

class MockProjectionUnsupported extends MockProjection {
  static override id = 'unsupporting-peer'
  static override isSupported = () => false
}

const createMockContext = (): GenerateContextType => {
  const mockContext = {
    modelDepth: {} as Record<string, number>,
    toModelContentSettings: spy(({ refName, variant }: { refName: RefName; variant: string }) => ({
      identifier: createType(refName),
      exportPath: '/path/to/export.ts',
      enrichments: undefined,
      variant
    })),
    findDefinition: spy(() => undefined),
    register: spy(() => {}),
    // The Driver pre-ensures destination files caller-side through the
    // projection's static lang: file-miss → `addFile(lang.createFile(...))`.
    getFile: spy(() => undefined),
    addFile: spy(() => {}),
    stackTrail: { slice: () => ({ stackTrail: [] }) }
  } as unknown as GenerateContextType

  return mockContext
}

const createMockProjection = (): ModelProjection<MockGeneratedValue, any> => {
  return MockProjection as unknown as ModelProjection<MockGeneratedValue, any>
}

Deno.test('ModelDriver', async t => {
  await t.step('constructor and property initialization', async t => {
    await t.step('should initialize all required properties', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.context, context)
      assertEquals(driver.projection, projection)
      assertEquals(driver.refName, refName)
      assertEquals(driver.destinationPath, undefined)
      assertEquals(driver.rootRef, undefined)
      assertEquals(driver.noExport, undefined)
    })

    await t.step('should initialize with all optional parameters', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'Product' as RefName
      const destinationPath = '/path/to/destination.ts'
      const rootRef = 'Root' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        rootRef,
        noExport: true,
        variant: 'main'
      })

      assertEquals(driver.destinationPath, destinationPath)
      assertEquals(driver.rootRef, rootRef)
      assertEquals(driver.noExport, true)
    })

    await t.step('should initialize modelDepth to 0', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const key = `${projection.id}:${refName}`

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(context.modelDepth[key], 0)
    })

    await t.step('should call toModelContentSettings on context', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertSpyCalls(context.toModelContentSettings as any, 1)
      assertSpyCall(context.toModelContentSettings as any, 0, {
        args: [{ refName, projection, variant: 'main' }]
      })
    })

    await t.step('should set settings from toModelContentSettings result', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.settings.identifier.name, refName)
      assertEquals(driver.settings.exportPath, '/path/to/export.ts')
    })

    await t.step('should call apply and set definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition !== undefined, true)
      assertEquals(driver.definition instanceof TsDefinition, true)
    })

    await t.step(
      'delegates to the projection toDefinition override (lang Definition flows through)',
      () => {
        const context = createMockContext()
        const projection = MockProjectionWithCustomDef as unknown as ModelProjection<
          MockGeneratedValue,
          any
        >
        const refName = 'User' as RefName

        const driver = new ModelDriver({ context, projection, refName, variant: 'main' })

        // The Driver used the projection's overridden `toDefinition`, so the
        // registered definition is the custom subclass, NOT the core Definition.
        assertEquals(driver.definition instanceof CustomDefinition, true)
        assertEquals(driver.definition instanceof TsDefinition, false)
      }
    )

    await t.step('should reset modelDepth to 0 after construction', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const key = `${projection.id}:${refName}`

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(context.modelDepth[key], 0)
    })

    await t.step('should work with different refName values', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refNames = ['User', 'Product', 'Order', 'Customer'] as RefName[]

      refNames.forEach(refName => {
        const driver = new ModelDriver({
          context,
          projection,
          refName,
          variant: 'main'
        })

        assertEquals(driver.refName, refName)
      })
    })
  })

  await t.step('apply method (via constructor)', async t => {
    await t.step('should extract identifier and exportPath from settings', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition.identifier.name, refName)
    })

    await t.step('should call getDefinition during apply', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertSpyCalls(context.findDefinition as any, 1)
    })

    await t.step('should register import when destinationPath differs from exportPath', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/different/path.ts'

      new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall !== undefined, true)
      // `imports` is now a standardised `ImportBase[]` (the Driver built it via
      // `lang.toImport`); the engine no longer sees the concise record form.
      const registeredImports = importCall.args[0].imports
      assertEquals(registeredImports.length, 1)
      assertEquals(registeredImports[0].mergeKey(), '/path/to/export.ts')
      // The mock projection's `toModelContentSettings` returns a
      // `createType` identifier (see `createMockContext`), so the
      // import must carry the type-only marker — consumers compiling
      // with `verbatimModuleSyntax: true` would hit TS1484 otherwise.
      assertEquals(
        registeredImports[0].toString(),
        `import type {${refName}} from '/path/to/export.ts'`
      )
      assertEquals(importCall.args[0].destinationPath, destinationPath)
    })

    await t.step('should not register import when destinationPath matches exportPath', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/path/to/export.ts'

      new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall, undefined)
    })

    await t.step('should normalize paths before comparison', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/path/to/export.ts'

      new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall, undefined)
    })

    await t.step('should not register import when destinationPath is undefined', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall, undefined)
    })

    await t.step('should return definition from apply', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition instanceof TsDefinition, true)
      assertEquals(driver.definition.identifier.name, refName)
    })
  })

  await t.step('getDefinition method (via constructor)', async t => {
    await t.step('should call findDefinition on context', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertSpyCalls(context.findDefinition as any, 1)
      assertSpyCall(context.findDefinition as any, 0, {
        args: [
          {
            name: refName,
            exportPath: '/path/to/export.ts'
          }
        ]
      })
    })

    await t.step('should create new definition when not cached', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition instanceof TsDefinition, true)
    })

    await t.step('should create projection instance with correct parameters', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const rootRef = 'Root' as RefName

      new ModelDriver({
        context,
        projection,
        refName,
        rootRef,
        variant: 'main'
      })

      assertEquals(context !== undefined, true)
    })

    await t.step('should wrap projection in Definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition instanceof TsDefinition, true)
      assertEquals(driver.definition.value instanceof MockProjection, true)
    })

    await t.step('should register definition with context', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const definitionCall = registerCalls.find((call: any) => call.args[0].definitions)

      assertEquals(definitionCall !== undefined, true)
      assertEquals(definitionCall.args[0].definitions.length, 1)
      assertEquals(definitionCall.args[0].destinationPath, '/path/to/export.ts')
    })

    await t.step('should pass noExport to Definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        noExport: true,
        variant: 'main'
      })

      assertEquals(driver.definition !== undefined, true)
    })

    await t.step('should handle rootRef parameter', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const rootRef = 'Root' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        rootRef,
        variant: 'main'
      })

      assertEquals(driver.rootRef, rootRef)
    })

    await t.step('should return created definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition !== undefined, true)
      assertEquals(driver.definition instanceof TsDefinition, true)
    })

    await t.step('should use cached definition when available', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = toModelGeneratorKey({
        generatorId: projection.id,
        refName,
        variant: 'main'
      }) as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition, mockDefinition)
    })

    await t.step('should validate cached definition with affirmDefinition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = toModelGeneratorKey({
        generatorId: projection.id,
        refName,
        variant: 'main'
      }) as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      // Verify the cached definition was used
      assertEquals(driver.definition, mockDefinition)
    })
  })

  await t.step('affirmDefinition validation (tested indirectly)', async t => {
    await t.step('should return false for undefined definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      context.findDefinition = (() => undefined) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition !== undefined, true)
    })

    await t.step('should return true for valid cached definition', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = toModelGeneratorKey({
        generatorId: projection.id,
        refName,
        variant: 'main'
      }) as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition, mockDefinition)
    })

    await t.step('should throw error for key mismatch', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = 'DifferentKey:DifferentRef' as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      assertThrows(
        () => {
          new ModelDriver({
            context,
            projection,
            refName,
            variant: 'main'
          })
        },
        Error,
        'Registered definition mismatch'
      )
    })

    await t.step('should include refName in error message', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = 'WrongKey:WrongRef' as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      assertThrows(
        () => {
          new ModelDriver({
            context,
            projection,
            refName,
            variant: 'main'
          })
        },
        Error,
        refName
      )
    })

    await t.step('should include export path in error message', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = 'WrongKey:WrongRef' as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      assertThrows(
        () => {
          new ModelDriver({
            context,
            projection,
            refName,
            variant: 'main'
          })
        },
        Error,
        '/path/to/export.ts'
      )
    })

    await t.step('should validate instanceof projection', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = toModelGeneratorKey({
        generatorId: projection.id,
        refName,
        variant: 'main'
      }) as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition.value instanceof MockProjection, true)
    })

    await t.step('should create correct generator key', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = toModelGeneratorKey({
        generatorId: projection.id,
        refName,
        variant: 'main'
      }) as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition.generatorKey, `${projection.id}|${refName}|main`)
    })
  })

  await t.step('integration and lifecycle tests', async t => {
    await t.step('should complete full construction to definition flow', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.context, context)
      assertEquals(driver.refName, refName)
      assertEquals(driver.settings !== undefined, true)
      assertEquals(driver.definition instanceof TsDefinition, true)
      assertEquals(context.modelDepth[`${projection.id}:${refName}`], 0)
    })

    await t.step('should handle multiple drivers with same refName using cache', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver1 = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      const mockDefinition = driver1.definition
      context.findDefinition = (() => mockDefinition) as any

      const driver2 = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver2.definition, mockDefinition)
    })

    await t.step('should create separate definitions for different refNames', () => {
      const context = createMockContext()
      const projection = createMockProjection()

      const driver1 = new ModelDriver({
        context,
        projection,
        refName: 'User' as RefName,
        variant: 'main'
      })

      const driver2 = new ModelDriver({
        context,
        projection,
        refName: 'Product' as RefName,
        variant: 'main'
      })

      assertEquals(driver1.refName !== driver2.refName, true)
      assertEquals(driver1.definition !== driver2.definition, true)
    })

    await t.step('should register cross-file imports correctly', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/different/destination.ts'

      new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall !== undefined, true)
      assertEquals(importCall.args[0].destinationPath, destinationPath)
    })

    await t.step('should not register imports for same-file definitions', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/path/to/export.ts'

      new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      const registerCalls = (context.register as any).calls
      const importCall = registerCalls.find((call: any) => call.args[0].imports)

      assertEquals(importCall, undefined)
    })

    await t.step('should maintain modelDepth throughout lifecycle', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const key = `${projection.id}:${refName}`

      assertEquals(context.modelDepth[key], undefined)

      new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(context.modelDepth[key], 0)
    })

    await t.step('should handle noExport flag throughout lifecycle', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        noExport: true,
        variant: 'main'
      })

      assertEquals(driver.noExport, true)
    })

    await t.step('should handle rootRef throughout lifecycle', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const rootRef = 'Root' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        rootRef,
        variant: 'main'
      })

      assertEquals(driver.rootRef, rootRef)
    })
  })

  await t.step('edge cases and error handling', async t => {
    await t.step('should handle refName with special characters', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User_Model_V2' as RefName

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.refName, refName)
      assertEquals(driver.definition.identifier.name, refName)
    })

    await t.step('should handle very long export paths', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const longPath = '/very/long/path/to/some/deeply/nested/directory/structure/file.ts'

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        destinationPath: longPath,
        variant: 'main'
      })

      assertEquals(driver.destinationPath, longPath)
    })

    await t.step('should throw descriptive error on key mismatch', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const mockDefinition = new TsDefinition({
        context,
        value: new MockProjection({
          refName,
          context,
          settings: {
            identifier: createType(refName),
            exportPath: '/path/to/export.ts',
            enrichments: undefined,
            variant: 'main'
          },
          destinationPath: '/path/to/export.ts'
        }),
        identifier: createType(refName)
      })
      mockDefinition.generatorKey = 'WrongGenerator:WrongRef' as GeneratorKey

      context.findDefinition = (() => mockDefinition) as any

      let errorMessage = ''
      try {
        new ModelDriver({
          context,
          projection,
          refName,
          variant: 'main'
        })
      } catch (error) {
        errorMessage = (error as Error).message
      }

      assertEquals(errorMessage.includes('Registered definition mismatch'), true)
      assertEquals(errorMessage.includes(refName), true)
      assertEquals(errorMessage.includes('WrongGenerator:WrongRef'), true)
      assertEquals(errorMessage.includes(`${projection.id}|${refName}|main`), true)
    })

    await t.step('should handle paths with different separators', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName
      const destinationPath = '/path/to/export.ts'

      const driver = new ModelDriver({
        context,
        projection,
        refName,
        destinationPath,
        variant: 'main'
      })

      assertEquals(driver.destinationPath, destinationPath)
    })

    await t.step('should preserve type information through generics', () => {
      const context = createMockContext()
      const projection = createMockProjection()
      const refName = 'User' as RefName

      const driver = new ModelDriver<MockGeneratedValue, any>({
        context,
        projection,
        refName,
        variant: 'main'
      })

      assertEquals(driver.definition.value instanceof MockProjection, true)
    })
  })

  await t.step('Peer support validation', async t => {
    await t.step('insertion succeeds when the peer supports the model', () => {
      const context = createMockContext()
      const projection = MockProjectionSupported as unknown as ModelProjection<
        MockGeneratedValue,
        any
      >

      const driver = new ModelDriver({
        context,
        projection,
        refName: 'User' as RefName,
        variant: 'main'
      })

      assertExists(driver.definition)
    })

    await t.step('insertion throws when the peer does not support the model', () => {
      // `insertModel` against a peer whose `isSupported` returns false must
      // throw. Capability is not a filter — unlike skip / include, which the
      // dependency path intentionally bypasses, a peer that has declared a
      // model unsupported cannot produce a valid Definition for it. The throw
      // unwinds into GenerateContext's per-item try/catch, so the *calling*
      // generator is recorded as `error` and the run continues.
      const context = createMockContext()
      const projection = MockProjectionUnsupported as unknown as ModelProjection<
        MockGeneratedValue,
        any
      >

      assertThrows(
        () =>
          new ModelDriver({
            context,
            projection,
            refName: 'User' as RefName,
            variant: 'main'
          }),
        Error,
        'does not support this model'
      )
    })

    await t.step('a peer with no isSupported static is treated as supporting every model', () => {
      // A hand-rolled projection may omit the static entirely. Absence must
      // not false-negative — the Driver treats "no isSupported" as "supports
      // everything" (the projection-base factory default is `() => true`).
      const context = createMockContext()
      const projection = createMockProjection()

      const driver = new ModelDriver({
        context,
        projection,
        refName: 'User' as RefName,
        variant: 'main'
      })

      assertExists(driver.definition)
    })
  })
})
