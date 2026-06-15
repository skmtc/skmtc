import { assertEquals } from '@std/assert'
import { createClass, createInterface, createNamespace, createType, createVariable } from './createIdentifier.ts'
import { toGeneratorOnlyKey } from '@skmtc/core'
import type { GeneratedValue, GenerateContextType } from '@skmtc/core'
import { TsDefinition } from './TsDefinition.ts'
import { TsFile } from './TsFile.ts'
import { TsImport } from './TsImport.ts'
import { TsReExport } from './TsReExport.ts'
import { typescript } from './tsLang.ts'

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
      expected: "/**\n * Possible status values\n */\nexport type Status = 'a' | 'b';\n"
    },
    {
      name: 'block-form class (value carries heritage + body, no `=`/`;`)',
      identifier: createClass('Models'),
      content: 'extends APIResource {\n  retrieve() {}\n}',
      description: undefined,
      noExport: false,
      expected: 'export class Models extends APIResource {\n  retrieve() {}\n}\n'
    },
    {
      name: 'block-form interface',
      identifier: createInterface('Model'),
      content: '{\n  id: string;\n}',
      description: undefined,
      noExport: false,
      expected: 'export interface Model {\n  id: string;\n}\n'
    },
    {
      name: 'block-form declare namespace',
      identifier: createNamespace('Models'),
      content: '{\n  export { type Model as Model };\n}',
      description: undefined,
      noExport: false,
      expected: 'export declare namespace Models {\n  export { type Model as Model };\n}\n'
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

Deno.test('TsFile renders a banner above the body', () => {
  const tsFile = new TsFile({ path: '@/resources/models.generated.ts', settings: undefined })
  tsFile.banner = '// File generated by skmtc.'
  tsFile.addImports([TsImport.fromConcise('../core/resource', ['APIResource'])])
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('X'), value: value('{ id: string }') })
  )

  assertEquals(
    tsFile.toString(),
    `// File generated by skmtc.\n\nimport {APIResource} from '../core/resource'\n\nexport type X = { id: string };\n`
  )
})

Deno.test('toDefinition falls back to the value description for the JSDoc', () => {
  const valueWithDescription = {
    generatorKey,
    toString: () => 'extends APIResource {}',
    description: 'The models resource.'
  }

  const definition = typescript.toDefinition({
    context: mockContext,
    identifier: createClass('Models'),
    value: valueWithDescription,
    noExport: false
  })

  assertEquals(
    definition.toString(),
    '/**\n * The models resource.\n */\nexport class Models extends APIResource {}\n'
  )
})

Deno.test('TsFile renders same-name companions (declaration merging) after primaries', () => {
  const tsFile = new TsFile({ path: '@/resources/models.generated.ts', settings: undefined })

  const classDef = new TsDefinition({
    context: mockContext,
    identifier: createClass('Models'),
    value: value('extends APIResource {}')
  })
  const interfaceDef = new TsDefinition({
    context: mockContext,
    identifier: createInterface('Model'),
    value: value('{ id: string }')
  })
  const namespaceDef = new TsDefinition({
    context: mockContext,
    identifier: createNamespace('Models'),
    value: value('{ export { type Model as Model } }')
  })

  tsFile.addDefinition(classDef)
  tsFile.addDefinition(interfaceDef)
  tsFile.addDefinition(namespaceDef) // same name as the class → companion
  tsFile.addDefinition(classDef) // exact re-add → idempotent no-op

  assertEquals(tsFile.mergedDefinitions.length, 1)
  assertEquals(
    tsFile.toString(),
    `export class Models extends APIResource {}\n\nexport interface Model { id: string }\n\nexport declare namespace Models { export { type Model as Model } }\n`
  )
})

Deno.test('TsFile collapses same-name + same-kind definitions (duplicate, not a companion)', () => {
  const tsFile = new TsFile({ path: '@/tables/models.generated.tsx', settings: undefined })

  // Two distinct objects, same identifier (name + kind) — e.g. a `columnHelper`
  // const each table column independently registers. They are the same `const`,
  // so they collapse to one rather than piling up as merge companions.
  const first = new TsDefinition({
    context: mockContext,
    identifier: createVariable('columnHelper'),
    value: value('createColumnHelper<Row>()')
  })
  const second = new TsDefinition({
    context: mockContext,
    identifier: createVariable('columnHelper'),
    value: value('createColumnHelper<Row>()')
  })

  tsFile.addDefinition(first)
  tsFile.addDefinition(second)

  assertEquals(tsFile.mergedDefinitions.length, 0)
  assertEquals(tsFile.toString(), `export const columnHelper = createColumnHelper<Row>();\n`)
})

Deno.test('TsFile collapses same-name + same-kind even when the value differs (the identifier is the key)', () => {
  const tsFile = new TsFile({ path: '@/types/models.generated.ts', settings: undefined })

  // Same name + same kind (`type`) — TS cannot redeclare a type alias, so the
  // first wins and the second is dropped (not merged), regardless of value.
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('Id'), value: value('string') })
  )
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('Id'), value: value('number') })
  )

  assertEquals(tsFile.mergedDefinitions.length, 0)
  assertEquals(tsFile.toString(), `export type Id = string;\n`)
})

Deno.test('TsFile renders the legacy-pinned cross-package import normalisation', () => {
  const settings = { packages: [{ rootPath: 'packages/models/src', moduleName: '@app/models' }] }
  const path = 'packages/client/src/api.generated.ts'

  const tsFile = new TsFile({ path, settings })
  tsFile.addImports([TsImport.fromConcise('packages/models/src/User.ts', ['User'])])

  assertEquals(tsFile.toString(), `import {User} from '@app/models'`)
})
