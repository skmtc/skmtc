import { assertEquals, assertThrows } from '@std/assert'
import { RenderContext } from './RenderContext.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import { MockFile, MockDefinition } from '@/test/MockFile.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { StackTrail } from './StackTrail.ts'
import { spy, assertSpyCalls } from '@std/testing/mock'
import type { ResultType } from '@/types/Results.ts'
import type * as log from '@std/log'
import { toGenerateContext } from '@/test/toGenerateContext.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import type { Preview } from '@/types/Preview.ts'

// Mock logger
const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// Helper to create a file with definitions
const createFileWithDefinition = (path: string, name: string, content: string): MockFile => {
  const file = new MockFile({ path })
  const definition = new MockDefinition({
    context: toGenerateContext(),
    identifier: new IdentifierBase({ name }),
    value: {
      generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
      toString: () => content
    }
  })
  file.definitions.set(name, definition)
  return file
}

Deno.test('RenderContext', async t => {
  await t.step('constructor', async t => {
    await t.step('should initialize with all required parameters', () => {
      const files = new Map<string, FileBase>()
      const previews = {}
      const basePath = './src'
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews,
        basePath,
        logger: mockLogger,
        captureCurrentResult
      })

      assertEquals(context.files, files)
      assertEquals(context.previews, previews)
      assertEquals(context.basePath, basePath)
      assertEquals(context.logger, mockLogger)
      assertEquals(context.captureCurrentResult, captureCurrentResult)
    })

    await t.step('should handle undefined basePath', () => {
      const files = new Map<string, FileBase>()
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      assertEquals(context.basePath, undefined)
    })
  })

  await t.step('render() method', async t => {
    await t.step('should render single file', () => {
      const file = createFileWithDefinition('test.ts', 'x', 'const x = 1;')

      const files = new Map<string, FileBase>()
      files.set('test.ts', file)

      const previews = {}
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews,
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.render(stackTrail)

      assertEquals(typeof result.artifacts['test.ts'], 'string')
      assertEquals(result.previews, previews)
      assertEquals(result.files['test.ts'].destinationPath, 'test.ts')
    })

    await t.step('should include previews in result', () => {
      const files = new Map<string, FileBase>()
      const previews: Record<string, Preview> = {
        test: {
          module: { name: 'test', exportPath: 'test' },
          source: {
            type: 'oasOperation',
            generatorId: 'test',
            operationPath: 'test',
            operationMethod: 'get',
            variant: 'main'
          }
        }
      }
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews,
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.render(stackTrail)

      assertEquals(result.previews, previews)
    })
  })

  await t.step('collate() method', async t => {
    await t.step('should collate single file with metadata', () => {
      const file = createFileWithDefinition(
        'utils.ts',
        'helper',
        'const helper = () => {};\nconst another = 1;'
      )

      const files = new Map<string, FileBase>()
      files.set('utils.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      assertEquals(typeof result.artifacts['utils.ts'], 'string')
      assertEquals(result.files['utils.ts'].destinationPath, 'utils.ts')
      assertEquals(result.files['utils.ts'].lines > 0, true)
      assertEquals(result.files['utils.ts'].characters > 0, true)
    })

    await t.step('should collate multiple files', () => {
      const file1 = createFileWithDefinition('file1.ts', 'a', 'export const a = 1;')
      const file2 = createFileWithDefinition('file2.ts', 'b', 'export const b = 2;')

      const files = new Map<string, FileBase>()
      files.set('file1.ts', file1)
      files.set('file2.ts', file2)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      assertEquals(Object.keys(result.artifacts).length, 2)
      assertEquals(typeof result.artifacts['file1.ts'], 'string')
      assertEquals(typeof result.artifacts['file2.ts'], 'string')
      assertEquals(result.files['file1.ts'].destinationPath, 'file1.ts')
      assertEquals(result.files['file2.ts'].destinationPath, 'file2.ts')
    })

    await t.step('should handle empty files map', () => {
      const files = new Map<string, FileBase>()
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      assertEquals(Object.keys(result.artifacts).length, 0)
      assertEquals(Object.keys(result.files).length, 0)
    })

    await t.step('should resolve paths with basePath', () => {
      const file = createFileWithDefinition('models/User.ts', 'User', 'export interface User {}')

      const files = new Map<string, FileBase>()
      files.set('models/User.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: './src/generated',
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      // Path should be resolved with basePath
      assertEquals(result.files['src/generated/models/User.ts']?.destinationPath, 'models/User.ts')
    })

    await t.step('should calculate line count correctly', () => {
      const file = createFileWithDefinition('test.ts', 'test', 'line1\nline2\nline3')

      const files = new Map<string, FileBase>()
      files.set('test.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      // File toString() includes export const test = ... so will have more lines
      assertEquals(result.files['test.ts'].lines >= 3, true)
    })

    await t.step('should calculate character count correctly', () => {
      const content = 'const x = 1;'
      const file = createFileWithDefinition('test.ts', 'x', content)

      const files = new Map<string, FileBase>()
      files.set('test.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      assertEquals(result.files['test.ts'].characters > 0, true)
    })

    await t.step('should call captureCurrentResult for each file', () => {
      const file = createFileWithDefinition('test.ts', 'x', 'const x = 1;')

      const files = new Map<string, FileBase>()
      files.set('test.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}
      const captureSpy = spy(captureCurrentResult)

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult: captureSpy
      })

      const stackTrail = new StackTrail(['TEST'])
      context.collate(stackTrail)

      assertSpyCalls(captureSpy, 1)
    })

    await t.step('should handle JsonFile', () => {
      const jsonFile = new JsonFile({
        path: 'config.json',
        content: { key: 'value', nested: { foo: 'bar' } }
      })

      const files = new Map<string, FileBase>()
      files.set('config.json', jsonFile)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.collate(stackTrail)

      assertEquals(typeof result.artifacts['config.json'], 'string')
      assertEquals(result.artifacts['config.json'].includes('"key"'), true)
    })
  })

  await t.step('getFile() method', async t => {
    await t.step('should retrieve existing file', () => {
      const file = new MockFile({ path: 'test.ts' })

      const files = new Map<string, FileBase>()
      files.set('test.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const retrieved = context.getFile('test.ts')
      assertEquals(retrieved, file)
    })

    await t.step('should normalize paths', () => {
      const file = new MockFile({ path: 'models/User.ts' })

      const files = new Map<string, FileBase>()
      files.set('models/User.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      // All these should work due to normalization
      const retrieved1 = context.getFile('models/User.ts')
      const retrieved2 = context.getFile('./models/User.ts')

      assertEquals(retrieved1, file)
      assertEquals(retrieved2, file)
    })

    await t.step('should throw error when file not found', () => {
      const files = new Map<string, FileBase>()
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      assertThrows(
        () => context.getFile('nonexistent.ts'),
        Error,
        'File not found during render phase: nonexistent.ts'
      )
    })

    await t.step('should include normalized path in error message', () => {
      const files = new Map<string, FileBase>()
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      assertThrows(() => context.getFile('./path/to/file.ts'), Error, 'path/to/file.ts')
    })
  })

  await t.step('pick() method', async t => {
    await t.step('should pick definition from File', () => {
      const file = new MockFile({ path: 'types.ts' })

      const userDefinition = new MockDefinition({
        context: toGenerateContext(),
        identifier: new IdentifierBase({ name: 'User' }),
        value: {
          generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
          toString: () => 'export interface User { id: string; }'
        }
      })

      file.definitions.set('User', userDefinition)

      const files = new Map<string, FileBase>()
      files.set('types.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const picked = context.pick({
        name: 'User',
        exportPath: 'types.ts'
      })

      assertEquals(picked, userDefinition)
    })

    await t.step('should return undefined when definition not found', () => {
      const file = new MockFile({ path: 'types.ts' })

      const files = new Map<string, FileBase>()
      files.set('types.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const picked = context.pick({
        name: 'NonExistent',
        exportPath: 'types.ts'
      })

      assertEquals(picked, undefined)
    })

    await t.step('should throw error when file not found', () => {
      const files = new Map<string, FileBase>()
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      assertThrows(
        () =>
          context.pick({
            name: 'User',
            exportPath: 'nonexistent.ts'
          }),
        Error,
        'File not found during render phase'
      )
    })

    await t.step('should throw error when file is JsonFile', () => {
      const jsonFile = new JsonFile({
        path: 'config.json',
        content: { key: 'value' }
      })

      const files = new Map<string, FileBase>()
      files.set('config.json', jsonFile)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      assertThrows(
        () =>
          context.pick({
            name: 'Something',
            exportPath: 'config.json'
          }),
        Error,
        'File at "config.json" is not a code file'
      )
    })

    await t.step('should work with normalized paths', () => {
      const file = new MockFile({ path: 'models/User.ts' })

      const userDefinition = new MockDefinition({
        context: toGenerateContext(),
        identifier: new IdentifierBase({ name: 'User' }),
        value: {
          generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
          toString: () => 'export interface User {}'
        }
      })

      file.definitions.set('User', userDefinition)

      const files = new Map<string, FileBase>()
      files.set('models/User.ts', file)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      // Should work with both normalized and non-normalized paths
      const picked1 = context.pick({
        name: 'User',
        exportPath: 'models/User.ts'
      })

      const picked2 = context.pick({
        name: 'User',
        exportPath: './models/User.ts'
      })

      assertEquals(picked1, userDefinition)
      assertEquals(picked2, userDefinition)
    })
  })

  await t.step('integration tests', async t => {
    await t.step('should handle complete render pipeline', () => {
      const file1 = createFileWithDefinition(
        'models/User.ts',
        'User',
        'export interface User { id: string; name: string; }'
      )
      const file2 = createFileWithDefinition(
        'models/Post.ts',
        'Post',
        'export interface Post { id: string; title: string; }'
      )

      const files = new Map<string, FileBase>()
      files.set('models/User.ts', file1)
      files.set('models/Post.ts', file2)

      const previews = {}
      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews,
        basePath: './src/generated',
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.render(stackTrail)

      // Verify artifacts
      assertEquals(Object.keys(result.artifacts).length, 2)

      // Verify metadata
      assertEquals(Object.keys(result.files).length, 2)

      // Verify previews
      assertEquals(result.previews, previews)
    })

    await t.step('should handle mixed File and JsonFile types', () => {
      const tsFile = createFileWithDefinition('index.ts', 'models', 'export * from "./models";')

      const jsonFile = new JsonFile({
        path: 'tsconfig.json',
        content: {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext'
          }
        }
      })

      const files = new Map<string, FileBase>()
      files.set('index.ts', tsFile)
      files.set('tsconfig.json', jsonFile)

      const captureCurrentResult = (_result: ResultType, _st: StackTrail) => {}

      const context = new RenderContext({
        files,
        previews: {},
        basePath: undefined,
        logger: mockLogger,
        captureCurrentResult
      })

      const stackTrail = new StackTrail(['TEST'])
      const result = context.render(stackTrail)

      assertEquals(Object.keys(result.artifacts).length, 2)
      assertEquals(typeof result.artifacts['index.ts'], 'string')
      assertEquals(typeof result.artifacts['tsconfig.json'], 'string')
    })
  })
})
