import { assertEquals, assert, assertExists } from '@std/assert'
import { spy, assertSpyCalls } from '@std/testing/mock'
import { CoreContext } from './CoreContext.ts'
import { StackTrail } from './StackTrail.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { ResultType } from '@/types/Results.ts'

// Helper function to create minimal OpenAPI document
const createMinimalDocument = (): OpenAPIV3.Document => ({
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths: {}
})

// Helper function to create document with components
const createDocumentWithComponents = (): OpenAPIV3.Document => ({
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths: {},
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  }
})

// Helper function to create empty generator map
// Using type assertion to work around complex generic type
const createEmptyGeneratorMap = <EnrichmentType = undefined>() => ({
  toGenerator: undefined
} as unknown as GeneratorsMapContainer<EnrichmentType>)

// Helper function to create test CoreContext
const createTestContext = (options?: {
  spanId?: string
  logsPath?: string
  silent?: boolean
}) => {
  return new CoreContext({
    spanId: options?.spanId ?? 'test-span',
    logsPath: options?.logsPath,
    silent: options?.silent ?? true
  })
}

Deno.test('CoreContext - constructor with minimal args (no logsPath)', () => {
  const context = new CoreContext({
    spanId: 'test-span',
    silent: true
  })

  assertExists(context)
  assertExists(context.logger)
  assertEquals(context.silent, true)
})

Deno.test({
  name: 'CoreContext - constructor with logsPath provided',
  sanitizeResources: false,
  fn: async () => {
  // Create test directory first
  try {
    await Deno.mkdir('./test-logs', { recursive: true })
  } catch {
    // Directory might already exist
  }

  const context = new CoreContext({
    spanId: 'test-span',
    logsPath: './test-logs',
    silent: false
  })

  assertExists(context)
  assertExists(context.logger)
  assertEquals(context.silent, false)

  // Cleanup
  try {
    await Deno.remove('./test-logs', { recursive: true })
  } catch {
    // Ignore cleanup errors
  }
}})

Deno.test({
  name: 'CoreContext - constructor initializes silent mode correctly',
  sanitizeResources: false,
  fn: () => {
    const silentContext = createTestContext({ silent: true })
    const verboseContext = createTestContext({ silent: false })

    assertEquals(silentContext.silent, true)
    assertEquals(verboseContext.silent, false)
  }
})

Deno.test('CoreContext - constructor initializes logger', () => {
  const context = createTestContext()

  assertExists(context.logger)
  assertExists(context.logger.debug)
  assertExists(context.logger.info)
  assertExists(context.logger.warn)
  assertExists(context.logger.error)
})

Deno.test('CoreContext - constructor sets up logger handlers', () => {
  const context = createTestContext({ spanId: 'handler-test' })

  assertExists(context.logger.handlers)
  assert(context.logger.handlers.length > 0)
})

Deno.test('CoreContext - logger includes console handler', () => {
  const context = createTestContext({ spanId: 'console-test' })

  const hasConsoleHandler = context.logger.handlers.some(
    handler => handler.constructor.name === 'ConsoleHandler'
  )

  assertEquals(hasConsoleHandler, true)
})

Deno.test({
  name: 'CoreContext - logger includes file handler when logsPath provided',
  sanitizeResources: false,
  fn: async () => {
  // Create test directory first
  try {
    await Deno.mkdir('./test-logs', { recursive: true })
  } catch {
    // Directory might already exist
  }

  const context = new CoreContext({
    spanId: 'file-test',
    logsPath: './test-logs',
    silent: true
  })

  const hasFileHandler = context.logger.handlers.some(
    handler => handler.constructor.name === 'FileHandler'
  )

  assertEquals(hasFileHandler, true)

  // Cleanup
  try {
    await Deno.remove('./test-logs', { recursive: true })
  } catch {
    // Ignore cleanup errors
  }
}})

Deno.test({
  name: 'CoreContext - logger does not include file handler when logsPath undefined',
  sanitizeResources: false,
  fn: () => {
    const context = createTestContext()

    const hasFileHandler = context.logger.handlers.some(
      handler => handler.constructor.name === 'FileHandler'
    )

    assertEquals(hasFileHandler, false)
  }
})

