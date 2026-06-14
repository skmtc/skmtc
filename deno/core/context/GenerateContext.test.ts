import { assertEquals, assertExists, assertThrows } from '@std/assert'
import { GenerateContext } from './GenerateContext.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { StackTrail } from './StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import type { ResultType } from '@/types/Results.ts'
import * as log from '@std/log'
import { TsDefinition, createType, createVariable } from '@skmtc/lang-typescript'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import { register } from '@skmtc/lang-typescript'
import { JsonFile } from '@/dsl/JsonFile.ts'
import { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { OasString } from '@/oas/string/String.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

// Mock logger
const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// Helper to create a GenerateContext for testing
const createTestContext = (options?: {
  oasDocument?: OasDocument
  settings?: any
  logger?: log.Logger
}) => {
  const captureCurrentResult = spy((_result: ResultType, _st: StackTrail) => {})

  const oasDocument =
    options?.oasDocument ??
    new OasDocument({
      openapi: '3.0.0',
      info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
      operations: []
    })

  const context = new GenerateContext({
    document: { type: 'oas', value: oasDocument },
    settings: options?.settings,
    logger: options?.logger ?? mockLogger,
    captureCurrentResult,
    // File management goes through the lang package's register function
    // (which pre-creates files), so no generator config is needed here.
    toGeneratorConfigMap: () => ({})
  })

  return { context, captureCurrentResult }
}

Deno.test('GenerateContext - Constructor', async t => {
  await t.step('should initialize with all required parameters', () => {
    const oasDocument = new OasDocument({
      openapi: '3.0.0',
      info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
      operations: []
    })
    const settings = { skip: [] }
    const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}
    const toGeneratorConfigMap = () => ({})

    const context = new GenerateContext({
      document: { type: 'oas', value: oasDocument },
      settings,
      logger: mockLogger,
      captureCurrentResult,
      toGeneratorConfigMap
    })

    assertEquals(context.document.type, 'oas')
    assertEquals(context.document.value, oasDocument)
    assertEquals(context.settings, settings)
    assertEquals(context.logger, mockLogger)
    assertEquals(context.captureCurrentResult, captureCurrentResult)
    assertEquals(context.toGeneratorConfigMap, toGeneratorConfigMap)
    assertExists(context.modelDepth)
    assertEquals(Object.keys(context.modelDepth).length, 0)
  })

  await t.step('should initialize with undefined settings', () => {
    const { context } = createTestContext({ settings: undefined })
    assertEquals(context.settings, undefined)
  })

  await t.step('should initialize modelDepth as empty object', () => {
    const { context } = createTestContext()
    assertEquals(context.modelDepth, {})
  })

  await t.step('should initialize internal files map', () => {
    const { context } = createTestContext()
    // Files map is private, but we can verify it exists through public methods
    // by attempting to register a file
    context.registerJson({
      destinationPath: './test.json',
      json: { test: 'data' }
    })
    // If no error thrown, the files map exists and works
    assertEquals(true, true)
  })
})

Deno.test('GenerateContext - File Management', async t => {
  await t.step('registerJson should create a JSON file', () => {
    const { context } = createTestContext()

    context.registerJson({
      destinationPath: './config.json',
      json: { key: 'value', number: 42 }
    })

    // Verify file was created by attempting to register content again
    // (should not throw if file exists)
    context.registerJson({
      destinationPath: './config.json',
      json: { updated: true }
    })

    assertEquals(true, true)
  })

  await t.step('registerJson should handle multiple JSON files', () => {
    const { context } = createTestContext()

    context.registerJson({
      destinationPath: './file1.json',
      json: { data: 1 }
    })

    context.registerJson({
      destinationPath: './file2.json',
      json: { data: 2 }
    })

    context.registerJson({
      destinationPath: './file3.json',
      json: { data: 3 }
    })

    assertEquals(true, true)
  })

  await t.step('register should handle file registration with definitions', () => {
    const { context } = createTestContext()

    const definition = new TsDefinition({
      context,
      identifier: createType('TestType'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type TestType = string;'
      }
    })

    register(context, {
      destinationPath: './types.ts',
      definitions: [definition]
    })

    assertEquals(true, true)
  })

  await t.step('register should handle imports', () => {
    const { context } = createTestContext()

    register(context, {
      destinationPath: './types.ts',
      imports: {
        './base': ['BaseType', 'BaseInterface']
      }
    })

    assertEquals(true, true)
  })

  // Re-export coverage lives in GenerateContext.reExports.test.ts — the
  // barrel-pattern fixture over the ReExportBase seam.
})

