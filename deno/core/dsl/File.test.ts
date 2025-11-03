import { assertEquals } from '@std/assert/equals'
import { File, normaliseModuleName } from './File.ts'
import { Definition } from '@/dsl/Definition.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '../context/generateTypes.ts'

// Minimal mock context for testing
const mockContext = {} as GenerateContextType
const testGeneratorKey = toGeneratorOnlyKey({ generatorId: 'test' })

Deno.test('normaliseModuleName - uses appRoot for internal imports when provided', () => {
  const normalisedModuleName = normaliseModuleName({
    destinationPath: '@/apps/dashboard/src/components/component.ts',
    exportPath: '@/apps/dashboard/src/some/item.ts',
    packages: [
      {
        rootPath: '@/apps/dashboard/src',
        moduleName: '@skmtc/dashboard'
      }
    ]
  })

  assertEquals(normalisedModuleName, '@/some/item.ts')
})

Deno.test(
  'normaliseModuleName - uses full path for internal imports when appRoot is not provided',
  () => {
    const normalisedModuleName = normaliseModuleName({
      destinationPath: '@/apps/dashboard/src/components/component.ts',
      exportPath: '@/apps/dashboard/src/some/item.ts',
      packages: undefined
    })

    assertEquals(normalisedModuleName, '@/apps/dashboard/src/some/item.ts')
  }
)

Deno.test('normaliseModuleName - uses module name for external imports when provided', () => {
  const normalisedModuleName = normaliseModuleName({
    destinationPath: '@/apps/dashboard/src/components/component.ts',
    exportPath: '@/packages/some-package/src/some/item.ts',
    packages: [
      {
        rootPath: '@/packages/some-package/src',
        moduleName: '@skmtc/some-package'
      }
    ]
  })

  assertEquals(normalisedModuleName, '@skmtc/some-package')
})

Deno.test('File - creates empty file with path', () => {
  const file = new File({
    path: './src/models/User.ts',
    settings: undefined
  })

  assertEquals(file.path, './src/models/User.ts')
  assertEquals(file.fileType, 'ts')
  assertEquals(file.toString(), '')
})

Deno.test('File - generates file with imports only', () => {
  const file = new File({
    path: './src/api.ts',
    settings: undefined
  })

  file.imports.set('./types', new Set(['User', 'Product']))

  assertEquals(file.toString(), "import { User, Product } from './types'")
})

Deno.test('File - generates file with definitions only', () => {
  const file = new File({
    path: './src/models.ts',
    settings: undefined
  })

  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createType('User'),
    value: { generatorKey: testGeneratorKey, toString: () => '{ id: string }' }
  })

  file.definitions.set('User', definition)

  assertEquals(file.toString(), 'export type User = { id: string };\n')
})

Deno.test('File - generates file with imports and definitions', () => {
  const file = new File({
    path: './src/api.ts',
    settings: undefined
  })

  file.imports.set('./types', new Set(['BaseModel']))

  const definition = new Definition({
    context: mockContext,
    identifier: Identifier.createType('User'),
    value: { generatorKey: testGeneratorKey, toString: () => 'BaseModel & { name: string }' }
  })

  file.definitions.set('User', definition)

  assertEquals(
    file.toString(),
    "import { BaseModel } from './types'\n\nexport type User = BaseModel & { name: string };\n"
  )
})

Deno.test('File - generates file with re-exports', () => {
  const file = new File({
    path: './src/index.ts',
    settings: undefined
  })

  file.reExports.set('./models', {
    type: new Set(['User', 'Product']),
    const: new Set(['DEFAULT_CONFIG'])
  })

  const output = file.toString()

  // Check both export statements exist (order may vary)
  assertEquals(output.includes("export type { User, Product } from './models'"), true)
  assertEquals(output.includes("export  { DEFAULT_CONFIG } from './models'"), true)
})

Deno.test('File - generates file with multiple imports', () => {
  const file = new File({
    path: './src/api.ts',
    settings: undefined
  })

  file.imports.set('./types', new Set(['User']))
  file.imports.set('./utils', new Set(['validator']))

  const output = file.toString()

  // Check both imports exist
  assertEquals(output.includes("import { User } from './types'"), true)
  assertEquals(output.includes("import { validator } from './utils'"), true)
})