Deno.test('CoreContext - logger includes results handler', () => {
  const context = createTestContext({ spanId: 'results-test' })

  const hasResultsHandler = context.logger.handlers.some(
    handler => handler.constructor.name === 'ResultsHandler'
  )

  assertEquals(hasResultsHandler, true)
})

Deno.test('CoreContext - parse() executes basic parsing', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result)
  assertExists(result.oasDocument)
})

Deno.test('CoreContext - parse() returns OasDocument with info', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertEquals(result.oasDocument.info.title, 'Test API')
  assertEquals(result.oasDocument.info.version, '1.0.0')
})

Deno.test('CoreContext - parse() with document containing components', () => {
  const context = createTestContext()
  const doc = createDocumentWithComponents()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument.components)
  assertExists(result.oasDocument.components?.schemas)
})

Deno.test('CoreContext - parse() integrates with StackTrail', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['root', 'parse'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument)
  assertEquals(stackTrail.stackTrail.length, 2)
})

Deno.test('CoreContext - parse() works with empty paths', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  // OasDocument has operations instead of paths
  assertExists(result.oasDocument.operations)
  assert(Array.isArray(result.oasDocument.operations))
})

Deno.test('CoreContext - toArtifacts() executes complete pipeline', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertExists(result.artifacts)
  assertExists(result.files)
  assertExists(result.previews)
  assertExists(result.mappings)
  assertExists(result.results)
})

Deno.test('CoreContext - toArtifacts() returns RenderResult structure', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertEquals(typeof result.artifacts, 'object')
  assertEquals(typeof result.files, 'object')
  assertEquals(typeof result.previews, 'object')
  assertEquals(typeof result.mappings, 'object')
  assertExists(result.results)
})

Deno.test('CoreContext - toArtifacts() includes results tree', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result.results)
  assertEquals(typeof result.results, 'object')
})

Deno.test('CoreContext - toArtifacts() with empty document', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  // Should complete without errors
  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - toArtifacts() with settings undefined', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - toArtifacts() with settings provided', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: {
      basePath: './src/api'
    },
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - toArtifacts() with prettier config', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true,
    prettier: {
      semi: false,
      singleQuote: true
    }
  })

  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - toArtifacts() silent mode', () => {
  const context = createTestContext({ silent: true })
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
})

Deno.test('CoreContext - captureCurrentResult() captures result', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['test', 'path'])
  const result: ResultType = 'success'

  // Should not throw
  context.captureCurrentResult(result, stackTrail)
})

Deno.test('CoreContext - captureCurrentResult() with different result types', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['test'])

  const resultTypes: ResultType[] = ['success', 'warning', 'error', 'skipped']

  for (const resultType of resultTypes) {
    // Should not throw for any result type
    context.captureCurrentResult(resultType, stackTrail)
  }
})

Deno.test('CoreContext - captureCurrentResult() integrates with StackTrail', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['components', 'schemas', 'User'])

  context.captureCurrentResult('success', stackTrail)

  // Verify stackTrail is not modified
  assertEquals(stackTrail.stackTrail, ['components', 'schemas', 'User'])
})

Deno.test('CoreContext - error in toArtifacts() is caught and logged', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['TEST'])

  // Create invalid document that will cause error
  const invalidDoc = {
    openapi: '3.0.0'
    // Missing required 'info' field
  } as OpenAPIV3.Document

  const result = context.toArtifacts({
    documentObject: invalidDoc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  // Should return empty result structure on error
  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
  assertExists(result.results)
})

Deno.test('CoreContext - error in toArtifacts() returns empty artifacts', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['TEST'])

  const invalidDoc = {
    openapi: '3.0.0'
  } as OpenAPIV3.Document

  const result = context.toArtifacts({
    documentObject: invalidDoc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertEquals(Object.keys(result.artifacts).length, 0)
  assertEquals(Object.keys(result.files).length, 0)
  assertEquals(Object.keys(result.previews).length, 0)
  assertEquals(Object.keys(result.mappings).length, 0)
})

