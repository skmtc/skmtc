import { assertEquals } from '@std/assert'
import { Definition, Identifier, toGeneratorOnlyKey } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType } from '@skmtc/core'
import { TsDefinition } from './TsDefinition.ts'
import { TsFile } from './TsFile.ts'
import { TsImport } from './TsImport.ts'

// Minimal mock context — the established test pattern (Definition.test.ts).
const mockContext = {} as GenerateContextType
const generatorKey = toGeneratorOnlyKey({ generatorId: 'test' })

const value = (content: string): GeneratedValue => ({ generatorKey, toString: () => content })

/**
 * `TsDefinition` must render byte-identically to the engine's `Definition`
 * for every declaration shape — same output, now owned by the language.
 */
Deno.test('TsDefinition byte-identical to Definition', async testContext => {
  const definitionCases = [
    {
      name: 'exported type alias',
      identifier: Identifier.createType('User'),
      content: '{ id: string }',
      description: undefined as string | undefined,
      noExport: false
    },
    {
      name: 'exported const with type annotation',
      identifier: Identifier.createVariable('API_URL', { typeName: 'string' }),
      content: '"https://example.com"',
      description: undefined,
      noExport: false
    },
    {
      name: 'const without annotation',
      identifier: Identifier.createVariable('count'),
      content: '42',
      description: undefined,
      noExport: false
    },
    {
      name: 'non-exported',
      identifier: Identifier.createVariable('helper'),
      content: '() => {}',
      description: undefined,
      noExport: true
    },
    {
      name: 'with JSDoc description',
      identifier: Identifier.createType('Status'),
      content: `'a' | 'b'`,
      description: 'Possible status values',
      noExport: false
    }
  ]

  for (const definitionCase of definitionCases) {
    await testContext.step(definitionCase.name, () => {
      const legacy = new Definition({
        context: mockContext,
        identifier: definitionCase.identifier,
        value: value(definitionCase.content),
        description: definitionCase.description,
        noExport: definitionCase.noExport
      }).toString()

      const tsDefinition = new TsDefinition({
        context: mockContext,
        identifier: definitionCase.identifier,
        value: value(definitionCase.content),
        description: definitionCase.description,
        noExport: definitionCase.noExport
      }).toString()

      assertEquals(tsDefinition, legacy)
    })
  }
})

/**
 * `TsFile` must keep rendering the exact file the engine's legacy `File`
 * produced — re-exports, imports (with package normalisation), then
 * definitions. The expected literal below was pinned against the legacy
 * class before core's `File` was deleted (step 5 of the convergence
 * tracker).
 */
Deno.test('TsFile renders the legacy-pinned file — imports + definitions + reExports', () => {
  const path = '@/types/models.generated.ts'

  const tsFile = new TsFile({ path, settings: undefined })
  tsFile.addReExports({ './shared': [Identifier.createVariable('helper')] })
  tsFile.addImports([TsImport.fromConcise('zod', ['z']), TsImport.fromConcise('@/models', ['User', 'Account'])])
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: Identifier.createType('Account'), value: value('{ id: string }') })
  )

  assertEquals(
    tsFile.toString(),
    `export  { helper } from './shared'\n\nimport {z} from 'zod'\nimport {User, Account} from '@/models'\n\nexport type Account = { id: string };\n`
  )
})

/**
 * INTENDED DIVERGENCE from the legacy core `File` (deleted in step 5).
 * It stored imports as `Set<string>` (encoded), so an all-type-only import
 * round-tripped through the string `'type User'`, lost its type flag, and
 * degraded the clean statement-level `import type { … }` into per-name
 * `import { type … }`. `TsFile` keeps structured `TsImport`s, so it emits
 * the cleaner form. Both are valid, semantically-identical TS — this is
 * the representation improvement the notes (`04`) flagged. Surfaced at the
 * regression gate.
 */
Deno.test('TsFile improves on the legacy File for all-type-only imports (structured, not Set<string>)', () => {
  const path = '@/types/models.generated.ts'

  const tsFile = new TsFile({ path, settings: undefined })
  tsFile.addImports([TsImport.fromConcise('@/models', [{ name: 'User', type: 'type' }])])

  assertEquals(tsFile.toString(), `import type {User} from '@/models'`) // clean
})

Deno.test('TsFile renders the legacy-pinned cross-package import normalisation', () => {
  const settings = { packages: [{ rootPath: 'packages/models/src', moduleName: '@app/models' }] }
  const path = 'packages/client/src/api.generated.ts'

  const tsFile = new TsFile({ path, settings })
  tsFile.addImports([TsImport.fromConcise('packages/models/src/User.ts', ['User'])])

  assertEquals(tsFile.toString(), `import {User} from '@app/models'`)
})
