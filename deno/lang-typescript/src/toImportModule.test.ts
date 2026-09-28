import { assertEquals, assertThrows } from '@std/assert'
import { toImportModule } from '@/src/toImportModule.ts'

const flat = [
  { rootPath: 'packages/types', moduleName: '@company/types' },
  { rootPath: 'packages/client', moduleName: '@company/client' }
]

Deno.test('toImportModule: a target under no package is written as given', () => {
  // A bare specifier — the import is not an artifact at all.
  assertEquals(
    toImportModule({
      destinationPath: 'packages/client/src/api.ts',
      module: 'zod',
      packages: flat
    }),
    'zod'
  )
  assertEquals(
    toImportModule({
      destinationPath: 'packages/client/src/api.ts',
      module: '@tanstack/react-query',
      packages: flat
    }),
    '@tanstack/react-query'
  )
  // A project without packages: the generator's workspace-root `@/` is what
  // the consumer's tsconfig maps to basePath, so it stays.
  assertEquals(
    toImportModule({
      destinationPath: '@/api.ts',
      module: '@/types/User.ts',
      packages: undefined
    }),
    '@/types/User.ts'
  )
  assertEquals(
    toImportModule({
      destinationPath: 'src/index.ts',
      module: 'src/utils.ts',
      packages: []
    }),
    'src/utils.ts'
  )
})

Deno.test('toImportModule: a target in the same package is @/ from the package root', () => {
  assertEquals(
    toImportModule({
      destinationPath: 'packages/types/src/index.ts',
      module: '@/packages/types/models/User.ts',
      packages: flat
    }),
    '@/models/User.ts'
  )
})

Deno.test("toImportModule: a target in another package is that package's moduleName", () => {
  assertEquals(
    toImportModule({
      destinationPath: 'packages/client/src/api.ts',
      module: '@/packages/types/models/User.ts',
      packages: flat
    }),
    '@company/types'
  )
})

Deno.test('toImportModule: a package without a moduleName cannot be imported from outside', () => {
  assertThrows(
    () =>
      toImportModule({
        destinationPath: 'apps/web/src/main.ts',
        module: '@/packages/types/models/User.ts',
        packages: [{ rootPath: 'packages/types' }]
      }),
    Error,
    "Package root 'packages/types' has no moduleName, but 'apps/web/src/main.ts' imports '@/packages/types/models/User.ts' from outside it. Set moduleName on that root in settings.packages."
  )
})

const nested = [
  { rootPath: 'packages/sdk/src/models', moduleName: '@company/sdk/models' },
  { rootPath: 'packages/sdk/src/client', moduleName: '@company/sdk/client' },
  { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
  { rootPath: 'apps/api/src', moduleName: '@company/api' }
]

Deno.test('toImportModule: inside the package, every file shares one @ rooted at the outermost root', () => {
  // Across subpaths: client → models.
  assertEquals(
    toImportModule({
      destinationPath: 'packages/sdk/src/client/getUser.ts',
      module: '@/packages/sdk/src/models/User.ts',
      packages: nested
    }),
    '@/models/User.ts'
  )
  // From a subpath up to the package root.
  assertEquals(
    toImportModule({
      destinationPath: 'packages/sdk/src/models/User.ts',
      module: '@/packages/sdk/src/config.ts',
      packages: nested
    }),
    '@/config.ts'
  )
})

Deno.test('toImportModule: outside the package, a target is the innermost moduleName', () => {
  assertEquals(
    toImportModule({
      destinationPath: 'apps/api/src/routes/users.ts',
      module: '@/packages/sdk/src/models/User.ts',
      packages: nested
    }),
    '@company/sdk/models'
  )
  assertEquals(
    toImportModule({
      destinationPath: 'apps/api/src/routes/users.ts',
      module: '@/packages/sdk/src/config.ts',
      packages: nested
    }),
    '@company/sdk'
  )
})

Deno.test('toImportModule: a directory import of a root is that root — its barrel', () => {
  // Outside the package: the subpath's own name, and the package's.
  assertEquals(
    toImportModule({
      destinationPath: 'apps/api/src/routes/users.ts',
      module: '@/packages/sdk/src/models',
      packages: nested
    }),
    '@company/sdk/models'
  )
  assertEquals(
    toImportModule({
      destinationPath: 'apps/api/src/routes/users.ts',
      module: '@/packages/sdk/src',
      packages: nested
    }),
    '@company/sdk'
  )
  // Inside the package: the subpath folder behind the package alias.
  assertEquals(
    toImportModule({
      destinationPath: 'packages/sdk/src/client/getUser.ts',
      module: '@/packages/sdk/src/models',
      packages: nested
    }),
    '@/models'
  )
})

Deno.test('toImportModule: a package file cannot import a workspace-root path under no package', () => {
  assertThrows(
    () =>
      toImportModule({
        destinationPath: 'packages/sdk/src/client/getUser.ts',
        module: '@/shared/util.ts',
        packages: nested
      }),
    Error,
    "'packages/sdk/src/client/getUser.ts' is in package root 'packages/sdk/src' but imports '@/shared/util.ts', which is under no package root"
  )
  // Outside every package, the workspace-root spelling is the consumer's own alias.
  assertEquals(
    toImportModule({
      destinationPath: 'apps/web/src/main.ts',
      module: '@/shared/util.ts',
      packages: nested
    }),
    '@/shared/util.ts'
  )
  // A bare specifier is not a workspace path and always passes through.
  assertEquals(
    toImportModule({
      destinationPath: 'packages/sdk/src/client/getUser.ts',
      module: 'zod',
      packages: nested
    }),
    'zod'
  )
})

Deno.test('toImportModule: a bare string is a specifier even when a root shares its first segment', () => {
  // `register` leaves a bare string as a specifier; render must not read the
  // same string as a path and re-key it through a package root.
  assertEquals(
    toImportModule({
      destinationPath: '@/app/x.ts',
      module: 'packages/types/models/User.ts',
      packages: flat
    }),
    'packages/types/models/User.ts'
  )
})

Deno.test('toImportModule: a subpath needs its own moduleName to be imported from outside', () => {
  assertThrows(
    () =>
      toImportModule({
        destinationPath: 'apps/api/src/routes/users.ts',
        module: '@/packages/sdk/src/models/User.ts',
        packages: [
          { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' },
          { rootPath: 'packages/sdk/src/models' }
        ]
      }),
    Error,
    "a nested root is a subpath export and needs its own name, like '@company/sdk/models'."
  )
})

Deno.test('toImportModule: the three path sources may spell the workspace root differently', () => {
  // rootPath as written in config (`./`), destinationPath as std-normalized
  // File.path (no prefix), module as the generator wrote it (`./` or `@/`).
  const packages = [
    { rootPath: './packages/sdk/src', moduleName: '@company/sdk' },
    { rootPath: './packages/sdk/src/models', moduleName: '@company/sdk/models' }
  ]

  assertEquals(
    toImportModule({
      destinationPath: 'packages/sdk/src/client/getUser.ts',
      module: './packages/sdk/src/models/User.ts',
      packages
    }),
    '@/models/User.ts'
  )
  assertEquals(
    toImportModule({
      destinationPath: 'apps/api/src/routes/users.ts',
      module: '@/packages/sdk/src/models/User.ts',
      packages
    }),
    '@company/sdk/models'
  )
})
