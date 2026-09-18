/**
 * Engine-level pin for export-path canonicalization (issue #147).
 *
 * An export path is a logical path inside the workspace, spelled `@/`
 * plus a POSIX path relative to `basePath`. Whatever spelling a
 * generator returns from `toExportPath`, or passes as a
 * `destinationPath`, the engine stores the one canonical form: file-map
 * keys, import modules and the ejected lookup all agree, on every host.
 *
 * Uses neutral doubles only (MockFile / MockDefinition / MockImport /
 * IdentifierBase) — core tests stay language-agnostic.
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile, MockImport } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import { decapitalize } from '@/helpers/strings.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { ResultType } from '@/types/Results.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) =>
    new MockDefinition({ context, identifier, value }),
  toImport: ({ identifier, module }) => new MockImport({ names: [identifier.name], module }),
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

const GENERATOR_ID = '@test/export-paths'

type ToExportPath = (refName: string) => string

/**
 * `Widget` references `WidgetOwner` (the issue #147 shape). `toExportPath`
 * is injected so each test can choose the spelling a generator returns.
 */
const buildContext = ({
  toExportPath,
  settings
}: {
  toExportPath: ToExportPath
  settings?: ClientSettings
}) => {
  const ModelBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
    id: GENERATOR_ID,
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: ({ refName }) => toExportPath(refName),
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  class Model extends ModelBase {
    constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
      super(args)

      if (args.refName === 'Widget') {
        this.insertModel(Model, 'WidgetOwner' as RefName)
      }
    }

    override toString(): string {
      return this.refName
    }
  }

  const document = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    components: new OasComponents({
      schemas: Object.fromEntries(['WidgetOwner', 'Widget'].map(name => [name, new OasString({})]))
    })
  })

  const entry = toModelEntry({
    id: GENERATOR_ID,
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, refName }) => {
      context.insertModel(Model, refName)
    }
  })

  const results: ResultType[] = []

  const context = new GenerateContext({
    document: { type: 'oas', value: document },
    settings,
    logger: mockLogger,
    captureCurrentResult: result => {
      results.push(result)
    },
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ [GENERATOR_ID]: entry }) as any
  })

  return { context, results }
}

const windowsJoin: ToExportPath = refName => `@\\types\\${decapitalize(refName)}.ts`

Deno.test('export paths - a Windows-spelled toExportPath lands in the canonical file', () => {
  const { context } = buildContext({ toExportPath: windowsJoin })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertExists(files.get('@/types/widget.generated.ts'))
  assertExists(files.get('@/types/widgetOwner.generated.ts'))

  for (const key of files.keys()) {
    assertEquals(key.includes('\\'), false, `file-map key '${key}' carries a Windows separator`)
  }
})

Deno.test('export paths - the peer import module is the canonical export path', () => {
  const { context } = buildContext({ toExportPath: windowsJoin })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const widget = files.get('@/types/widget.generated.ts')
  assertInstanceOf(widget, MockFile)

  assertEquals([...widget.imports.keys()], ['@/types/widgetOwner.generated.ts'])
})

Deno.test('export paths - every accepted spelling is one file', () => {
  for (const spelling of ['./types/', 'types/', '@/types/']) {
    const { context } = buildContext({
      toExportPath: refName => `${spelling}${decapitalize(refName)}.ts`
    })
    const { files } = context.toArtifacts(new StackTrail(['test']))

    assertEquals(
      [...files.keys()].sort(),
      ['@/types/widget.generated.ts', '@/types/widgetOwner.generated.ts'],
      `spelling: '${spelling}'`
    )
  }
})

Deno.test('export paths - a Windows-spelled destinationPath registers into the existing file', () => {
  const { context } = buildContext({ toExportPath: windowsJoin })

  const file = context.addFile(new MockFile({ path: '@/types/x.ts' }))

  context.register({
    destinationPath: '@\\types\\x.ts',
    imports: [new MockImport({ names: ['Y'], module: '@/types/y.ts' })]
  })

  assertEquals(context.inspectedFiles.size, 1)
  assertEquals(context.getFile('types\\x.ts'), file)
  assertEquals([...file.imports.keys()], ['@/types/y.ts'])
})

Deno.test('export paths - a toExportPath that escapes basePath fails the item and adds no file', () => {
  for (const escaping of ['@/../escape.ts', '../escape.ts', '/etc/escape.ts', '@/']) {
    const { context, results } = buildContext({ toExportPath: () => escaping })
    const { files } = context.toArtifacts(new StackTrail(['test']))

    assertEquals(results.includes('error'), true, `toExportPath: '${escaping}' should fail`)
    assertEquals(files.size, 0, `toExportPath: '${escaping}' should add no file`)
  }
})

Deno.test('export paths - a Windows-spelled ejected entry matches its suffixed export path', () => {
  const { context } = buildContext({
    toExportPath: refName => `@/types/${decapitalize(refName)}.ts`,
    settings: { ejected: ['@\\types\\widget.ts'] }
  })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertExists(files.get('@/types/widget.ts'))
  assertEquals(files.get('@/types/widget.generated.ts'), undefined)
})
