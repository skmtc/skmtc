import { assertEquals, assert, assertExists } from '@std/assert'
import { CoreContext, skmtcFormatter, skmtcJsonFormatter } from './CoreContext.ts'
import { StackTrail } from './StackTrail.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { ResultType } from '@/types/Results.ts'
import { bold, gray, red, yellow, blue } from '@std/fmt/colors'

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
const createEmptyGeneratorMap = <
  EnrichmentType = undefined
>(): GeneratorsMapContainer<EnrichmentType> => ({})

// Helper function to create test CoreContext
const createTestContext = (options?: { spanId?: string; logsPath?: string; silent?: boolean }) => {
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
  }
})

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
  }
})

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
    document: {
      type: 'oas',
      value: doc
    },
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result)
  assertExists(result.artifacts)
  assertExists(result.files)
  assertExists(result.previews)
  assertExists(result.results)
})

Deno.test('CoreContext - toArtifacts() returns RenderResult structure', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: doc
    },
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertEquals(typeof result.artifacts, 'object')
  assertEquals(typeof result.files, 'object')
  assertEquals(typeof result.previews, 'object')
  assertExists(result.results)
})

Deno.test('CoreContext - toArtifacts() includes results tree', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: doc
    },
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertExists(result.results)
  assertEquals(typeof result.results, 'object')
})

Deno.test('CoreContext - toArtifacts() synthesizes an error parseIssue when parsing throws', () => {
  // The CLI's `generate --json` previously reported `type:
  // "generated"` with 0 files when the worker's `toArtifacts`
  // caught a top-level failure — there was no signal in the
  // returned shape that anything had gone wrong. The catch now
  // adds an `INVALID_SCHEMA` parseIssue so consumers can detect
  // crashed runs.
  //
  // We trigger the catch by passing an OAS document whose
  // `openapi` field is undefined — `toDocumentFieldsV3` does
  // `const { openapi, ... } = documentObject` which throws on a
  // null/undefined input.
  const context = createTestContext()
  const stackTrail = new StackTrail(['TEST'])

  // deno-lint-ignore no-explicit-any
  const malformedDocument: any = null

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: malformedDocument
    },
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  // Empty outputs are expected — the run failed.
  assertEquals(Object.keys(result.artifacts).length, 0)
  assertEquals(Object.keys(result.files).length, 0)

  // The synthesized issue is what makes the failure detectable.
  assert(result.parseIssues.length > 0)
  const errorIssue = result.parseIssues.find(i => i.level === 'error')
  assertExists(errorIssue)
  if (errorIssue?.level === 'error') {
    assertEquals(errorIssue.type, 'INVALID_SCHEMA')
    assertEquals(errorIssue.location, 'toArtifacts')
    // `cause` carries the original error so downstream consumers
    // can rehydrate a stack trace if they need to.
    assert(errorIssue.cause !== undefined)
  }
})

Deno.test('CoreContext - toArtifacts() with empty document', () => {
  const context = createTestContext()
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: doc
    },
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
    document: {
      type: 'oas',
      value: doc
    },
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
    document: {
      type: 'oas',
      value: doc
    },
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

Deno.test('CoreContext - toArtifacts() silent mode', () => {
  const context = createTestContext({ silent: true })
  const doc = createMinimalDocument()
  const stackTrail = new StackTrail(['TEST'])

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: doc
    },
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
    document: {
      type: 'oas',
      value: invalidDoc
    },
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
    document: {
      type: 'oas',
      value: invalidDoc
    },
    settings: undefined,
    toGeneratorConfigMap: createEmptyGeneratorMap,
    stackTrail,
    silent: true
  })

  assertEquals(Object.keys(result.artifacts).length, 0)
  assertEquals(Object.keys(result.files).length, 0)
  assertEquals(Object.keys(result.previews).length, 0)
})

