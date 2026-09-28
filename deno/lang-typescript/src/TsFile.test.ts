import { assertEquals } from '@std/assert'
import {
  createClass,
  createInterface,
  createNamespace,
  createType,
  createVariable
} from './createIdentifier.ts'
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
 * produced — re-exports, imports (with package normalization), then
 * definitions. The expected literal below was pinned against the legacy
 * class before core's `File` was deleted (step 5 of the convergence
 * tracker).
 */
Deno.test('TsFile renders the legacy-pinned file — imports + definitions + reExports', () => {
  const path = '@/types/models.generated.ts'

  const tsFile = new TsFile({ path, settings: undefined })
  tsFile.addReExports([TsReExport.fromConcise('./shared', [createVariable('helper')])])
  tsFile.addImports([
    TsImport.fromConcise('zod', ['z']),
    TsImport.fromConcise('@/models', ['User', 'Account'])
  ])
  tsFile.addDefinition(
    new TsDefinition({
      context: mockContext,
      identifier: createType('Account'),
      value: value('{ id: string }')
    })
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

Deno.test('TsFile renders custom content above the body', () => {
  const tsFile = new TsFile({ path: '@/resources/models.generated.ts', settings: undefined })
  tsFile.custom = '// File generated by skmtc.'
  tsFile.addImports([TsImport.fromConcise('../core/resource', ['APIResource'])])
  tsFile.addDefinition(
    new TsDefinition({
      context: mockContext,
      identifier: createType('X'),
      value: value('{ id: string }')
    })
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

Deno.test('TsFile renders declaration-merging slots — class + same-name namespace co-exist', () => {
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
  tsFile.addDefinition(namespaceDef) // same name, different type → its own declaration slot
  tsFile.addDefinition(classDef) // exact re-add → idempotent no-op

  assertEquals(tsFile.definitions.size, 3) // 'class Models', 'interface Model', 'declare namespace Models' — one map, no overflow lane
  assertEquals(
    tsFile.toString(),
    `export class Models extends APIResource {}\n\nexport interface Model { id: string }\n\nexport declare namespace Models { export { type Model as Model } }\n`
  )
})

Deno.test('TsFile defers a same-name companion (declare namespace) after primaries, whatever the registration order', () => {
  const tsFile = new TsFile({ path: '@/resources/models.generated.ts', settings: undefined })

  const classDef = new TsDefinition({
    context: mockContext,
    identifier: createClass('Models'),
    value: value('extends APIResource {}')
  })
  const namespaceDef = new TsDefinition({
    context: mockContext,
    identifier: createNamespace('Models'),
    value: value('{ export { type Model as Model } }')
  })
  const interfaceDef = new TsDefinition({
    context: mockContext,
    identifier: createInterface('Model'),
    value: value('{ id: string }')
  })

  // The namespace is registered BEFORE the `Model` interface primary — but it
  // is a companion of `class Models` (same name, different kind), so it must
  // still render last (TS declaration-merge layout; Stainless's resource files).
  tsFile.addDefinition(classDef)
  tsFile.addDefinition(namespaceDef)
  tsFile.addDefinition(interfaceDef)

  assertEquals(
    tsFile.toString(),
    `export class Models extends APIResource {}\n\nexport interface Model { id: string }\n\nexport declare namespace Models { export { type Model as Model } }\n`
  )
})

Deno.test('TsFile collapses same-name + same-type definitions into one slot', () => {
  const tsFile = new TsFile({ path: '@/tables/models.generated.tsx', settings: undefined })

  // Two distinct objects, same identifier (name + type) — e.g. a `columnHelper`
  // const each table column independently registers. They are the same `const`,
  // so they share one declaration slot and collapse to one.
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

  assertEquals(tsFile.definitions.size, 1)
  assertEquals(tsFile.toString(), `export const columnHelper = createColumnHelper<Row>();\n`)
})

Deno.test('TsFile collapses same-name + same-type even when the value differs (the identifier is the key)', () => {
  const tsFile = new TsFile({ path: '@/types/models.generated.ts', settings: undefined })

  // Same name + same type (`type`) — TS cannot redeclare a type alias, so the
  // first wins and the second is dropped (not merged), regardless of value.
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('Id'), value: value('string') })
  )
  tsFile.addDefinition(
    new TsDefinition({ context: mockContext, identifier: createType('Id'), value: value('number') })
  )

  assertEquals(tsFile.definitions.size, 1)
  assertEquals(tsFile.toString(), `export type Id = string;\n`)
})

Deno.test('TsFile renders the legacy-pinned cross-package import normalization', () => {
  const settings = { packages: [{ rootPath: 'packages/models/src', moduleName: '@app/models' }] }
  const path = 'packages/client/src/api.generated.ts'

  const tsFile = new TsFile({ path, settings })
  tsFile.addImports([TsImport.fromConcise('@/packages/models/src/User.ts', ['User'])])

  assertEquals(tsFile.toString(), `import {User} from '@app/models'`)
})

Deno.test('TsFile renders nested package roots: one @ inside the package, subpath names outside, bare specifiers untouched', () => {
  const settings = {
    packages: [
      { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
      { rootPath: 'packages/sdk/src/models', moduleName: '@company/sdk/models' }
    ]
  }

  // Inside the package: a generator wrote the import with Skmtc's
  // workspace-root `@/`; the file gets the package's `@/`.
  const client = new TsFile({ path: 'packages/sdk/src/client/getUser.generated.ts', settings })
  client.addImports([
    TsImport.fromConcise('@/packages/sdk/src/models/User.generated.ts', ['User']),
    TsImport.fromConcise('zod', ['z'])
  ])

  assertEquals(
    client.toString(),
    `import {User} from '@/models/User.generated.ts'\nimport {z} from 'zod'`
  )

  // Outside the package: the subpath export.
  const route = new TsFile({ path: 'apps/api/src/routes/users.generated.ts', settings })
  route.addImports([TsImport.fromConcise('@/packages/sdk/src/models/User.generated.ts', ['User'])])

  assertEquals(route.toString(), `import {User} from '@company/sdk/models'`)

  // A barrel re-exports through the same normalization as imports.
  const barrel = new TsFile({ path: 'packages/sdk/src/index.generated.ts', settings })
  barrel.addReExports([
    TsReExport.fromConcise('@/packages/sdk/src/models/User.generated.ts', [createType('User')])
  ])

  assertEquals(barrel.toString(), `export type { User } from '@/models/User.generated.ts'`)
})

Deno.test('TsFile merges two spellings of one artifact into one import statement', () => {
  const settings = { packages: [{ rootPath: 'packages/sdk/src', moduleName: '@company/sdk' }] }

  const tsFile = new TsFile({ path: 'packages/sdk/src/client/getUser.generated.ts', settings })
  tsFile.addImports([
    TsImport.fromConcise('@/packages/sdk/src/models/User.generated.ts', ['User']),
    TsImport.fromConcise('./packages/sdk/src/models/User.generated.ts', ['User', 'UserId'])
  ])

  assertEquals(tsFile.toString(), `import {User, UserId} from '@/models/User.generated.ts'`)
})

Deno.test('TsFile renders one statement per subpath export, however many artifacts it holds', () => {
  const settings = {
    packages: [
      { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
      { rootPath: 'packages/sdk/src/models', moduleName: '@company/sdk/models' }
    ]
  }

  const route = new TsFile({ path: 'apps/api/src/routes/users.generated.ts', settings })
  route.addImports([
    TsImport.fromConcise('@/packages/sdk/src/models/User.generated.ts', ['User']),
    TsImport.fromConcise('@/packages/sdk/src/models/Order.generated.ts', ['Order']),
    TsImport.fromConcise('@/packages/sdk/src/config.generated.ts', ['config'])
  ])

  assertEquals(
    route.toString(),
    `import {User, Order} from '@company/sdk/models'\nimport {config} from '@company/sdk'`
  )

  const barrel = new TsFile({ path: 'apps/api/src/index.generated.ts', settings })
  barrel.addReExports([
    TsReExport.fromConcise('@/packages/sdk/src/models/User.generated.ts', [createType('User')]),
    TsReExport.fromConcise('@/packages/sdk/src/models/Order.generated.ts', [createType('Order')])
  ])

  assertEquals(barrel.toString(), `export type { User, Order } from '@company/sdk/models'`)
})

Deno.test('TsFile without packages keeps each spelling as written — no merge across spellings', () => {
  // With no packages, `./x` is importer-relative TypeScript and `@/x` is the
  // consumer's alias; they are different modules and stay separate.
  const tsFile = new TsFile({ path: 'client/getUser.generated.ts', settings: undefined })
  tsFile.addImports([
    TsImport.fromConcise('./models/User.generated.ts', ['A']),
    TsImport.fromConcise('@/models/User.generated.ts', ['B'])
  ])

  assertEquals(
    tsFile.toString(),
    `import {A} from './models/User.generated.ts'\nimport {B} from '@/models/User.generated.ts'`
  )
})
