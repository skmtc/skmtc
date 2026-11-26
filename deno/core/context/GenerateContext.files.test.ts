import { assertEquals, assertThrows } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { FileBase } from '@/dsl/FileBase.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
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

Deno.test('inspectedFiles enumerates every registered file', () => {
  const context = createContext()
  context.addFile(new LangFile({ path: '@/models/User.ts' }))
  context.addFile(new LangFile({ path: '@/models/Pet.ts' }))

  const files = context.inspectedFiles

  assertEquals(files.size, 2)
  assertEquals([...files.keys()].sort(), ['@/models/Pet.ts', '@/models/User.ts'])
  assertEquals(files.get('@/models/User.ts')?.toString(), 'lang-file @/models/User.ts')
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

Deno.test('addFile throws on a path that differs from another only in case', () => {
  // Models `Foo` and `foo` are two files here, and one file on macOS's or
  // Windows' default file system: written out, the second replaced the first
  // without a word.
  const context = createContext()
  context.addFile(new LangFile({ path: '@/types/Foo.generated.ts' }))

  assertThrows(
    () => context.addFile(new LangFile({ path: '@/types/foo.generated.ts' })),
    Error,
    `File '@/types/foo.generated.ts' differs from '@/types/Foo.generated.ts' only in case`
  )
  // The first file is kept, and no second one is stored.
  assertEquals([...context.inspectedFiles.keys()], ['@/types/Foo.generated.ts'])
})

Deno.test('JsonFile is a FileBase that round-trips through the neutral primitives', () => {
  const json = new JsonFile({ path: 'config.json', content: { a: 1 } })

  assertEquals(json instanceof FileBase, true)

  // It round-trips through the neutral primitives like any FileBase.
  const context = createContext()
  context.addFile(json)
  assertEquals(context.getFile('config.json'), json)
})

Deno.test('addFile sets the file path to the normalized one', () => {
  const context = createContext()
  const file = context.addFile(new LangFile({ path: './types/a.ts' }))

  assertEquals(file.path, '@/types/a.ts')
  assertEquals(context.getFile('@/types/a.ts'), file)
  assertEquals([...context.inspectedFiles.keys()], ['@/types/a.ts'])
})

/** A value that renders as its name: enough for a definition to be found. */
const toDefinition = (context: GenerateContext, name: string) =>
  new MockDefinition({
    context,
    identifier: new IdentifierBase({ name }),
    value: { generatorKey: undefined, toString: () => name }
  })

for (const spelling of ['./types/a.ts', '/types/a.ts', 'types\\a.ts', '.\\types\\a.ts', 'types/a.ts']) {
  Deno.test(`a file added as @/types/a.ts is found as '${spelling}'`, () => {
    const context = createContext()
    const file = context.addFile(new MockFile({ path: '@/types/a.ts' }))

    assertEquals(context.getFile(spelling), file)

    context.register({ definitions: [toDefinition(context, 'A')], destinationPath: spelling })

    assertEquals([...file.definitions.keys()], ['A'])
    assertEquals(context.findDefinition({ name: 'A', exportPath: spelling })?.identifier.name, 'A')
    assertEquals([...context.inspectedFiles.keys()], ['@/types/a.ts'])
  })
}

Deno.test('register into a path with no file names the normalized path', () => {
  const context = createContext()

  assertThrows(
    () => context.register({ definitions: [], destinationPath: './types/missing.ts' }),
    Error,
    "Cannot register into '@/types/missing.ts' — the file does not exist."
  )
})
