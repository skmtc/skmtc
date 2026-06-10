import { assertEquals } from '@std/assert'
import { createType, createVariable } from './createIdentifier.ts'
import { toGeneratorOnlyKey } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType } from '@skmtc/core'
import { TsDefinition } from './TsDefinition.ts'
import { TsFile } from './TsFile.ts'
import { TsImport } from './TsImport.ts'
import { TsReExport } from './TsReExport.ts'

// Minimal mock context — the established test pattern (Definition.test.ts).
const mockContext = {} as GenerateContextType
const generatorKey = toGeneratorOnlyKey({ generatorId: 'test' })

const value = (content: string): GeneratedValue => ({ generatorKey, toString: () => content })

/**
 * `TsDefinition` must keep rendering the exact declarations the engine's
 * legacy `Definition` produced. The expected literals were pinned against
 * the legacy class before it was deleted (F5/F6 step 1 — note `17`).
 */
Deno.test('TsDefinition renders the legacy-pinned declarations', async testContext => {
  const definitionCases = [
    {
      name: 'exported type alias',
      identifier: createType('User'),
      content: '{ id: string }',
      description: undefined as string | undefined,
      noExport: false,
      expected: 'export type User = { id: string };\n'
    },
    {
      name: 'exported const with type annotation',
      identifier: createVariable('API_URL', { typeName: 'string' }),
      content: '"https://example.com"',
      description: undefined,
      noExport: false,
      expected: 'export const API_URL: string = "https://example.com";\n'
    },
    {
      name: 'const without annotation',
      identifier: createVariable('count'),
      content: '42',
      description: undefined,
      noExport: false,
      expected: 'export const count = 42;\n'
    },
    {
      name: 'non-exported',
      identifier: createVariable('helper'),
      content: '() => {}',
      description: undefined,
      noExport: true,
      expected: 'const helper = () => {};\n'
    },
    {
      name: 'with JSDoc description',
      identifier: createType('Status'),
      content: "'a' | 'b'",
      description: 'Possible status values',
      noExport: false,
      expected: "/** Possible status values */\nexport type Status = 'a' | 'b';\n"
    }
  ]

  for (const definitionCase of definitionCases) {
    await testContext.step(definitionCase.name, () => {
      const tsDefinition = new TsDefinition({
        context: mockContext,
        identifier: definitionCase.identifier,
        value: value(definitionCase.content),
        description: definitionCase.description,
        noExport: definitionCase.noExport
      }).toString()

      assertEquals(tsDefinition, definitionCase.expected)
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
  tsFile.addReExports([TsReExport.fromConcise('./shared', [createVariable('helper')])])
  tsFile.addImports([TsImport.fromConcise('zod', ['z']), TsImport.fromConcise('@/models', ['User', 'Account'])])
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('Account'), value: value('{ id: string }') })
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
