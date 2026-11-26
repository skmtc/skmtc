import { assertEquals } from '@std/assert'
import { Logger } from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { Lang } from '@/dsl/Lang.ts'
import {
  ensureFile,
  findDefinitionAt,
  toImportDestination,
  toImportFile
} from '@/dsl/driverFiles.ts'
import { normalizeWorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'

const createContext = () =>
  new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new Logger('test', 'CRITICAL'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

const lang = {
  createFile: ({ path }: { path: string }) => new MockFile({ path })
} as unknown as Lang

const exportPath = normalizeWorkspacePath('@/types/a.ts')

Deno.test('toImportDestination: no destination, or the export path in any spelling, is no import', () => {
  const context = createContext()

  assertEquals(toImportDestination({ context, exportPath, destinationPath: undefined }), undefined)

  for (const destinationPath of ['@/types/a.ts', './types/a.ts', 'types\\a.ts']) {
    assertEquals(toImportDestination({ context, exportPath, destinationPath }), undefined)
  }

  context.addFile(new MockFile({ path: exportPath }))

  assertEquals(
    toImportDestination({ context, exportPath, destinationPath: './types/a.ts' }),
    undefined
  )
  // Nothing was created to find that out.
  assertEquals([...context.inspectedFiles.keys()], ['@/types/a.ts'])
})

Deno.test('toImportDestination: another file is its file when it exists, its normalized path when not', () => {
  const context = createContext()

  assertEquals(
    toImportDestination({ context, exportPath, destinationPath: './types/b.ts' }),
    normalizeWorkspacePath('@/types/b.ts')
  )
  assertEquals(context.inspectedFiles.size, 0)

  const file = context.addFile(new MockFile({ path: '@/types/b.ts' }))

  assertEquals(toImportDestination({ context, exportPath, destinationPath: 'types\\b.ts' }), file)
})

Deno.test('toImportFile and ensureFile create the file once, at the normalized path', () => {
  const context = createContext()

  const created = toImportFile({ context, lang, destination: normalizeWorkspacePath('./types/b.ts') })

  assertEquals(created.path, '@/types/b.ts')
  assertEquals(ensureFile({ context, lang, path: normalizeWorkspacePath('@/types/b.ts') }), created)
  assertEquals(toImportFile({ context, lang, destination: created }), created)
  assertEquals([...context.inspectedFiles.keys()], ['@/types/b.ts'])
})

Deno.test('findDefinitionAt finds a definition in the file at the path, and none with no file', () => {
  const context = createContext()

  assertEquals(findDefinitionAt({ context, name: 'A', exportPath }), undefined)

  const definition = new MockDefinition({
    context,
    identifier: new IdentifierBase({ name: 'A' }),
    value: { generatorKey: undefined, toString: () => 'A' }
  })

  context.addFile(new MockFile({ path: exportPath }))
  context.register({ definitions: [definition], destinationPath: exportPath })

  assertEquals(findDefinitionAt({ context, name: 'A', exportPath }), definition)
})
