/**
 * Engine-level pin for the ejected set (`settings.ejected`).
 *
 * An ejected file is one the user has taken ownership of. Its entry in
 * `settings.ejected` is the suffix-less path they own
 * (`@/services/useListPets.ts`). For members,
 * `GenerateContext.#toContentSettingsExportPath` stores the ejected
 * path into `ContentSettings` instead of the suffixed one, so the file
 * map, definition cache, import specifiers, and previews all reference
 * the owned file — with no changes in any lang package or exit point.
 * The item still renders in memory (drift detection's input); the CLI
 * suppresses the disk write.
 */

import { assertEquals, assertExists, assertStringIncludes } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { ClientSettings } from '@/types/Settings.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const PATH = '/pets'
const METHOD = 'get' as const

// The peer whose output the user ejects. Suffix-less toExportPath —
// the engine injects '.generated' unless the path is ejected.
const HookBase = toTsOasOperationProjectionBase({
  id: '@test/hook-gen',
  toIdentifierName: () => 'useListPets',
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/services/useListPets.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class HookProjection extends HookBase {
  override toString() {
    return `() => fetch('${PATH}')`
  }
}

// A consumer that composes with the hook by name — its rendered import
// must follow wherever the hook's file lands.
const ViewBase = toTsOasOperationProjectionBase({
  id: '@test/view-gen',
  toIdentifierName: () => 'PetsView',
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/views/PetsView.tsx',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class ViewProjection extends ViewBase {
  hookName: string

  constructor(args: {
    context: GenerateContextType
    operation: OasOperation
    settings: ConstructorParameters<typeof ViewBase>[0]['settings']
  }) {
    super(args)

    this.hookName = this.insertOperation(HookProjection, args.operation).toName()
  }

  override toString() {
    return `() => <View hook={${this.hookName}} />`
  }
}

const buildContext = (settings: ClientSettings | undefined) => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({ path: PATH, method: METHOD, pathItem: undefined, responses: {} })
    ]
  })

  const hookEntry = toOasOperationEntry({
    id: '@test/hook-gen',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation }) => {
      context.insertOperation({ projection: HookProjection, operation })
    }
  })

  const viewEntry = toOasOperationEntry({
    id: '@test/view-gen',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation }) => {
      context.insertOperation({ projection: ViewProjection, operation })
    }
  })

  return new GenerateContext({
    document: { type: 'oas', value: doc },
    settings,
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () =>
      // deno-lint-ignore no-explicit-any
      ({ '@test/hook-gen': hookEntry, '@test/view-gen': viewEntry } as any)
  })
}

Deno.test('ejected - member lands at its owned (suffix-less) path', () => {
  const context = buildContext({ ejected: ['@/services/useListPets.ts'] })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertExists(files.get('@/services/useListPets.ts'))
  assertEquals(files.get('@/services/useListPets.generated.ts'), undefined)

  // Non-members are unaffected.
  assertExists(files.get('@/views/PetsView.generated.tsx'))
})

Deno.test('ejected - peer import specifiers follow the owned path automatically', () => {
  const context = buildContext({ ejected: ['@/services/useListPets.ts'] })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const viewFile = files.get('@/views/PetsView.generated.tsx')
  assertExists(viewFile)
  assertStringIncludes(
    viewFile.toString(),
    `import {useListPets} from '@/services/useListPets.ts'`
  )
})

Deno.test('ejected - without the setting the same project stays suffixed', () => {
  const context = buildContext(undefined)
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertExists(files.get('@/services/useListPets.generated.ts'))

  const viewFile = files.get('@/views/PetsView.generated.tsx')
  assertExists(viewFile)
  assertStringIncludes(
    viewFile.toString(),
    `import {useListPets} from '@/services/useListPets.generated.ts'`
  )
})

Deno.test('ejected - the ejected item still renders content (drift input)', () => {
  const context = buildContext({ ejected: ['@/services/useListPets.ts'] })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const hookFile = files.get('@/services/useListPets.ts')
  assertExists(hookFile)
  assertStringIncludes(hookFile.toString(), `fetch('${PATH}')`)
})