Deno.test('CoreContext - error in toArtifacts() still includes results tree', () => {
  const context = createTestContext()
  const stackTrail = new StackTrail(['TEST'])

  const invalidDoc = {
    openapi: '3.0.0'
  } as OpenAPIV3.Document

  const result = context.toArtifacts({
    document: {
      type: 'oas',
      value: invalidDoc
    },
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
    document: {
      type: 'oas',
      value: doc
    },
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
    document: {
      type: 'oas',
      value: doc
    },
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
    document: {
      type: 'oas',
      value: doc
    },
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

// Tests for skmtcFormatter (pretty-print console formatter)
Deno.test('skmtcFormatter', async t => {
  await t.step('log level formatting', async t => {
    await t.step('formats ERROR level with red color', () => {
      const logRecord = {
        levelName: 'ERROR',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test error message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(red(bold('[ERROR]'))))
      assert(result.includes('Test error message'))
      assert(result.includes('2024-01-16 10:32:59.772'))
    })

    await t.step('formats WARN level with yellow color', () => {
      const logRecord = {
        levelName: 'WARN',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test warning message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(yellow(bold('[WARN]'))))
      assert(result.includes('Test warning message'))
    })

    await t.step('formats INFO level with blue color', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test info message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(blue(bold('[INFO]'))))
      assert(result.includes('Test info message'))
    })

    await t.step('formats DEBUG level with gray color', () => {
      const logRecord = {
        levelName: 'DEBUG',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test debug message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(gray(bold('[DEBUG]'))))
      assert(result.includes('Test debug message'))
    })

    await t.step('handles unknown log level', () => {
      const logRecord = {
        levelName: 'CUSTOM',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test custom message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('[CUSTOM]'))
      assert(result.includes('Test custom message'))
    })
  })

  await t.step('timestamp formatting', async t => {
    await t.step('converts Date to ISO string format', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('2024-01-16 10:32:59.772'))
      // Timestamp should use space instead of 'T' and not include 'Z'
      assert(!result.includes('2024-01-16T10:32:59'))
      assert(!result.includes('772Z'))
    })

    await t.step('formats timestamp in gray', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(gray('2024-01-16 10:32:59.772')))
    })
  })

  await t.step('stack trail handling', async t => {
    await t.step('includes stack trail when not SKIPPED', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcFormatter({
        logRecord,
        stackTrail: 'components:schemas:User'
      })

      assert(result.includes('Stack:'))
      assert(result.includes('components:schemas:User'))
    })

    await t.step('omits stack trail when SKIPPED', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(!result.includes('Stack:'))
    })

    await t.step('formats stack trail in gray', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcFormatter({
        logRecord,
        stackTrail: 'parse:components:schemas'
      })

      assert(result.includes(gray('Stack:')))
    })
  })

  await t.step('message formatting', async t => {
    await t.step('preserves single-line messages', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Simple test message',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('Simple test message'))
    })

    await t.step('preserves multi-line error messages with stack traces', () => {
      const errorMessage =
        'Error: Something went wrong\n    at function1 (file.ts:10:5)\n    at function2 (file.ts:20:3)'
      const logRecord = {
        levelName: 'ERROR',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: errorMessage,
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('Error: Something went wrong'))
      assert(result.includes('at function1 (file.ts:10:5)'))
      assert(result.includes('at function2 (file.ts:20:3)'))
    })

    await t.step('handles empty message', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: '',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      // Should still have header and newlines
      assert(result.includes('[INFO]'))
      assert(result.length > 0)
    })
  })

  await t.step('output structure', async t => {
    await t.step('includes header with level and timestamp', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('[INFO]'))
      assert(result.includes('2024-01-16 10:32:59.772'))
    })

    await t.step('includes message content', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message content',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes('Test message content'))
    })

    await t.step('ends with newline', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.endsWith('\n'))
    })

    await t.step('level name is bolded', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcFormatter({ logRecord, stackTrail: 'SKIPPED' })

      assert(result.includes(bold('[INFO]')))
    })
  })
})

// Tests for skmtcJsonFormatter (JSON file formatter)
Deno.test('skmtcJsonFormatter', async t => {
  await t.step('JSON structure', async t => {
    await t.step('outputs valid JSON', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })

      // Should be valid JSON
      const parsed = JSON.parse(result)
      assertExists(parsed)
    })

    await t.step('includes all required fields', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertExists(parsed.stackTrail)
      assertExists(parsed.level)
      assertExists(parsed.datetime)
      assertExists(parsed.message)
    })

    await t.step('stackTrail field contains correct value', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcJsonFormatter({
        logRecord,
        stackTrail: 'components:schemas:User'
      })
      const parsed = JSON.parse(result)

      assertEquals(parsed.stackTrail, 'components:schemas:User')
    })

    await t.step('level field contains log level name', () => {
      const logRecord = {
        levelName: 'ERROR',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.level, 'ERROR')
    })

    await t.step('datetime field contains Unix timestamp', () => {
      const testDate = new Date('2024-01-16T10:32:59.772Z')
      const logRecord = {
        levelName: 'INFO',
        datetime: testDate,
        msg: 'Test',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.datetime, testDate.getTime())
      assertEquals(typeof parsed.datetime, 'number')
    })

    await t.step('message field contains log message', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test message content',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.message, 'Test message content')
    })
  })

  await t.step('args handling', async t => {
    await t.step('includes args field when args present', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: [{ key: 'value' }]
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertExists(parsed.args)
      assertEquals(parsed.args.key, 'value')
    })

    await t.step('flattens single arg', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: ['single-arg']
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.args, 'single-arg')
    })

    await t.step('preserves array for multiple args', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: ['arg1', 'arg2', 'arg3']
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assert(Array.isArray(parsed.args))
      assertEquals(parsed.args.length, 3)
    })
  })

  await t.step('edge cases', async t => {
    await t.step('handles empty message', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: '',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.message, '')
    })

    await t.step('handles multi-line messages', () => {
      const multiLineMsg = 'Line 1\nLine 2\nLine 3'
      const logRecord = {
        levelName: 'ERROR',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: multiLineMsg,
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.message, multiLineMsg)
    })

    await t.step('handles SKIPPED stack trail', () => {
      const logRecord = {
        levelName: 'INFO',
        datetime: new Date('2024-01-16T10:32:59.772Z'),
        msg: 'Test',
        args: []
      }

      const result = skmtcJsonFormatter({ logRecord, stackTrail: 'SKIPPED' })
      const parsed = JSON.parse(result)

      assertEquals(parsed.stackTrail, 'SKIPPED')
    })
  })
})