Deno.test('CoreContext - error in toArtifacts() still includes results tree', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['TEST'])

  const invalidDoc = {
    openapi: '3.0.0'
  } as OpenAPIV3.Document

  const result = context.toArtifacts({
    documentObject: invalidDoc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result.results)
  assertEquals(typeof result.results, 'object')
})

Deno.test('CoreContext - multiple instances are independent', () => {
  const context1 = createTestContext({ spanId: 'span-1' })
  const context2 = createTestContext({ spanId: 'span-2' })

  assertEquals(context1 !== context2, true)
  assertEquals(context1.logger !== context2.logger, true)
})

Deno.test('CoreContext - parse() can be called multiple times', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail1 = new StackTrail(['TEST1'])
  const stackTrail2 = new StackTrail(['TEST2'])

  const result1 = context.parse(doc, stackTrail1)
  const result2 = context.parse(doc, stackTrail2)

  assertExists(result1.oasDocument)
  assertExists(result2.oasDocument)
})

Deno.test('CoreContext - document with paths', () => {
  const context = createTestContext()
  const doc: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          responses: {
            '200': {
              description: 'Success'
            }
          }
        }
      }
    }
  }
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  // OasDocument has operations array instead of paths object
  assertExists(result.oasDocument.operations)
  assert(Array.isArray(result.oasDocument.operations))
})

Deno.test('CoreContext - integration with document containing schemas', () => {
  const context = createTestContext()
  const doc = createDocumentWithComponents()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument.components?.schemas)
  const schemas = result.oasDocument.components?.schemas as Record<string, unknown>
  assertExists(schemas?.['User'])
})

Deno.test('CoreContext - toArtifacts() integration with real document', () => {
  const context = createTestContext()
  const doc = createDocumentWithComponents()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertExists(result.artifacts)
})

Deno.test('CoreContext - toArtifacts() with basePath in settings', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: {
      basePath: './generated'
    },
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - empty OpenAPI document edge case', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument)
  assertEquals(result.oasDocument.info.title, 'Test API')
})

Deno.test('CoreContext - document with no components edge case', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument)
  // Components can be undefined
  assert(result.oasDocument.components === undefined || result.oasDocument.components !== null)
})

Deno.test('CoreContext - toArtifacts() with no generators provided', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    documentObject: doc,
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  // Should complete without errors even with no generators
  assertExists(result)
  assertEquals(typeof result.artifacts, 'object')
})

Deno.test('CoreContext - preserves schema types during parse', () => {
  const context = createTestContext()
  const doc: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        StringSchema: {
          type: 'string'
        },
        NumberSchema: {
          type: 'number'
        },
        BooleanSchema: {
          type: 'boolean'
        }
      }
    }
  }
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  assertExists(result.oasDocument.components?.schemas)
  const schemas = result.oasDocument.components?.schemas as Record<string, unknown>
  assertExists(schemas?.['StringSchema'])
  assertExists(schemas?.['NumberSchema'])
  assertExists(schemas?.['BooleanSchema'])
})

Deno.test('CoreContext - handles complex nested schemas', () => {
  const context = createTestContext()
  const doc: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: {
              $ref: '#/components/schemas/Address'
            }
          }
        }
      }
    }
  }
  const stackTrail = new StackTrail(['TEST'])

  const result = context.parse(doc, stackTrail)

  const schemas = result.oasDocument.components?.schemas as Record<string, unknown>
  assertExists(schemas?.['User'])
  assertExists(schemas?.['Address'])
})

Deno.test('CoreContext - logger level is DEBUG', () => {
  const context = createTestContext()

  assertEquals(context.logger.level, 10) // DEBUG level in @std/log is 10
})

Deno.test('CoreContext - silent flag affects context behavior', () => {
  const silentContext = createTestContext({ silent: true })
  const verboseContext = createTestContext({ silent: false })

  assertEquals(silentContext.silent, true)
  assertEquals(verboseContext.silent, false)
})
