import { assertEquals, assertThrows } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { FileBase } from '@/dsl/FileBase.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const createContext = () =>
  new GenerateContext({
    document: {
      type: 'oas',
      value: new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })
    },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

// A language-style File the engine never constructs — stands in for a
// `lang-*` package's own `*File`. Proves the neutral primitives store and
// return a file the engine itself could not have built.
class LangFile extends FileBase {
  override toString(): string {
    return `lang-file ${this.path}`
  }
}

Deno.test('getFile returns undefined for an unregistered path', () => {
  const context = createContext()
  assertEquals(context.getFile('@/models/User.ts'), undefined)
})

Deno.test('addFile stores a non-core FileBase that getFile returns', () => {
  const context = createContext()
  const file = new LangFile({ path: '@/models/User.ts' })

  context.addFile(file)

  assertEquals(context.getFile('@/models/User.ts'), file)
})

Deno.test('getFile normalizes the lookup path', () => {
  const context = createContext()
  const file = new LangFile({ path: 'models/User.ts' })

  context.addFile(file)

  // Different spelling of the same normalized path resolves to the file.
  assertEquals(context.getFile('./models/User.ts'), file)
})

Deno.test('addFile throws on a duplicate path', () => {
  const context = createContext()
  context.addFile(new LangFile({ path: '@/models/User.ts' }))

  assertThrows(
    () => context.addFile(new LangFile({ path: '@/models/User.ts' })),
    Error,
    'File already exists'
  )
})

Deno.test('JsonFile is a FileBase with an empty definitions map', () => {
  const json = new JsonFile({ path: 'config.json', content: { a: 1 } })

  assertEquals(json instanceof FileBase, true)
  assertEquals(json.definitions.size, 0)

  // And it round-trips through the neutral primitives like any FileBase.
  const context = createContext()
  context.addFile(json)
  assertEquals(context.getFile('config.json'), json)
})