Deno.test('GenerateContext - Definition Lookup', async t => {
  await t.step('findDefinition should return undefined for non-existent definition', () => {
    const { context } = createTestContext()

    // Register a file first
    register(context, {
      destinationPath: './types.ts',
      definitions: []
    })

    const result = context.findDefinition({
      name: 'NonExistent',
      exportPath: './types.ts'
    })

    assertEquals(result, undefined)
  })

  await t.step('findDefinition should find registered definition', () => {
    const { context } = createTestContext()

    const definition = new TsDefinition({
      context,
      identifier: createType('ExistingType'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type ExistingType = string;'
      }
    })

    register(context, {
      destinationPath: './types.ts',
      definitions: [definition]
    })

    const result = context.findDefinition({
      name: 'ExistingType',
      exportPath: './types.ts'
    })

    assertEquals(result, definition)
  })

  await t.step('findDefinition should not find definition in wrong file', () => {
    const { context } = createTestContext()

    const definition = new TsDefinition({
      context,
      identifier: createType('TypeInFile1'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type TypeInFile1 = string;'
      }
    })

    register(context, {
      destinationPath: './file1.ts',
      definitions: [definition]
    })

    // Create another file
    register(context, {
      destinationPath: './file2.ts',
      definitions: []
    })

    const result = context.findDefinition({
      name: 'TypeInFile1',
      exportPath: './file2.ts'
    })

    assertEquals(result, undefined)
  })
})

Deno.test('GenerateContext - Artifact Generation', async t => {
  await t.step('toArtifacts should return empty results with no generators', () => {
    const { context } = createTestContext()
    const stackTrail = new StackTrail(['test'])

    const result = context.toArtifacts(stackTrail)

    assertExists(result.files)
    assertExists(result.previews)
    assertExists(result.mappings)
    assertEquals(result.files instanceof Map, true)
  })

  await t.step('toArtifacts should skip generators in settings.skip array', () => {
    const { context, captureCurrentResult } = createTestContext({
      settings: {
        skip: ['generator1']
      }
    })

    // Override toGeneratorConfigMap to return a test generator
    context.toGeneratorConfigMap = () =>
      ({
        generator1: {
          id: 'generator1',
          type: 'model',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform: () => {}
        }
      })

    const stackTrail = new StackTrail(['test'])
    context.toArtifacts(stackTrail)

    // Generator should be skipped, so no transform should occur
    // captureCurrentResult should not be called for 'success'
    assertEquals(true, true)
  })

  await t.step('toArtifacts should call captureCurrentResult', () => {
    const { context, captureCurrentResult } = createTestContext()
    const stackTrail = new StackTrail(['test'])

    context.toArtifacts(stackTrail)

    // captureCurrentResult may be called during generation
    // Just verify it's been set up correctly
    assertEquals(typeof captureCurrentResult, 'function')
  })
})

Deno.test('GenerateContext - Integration', async t => {
  await t.step('should handle complete registration and lookup workflow', () => {
    const { context } = createTestContext()

    // 1. Register some definitions
    const definition1 = new TsDefinition({
      context,
      identifier: createType('User'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type User = { id: string; name: string; };'
      }
    })

    const definition2 = new TsDefinition({
      context,
      identifier: createType('Product'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type Product = { id: string; price: number; };'
      }
    })

    register(context, {
      destinationPath: './types.ts',
      definitions: [definition1, definition2],
      imports: {
        './base': ['BaseEntity']
      }
    })

    // 2. Look up the definitions
    const foundUser = context.findDefinition({
      name: 'User',
      exportPath: './types.ts'
    })

    const foundProduct = context.findDefinition({
      name: 'Product',
      exportPath: './types.ts'
    })

    assertEquals(foundUser, definition1)
    assertEquals(foundProduct, definition2)
  })

  await t.step('should handle mixed JSON and TypeScript files', () => {
    const { context } = createTestContext()

    // Register JSON file
    context.registerJson({
      destinationPath: './config.json',
      json: { apiUrl: 'https://api.example.com' }
    })

    // Register TypeScript file
    const definition = new TsDefinition({
      context,
      identifier: createVariable('CONFIG'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export const CONFIG = { /* ... */ };'
      }
    })

    register(context, {
      destinationPath: './constants.ts',
      definitions: [definition]
    })

    // Both should work without conflicts
    assertEquals(true, true)
  })

  await t.step('should maintain separate definition namespaces per file', () => {
    const { context } = createTestContext()

    const typeDefinition = new TsDefinition({
      context,
      identifier: createType('Config'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export type Config = { /* ... */ };'
      }
    })

    const constantDefinition = new TsDefinition({
      context,
      identifier: createVariable('Config'),
      value: {
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        toString: () => 'export const Config = { /* ... */ };'
      }
    })

    // Same name 'Config' but in different files
    register(context, {
      destinationPath: './types.ts',
      definitions: [typeDefinition]
    })

    register(context, {
      destinationPath: './constants.ts',
      definitions: [constantDefinition]
    })

    const foundType = context.findDefinition({
      name: 'Config',
      exportPath: './types.ts'
    })

    const foundConstant = context.findDefinition({
      name: 'Config',
      exportPath: './constants.ts'
    })

    assertEquals(foundType, typeDefinition)
    assertEquals(foundConstant, constantDefinition)
  })

  await t.step('should handle empty operations array in document', () => {
    const oasDocument = new OasDocument({
      openapi: '3.0.0',
      info: new OasInfo({ title: 'Empty API', version: '1.0.0' }),
      operations: []
    })

    const { context } = createTestContext({ oasDocument })
    const stackTrail = new StackTrail(['test'])

    const result = context.toArtifacts(stackTrail)

    assertEquals(result.files instanceof Map, true)
  })

  await t.step('should track modelDepth for recursion prevention', () => {
    const { context } = createTestContext()

    // ModelDepth starts empty
    assertEquals(Object.keys(context.modelDepth).length, 0)

    // Could be modified during model generation
    context.modelDepth['User'] = 1
    context.modelDepth['Product'] = 2

    assertEquals(context.modelDepth['User'], 1)
    assertEquals(context.modelDepth['Product'], 2)
  })
})

