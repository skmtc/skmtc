/**
 * Engine-level pin for generated-suffix injection.
 *
 * `GenerateContext.to*ContentSettings` applies
 * `client.json#settings.generatedSuffix` (default `'.generated'`) to
 * every projection `toExportPath` result when it is stored into
 * `ContentSettings`, and `#addPreview` applies the same treatment to
 * hand-assembled preview export paths. Generators therefore declare
 * suffix-less paths; generators that predate injection (they hardcode
 * `.generated`) are unaffected because injection is idempotent.
 *
 * The helper's string rules are pinned in
 * `helpers/applyGeneratedSuffix.test.ts`; this file pins the wiring —
 * file-map keys, import specifiers, and previews all carrying the
 * injected suffix, and the config overrides.
 */

import { assertEquals, assertExists } from '@std/assert'
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

const HookBase = toTsOasOperationProjectionBase({
  id: '@test/suffix-hook',
  toIdentifierName: () => 'useListPets',
  toIdentifierType: () => ({ type: 'variable' }),
  // Suffix-less by design: the engine injects the suffix.
  toExportPath: () => '@/services/useListPets.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class HookProjection extends HookBase {
  constructor(args: {
    context: GenerateContextType
    operation: OasOperation
    settings: ConstructorParameters<typeof HookBase>[0]['settings']
  }) {
    super(args)
  }

  override toString() {
    return `() => fetch('/pets')`
  }
}

const buildContext = (settings: ClientSettings | undefined) => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({
        path: '/pets',
        method: 'get',
        pathItem: undefined,
        responses: {}
      })
    ]
  })

  const entry = toOasOperationEntry({
    id: '@test/suffix-hook',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, operation }) => {
      context.insertOperation({ projection: HookProjection, operation })
    },
    toPreviewModule: ({ context, operation, variant }) => ({
      name: 'useListPets',
      exportPath: HookProjection.toExportPath({
        operation,
        enrichments: HookProjection.toEnrichments({ operation, context, variant }),
        variant
      }),
      group: 'services'
    })
  })

  return new GenerateContext({
    document: { type: 'oas', value: doc },
    settings,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/suffix-hook': entry }) as any
  })
}

Deno.test('generated suffix - injected into exportPath by default', () => {
  const context = buildContext(undefined)
  const { files } = context.toArtifacts(new StackTrail(['test']))

  assertEquals(files.get('@/services/useListPets.ts'), undefined)
  const file = files.get('@/services/useListPets.generated.ts')
  assertExists(file)
})

Deno.test('generated suffix - preview export paths carry the suffix too', () => {
  const context = buildContext(undefined)
  const { previews } = context.toArtifacts(new StackTrail(['test']))

  const preview = previews['useListPets']
  assertExists(preview)
  assertEquals(preview.module.exportPath, '@/services/useListPets.generated.ts')
})

Deno.test('generated suffix - custom generatedSuffix is honored', () => {
  const context = buildContext({ generatedSuffix: '.gen' })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const file = files.get('@/services/useListPets.gen.ts')
  assertExists(file)
})

Deno.test('generated suffix - empty generatedSuffix disables injection', () => {
  const context = buildContext({ generatedSuffix: '' })
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const file = files.get('@/services/useListPets.ts')
  assertExists(file)
  assertEquals(files.get('@/services/useListPets.generated.ts'), undefined)
})
