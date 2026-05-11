import { assertEquals, assertExists } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import { toArtifacts } from './toArtifacts.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'

// Minimal OpenAPI document for testing
const minimalOpenApiDoc: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {},
}

// Simple generator map that returns empty results
// Using generic function to match the expected signature
const createEmptyGeneratorMap = <EnrichmentType = undefined>(): GeneratorsMapContainer<EnrichmentType> =>
  ({} as GeneratorsMapContainer<EnrichmentType>)

Deno.test('toArtifacts', async (t) => {
  await t.step('basic pipeline execution', async (t) => {
    await t.step('should execute pipeline with minimal OpenAPI document', () => {
      const stackTrail = new StackTrail(['TEST'])
      const startAt = Date.now()

      const result = toArtifacts({
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt,
        silent: true,
        stackTrail,
      })

      assertExists(result)
      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should return artifacts object', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertEquals(typeof result.artifacts, 'object')
    })

    await t.step('should return manifest with correct structure', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      const manifest = result.manifest

      assertExists(manifest.files)
      assertExists(manifest.previews)
      assertExists(manifest.mappings)
      assertExists(manifest.results)
      assertExists(manifest.traceId)
      assertExists(manifest.spanId)
      assertExists(manifest.deploymentId)
      assertExists(manifest.startAt)
      assertExists(manifest.endAt)
    })

    await t.step('should return manifest with metadata', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertEquals(typeof result.manifest.files, 'object')
      assertEquals(typeof result.manifest.previews, 'object')
      assertEquals(typeof result.manifest.mappings, 'object')
      assertEquals(typeof result.manifest.results, 'object')
    })
  })

  await t.step('settings and configuration', async (t) => {
    await t.step('should handle undefined settings', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should handle custom client settings', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: {
          basePath: './generated',
        },
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should handle prettier configuration', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        prettier: {
          semi: true,
          singleQuote: true,
        },
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should handle silent mode', () => {
      const stackTrail = new StackTrail(['TEST'])

      // Test with silent: true
      const silentResult = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(silentResult.artifacts)

      // Test with silent: false
      const verboseResult = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: false,
        stackTrail,
      })

      assertExists(verboseResult.artifacts)
    })

    // Note: logsPath test skipped because it requires --allow-write permission
    // and would create actual files. This is tested in integration tests.
  })

  await t.step('manifest metadata', async (t) => {
    await t.step('should include traceId in manifest', () => {
      const stackTrail = new StackTrail(['TEST'])
      const traceId = 'custom-trace-id-12345'

      const result = toArtifacts({
        traceId,
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertEquals(result.manifest.traceId, traceId)
    })

    await t.step('should include spanId in manifest', () => {
      const stackTrail = new StackTrail(['TEST'])
      const spanId = 'custom-span-id-67890'

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId,
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertEquals(result.manifest.spanId, spanId)
    })

    await t.step('should include startAt timestamp in manifest', () => {
      const stackTrail = new StackTrail(['TEST'])
      const startAt = 1234567890

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt,
        silent: true,
        stackTrail,
      })

      assertEquals(result.manifest.startAt, startAt)
    })

    await t.step('should include endAt timestamp in manifest', () => {
      const stackTrail = new StackTrail(['TEST'])
      const startAt = Date.now()

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt,
        silent: true,
        stackTrail,
      })

      assertExists(result.manifest.endAt)
      assertEquals(typeof result.manifest.endAt, 'number')
      // endAt should be >= startAt
      assertEquals(result.manifest.endAt >= startAt, true)
    })

    await t.step('should include deploymentId in manifest from env or fallback', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.manifest.deploymentId)
      assertEquals(typeof result.manifest.deploymentId, 'string')
    })

    await t.step('should include region in manifest from env if set', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      // region is either string or undefined depending on env
      const regionType = typeof result.manifest.region
      assertEquals(regionType === 'string' || regionType === 'undefined', true)
    })
  })

  await t.step('OpenAPI document variations', async (t) => {
    await t.step('should handle OpenAPI doc with paths', () => {
      const stackTrail = new StackTrail(['TEST'])
      const docWithPaths: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API with Paths',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      }

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        documentObject: docWithPaths,
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should handle OpenAPI doc with components', () => {
      const stackTrail = new StackTrail(['TEST'])
      const docWithComponents: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API with Components',
          version: '1.0.0',
        },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      }

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        documentObject: docWithComponents,
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should handle OpenAPI doc with servers', () => {
      const stackTrail = new StackTrail(['TEST'])
      const docWithServers: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API with Servers',
          version: '1.0.0',
        },
        paths: {},
        servers: [
          {
            url: 'https://api.example.com/v1',
            description: 'Production server',
          },
        ],
      }

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        documentObject: docWithServers,
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })
  })

  await t.step('stack trail handling', async (t) => {
    await t.step('should accept stack trail with single element', () => {
      const stackTrail = new StackTrail(['ROOT'])

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })

    await t.step('should accept stack trail with multiple elements', () => {
      const stackTrail = new StackTrail(['ROOT', 'COMPONENT', 'SCHEMA'])

      const result = toArtifacts({
        traceId: 'test-trace',
        spanId: 'test-span',
        document: { type: 'oas', value: minimalOpenApiDoc },
        settings: undefined,
        toGeneratorConfigMap: createEmptyGeneratorMap,
        startAt: Date.now(),
        silent: true,
        stackTrail,
      })

      assertExists(result.artifacts)
      assertExists(result.manifest)
    })
  })
})