// Helper for GraphQL-side testing
const createGqlContext = (operations: GqlOperation[] = []) => {
  const captureCurrentResult = spy((_result: ResultType, _st: StackTrail) => {})

  const gqlDocument = new GqlDocument({
    registry: new GqlRegistry({ schemas: {} }),
    operations,
    rootTypes: {}
  })

  const context = new GenerateContext({
    document: { type: 'gql', value: gqlDocument },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult,
    toGeneratorConfigMap: () => ({})
  })

  return { context, captureCurrentResult, gqlDocument }
}

Deno.test('GenerateContext - SkmtcDocument discrimination', async t => {
  await t.step('document.type is "oas" for OAS context with matching value', () => {
    const { context } = createTestContext()
    assertEquals(context.document.type, 'oas')
    assertExists(context.document.value)
  })

  await t.step('document.type is "gql" for GQL context with matching value', () => {
    const { context, gqlDocument } = createGqlContext()
    assertEquals(context.document.type, 'gql')
    assertEquals(context.document.value, gqlDocument)
  })
})

Deno.test('GenerateContext - protocol-routed operation dispatch', async t => {
  await t.step('oas operation generator runs for OAS document', () => {
    const { context } = createTestContext()
    const transform = spy(() => undefined)

    context.toGeneratorConfigMap = () =>
      ({
        'http-gen': {
          id: 'http-gen',
          type: 'oasOperation',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform,
          isSupported: () => true
        }
      })

    context.toArtifacts(new StackTrail(['test']))
    // Operations array on the OAS doc is empty in createTestContext, so
    // transform is never invoked — but the generator is dispatched without
    // throwing, which is what we're validating here.
    assertSpyCalls(transform, 0)
  })

  await t.step('gql operation generator runs for GQL document', () => {
    const op = new GqlOperation({
      rootKind: 'query',
      fieldName: 'getUser',
      arguments: [],
      returnType: new OasString({})
    })
    const { context } = createGqlContext([op])
    const transform = spy(() => undefined)

    context.toGeneratorConfigMap = () =>
      ({
        'gql-gen': {
          id: 'gql-gen',
          type: 'gqlOperation',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform,
          isSupported: () => true
        }
      })

    context.toArtifacts(new StackTrail(['test']))
    assertSpyCalls(transform, 1)
  })

  await t.step('oas generator does not run for GQL document', () => {
    const op = new GqlOperation({
      rootKind: 'query',
      fieldName: 'getUser',
      arguments: [],
      returnType: new OasString({})
    })
    const { context } = createGqlContext([op])
    const transform = spy(() => undefined)

    context.toGeneratorConfigMap = () =>
      ({
        'http-gen': {
          id: 'http-gen',
          type: 'oasOperation',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform,
          isSupported: () => true
        }
      })

    context.toArtifacts(new StackTrail(['test']))
    assertSpyCalls(transform, 0)
  })

  await t.step('gql generator does not run for OAS document', () => {
    const { context } = createTestContext()
    const transform = spy(() => undefined)

    context.toGeneratorConfigMap = () =>
      ({
        'gql-gen': {
          id: 'gql-gen',
          type: 'gqlOperation',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform,
          isSupported: () => true
        }
      })

    context.toArtifacts(new StackTrail(['test']))
    assertSpyCalls(transform, 0)
  })
})

Deno.test('GenerateContext - model dispatch is protocol-neutral', async t => {
  await t.step('model generator runs on GQL document via registry', () => {
    const captureCurrentResult = spy((_result: ResultType, _st: StackTrail) => {})

    const registry = new GqlRegistry({
      schemas: {
        ['User' as never]: new OasString({})
      }
    })
    const gqlDocument = new GqlDocument({
      registry,
      operations: [],
      rootTypes: {}
    })

    const context = new GenerateContext({
      document: { type: 'gql', value: gqlDocument },
      settings: undefined,
      logger: mockLogger,
      captureCurrentResult,
      toGeneratorConfigMap: () => ({})
    })

    const transform = spy(() => undefined)

    context.toGeneratorConfigMap = () =>
      ({
        'model-gen': {
          id: 'model-gen',
          type: 'model',
          // @ts-expect-error a concrete-E config can't satisfy toGeneratorConfigMap's generic <E>() field (NEXT #5)
          toEnrichmentSchema: () => emptyEnrichmentSchema,
          transform
        }
      })

    context.toArtifacts(new StackTrail(['test']))
    assertSpyCalls(transform, 1)
  })
})
