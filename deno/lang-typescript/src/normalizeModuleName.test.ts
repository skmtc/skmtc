import { assertEquals, assertThrows } from '@std/assert'
import { normalizeModuleName } from './normalizeModuleName.ts'

const flat = [
  { rootPath: 'packages/types', moduleName: '@company/types' },
  { rootPath: 'packages/client', moduleName: '@company/client' }
]

Deno.test("normalizeModuleName: a target in another package is that package's moduleName", () => {
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/client/src/api.ts',
      exportPath: 'packages/types/models/User.ts',
      packages: flat
    }),
    '@company/types'
  )
})

Deno.test('normalizeModuleName: a target in the same package is @/ from the package root', () => {
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/types/src/index.ts',
      exportPath: 'packages/types/models/User.ts',
      packages: flat
    }),
    '@/models/User.ts'
  )
})

Deno.test('normalizeModuleName: a target under no package keeps its path', () => {
  assertEquals(
    normalizeModuleName({
      destinationPath: 'src/index.ts',
      exportPath: 'src/utils.ts',
      packages: flat
    }),
    'src/utils.ts'
  )
  assertEquals(
    normalizeModuleName({
      destinationPath: 'src/index.ts',
      exportPath: 'src/utils.ts',
      packages: undefined
    }),
    'src/utils.ts'
  )
})

Deno.test('normalizeModuleName: a package without a moduleName cannot be imported from outside', () => {
  assertThrows(
    () =>
      normalizeModuleName({
        destinationPath: 'apps/web/src/main.ts',
        exportPath: 'packages/types/models/User.ts',
        packages: [{ rootPath: 'packages/types' }]
      }),
    Error,
    'packages/types'
  )
})

Deno.test('normalizeModuleName: a root is a folder, not a string prefix', () => {
  // packages/sdk-legacy shares the characters of packages/sdk and is not inside it.
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/sdk/src/a.ts',
      exportPath: 'packages/sdk-legacy/src/b.ts',
      packages: [{ rootPath: 'packages/sdk', moduleName: '@company/sdk' }]
    }),
    'packages/sdk-legacy/src/b.ts'
  )
  // A trailing slash on the root changes nothing.
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/sdk/src/a.ts',
      exportPath: 'packages/sdk/src/b.ts',
      packages: [{ rootPath: 'packages/sdk/', moduleName: '@company/sdk' }]
    }),
    '@/src/b.ts'
  )
})

// A nested root is a subpath export of the package around it. Listed
// innermost-first here on purpose: order must not matter.
const nested = [
  { rootPath: 'packages/sdk/src/models', moduleName: '@company/sdk/models' },
  { rootPath: 'packages/sdk/src/client', moduleName: '@company/sdk/client' },
  { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
  { rootPath: 'apps/api/src', moduleName: '@company/api' }
]

Deno.test('normalizeModuleName: inside the package, a subpath target is @/ from the outermost root', () => {
  // Across subpaths of one package: one alias, rooted at the package.
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/sdk/src/client/getUser.ts',
      exportPath: 'packages/sdk/src/models/User.ts',
      packages: nested
    }),
    '@/models/User.ts'
  )
  // Within one subpath: the same alias, so a file's imports never depend on
  // which subpath it happens to be in.
  assertEquals(
    normalizeModuleName({
      destinationPath: 'packages/sdk/src/models/Order.ts',
      exportPath: 'packages/sdk/src/models/User.ts',
      packages: nested
    }),
    '@/models/User.ts'
  )
})

Deno.test('normalizeModuleName: outside the package, a subpath target is the innermost moduleName', () => {
  assertEquals(
    normalizeModuleName({
      destinationPath: 'apps/api/src/routes/users.ts',
      exportPath: 'packages/sdk/src/models/User.ts',
      packages: nested
    }),
    '@company/sdk/models'
  )
  // A file under the package but no subpath is the package itself.
  assertEquals(
    normalizeModuleName({
      destinationPath: 'apps/api/src/routes/users.ts',
      exportPath: 'packages/sdk/src/config.ts',
      packages: nested
    }),
    '@company/sdk'
  )
})

Deno.test('normalizeModuleName: a subpath needs its own moduleName to be imported from outside', () => {
  assertThrows(
    () =>
      normalizeModuleName({
        destinationPath: 'apps/api/src/routes/users.ts',
        exportPath: 'packages/sdk/src/models/User.ts',
        packages: [
          { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
          { rootPath: 'packages/sdk/src/models' }
        ]
      }),
    Error,
    'packages/sdk/src/models'
  )
})
