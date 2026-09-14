/**
 * Tests for the `packages` field of {@link ClientSettings} — focused
 * on the `..`-segment rejection in `modulePackage.rootPath`.
 *
 * A package `rootPath` must be a forward path: `basePath` is the
 * common on-disk anchor, so every package sits forward from it.
 * `..` segments mean `basePath` was placed too deep — a misconfig
 * that otherwise misplaces every artifact silently.
 */

import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { clientSettings, modulePackage } from './Settings.ts'

Deno.test('modulePackage - accepts a forward rootPath', () => {
  const parsed = v.parse(modulePackage, {
    rootPath: 'packages/models/src',
    moduleName: '@app/models'
  })
  assertEquals(parsed.rootPath, 'packages/models/src')
  assertEquals(parsed.moduleName, '@app/models')
})

Deno.test('modulePackage - rejects a rootPath that escapes with `..`', () => {
  assertThrows(() => v.parse(modulePackage, { rootPath: '../../packages/models/src' }))
})

Deno.test('modulePackage - rejects a `..` segment anywhere in rootPath', () => {
  assertThrows(() => v.parse(modulePackage, { rootPath: 'apps/../packages/models' }))
})

Deno.test('modulePackage - a name that merely contains dots is not a `..` segment', () => {
  // `..` is a parent reference only as a whole path segment; a
  // directory name that happens to contain dots is fine.
  const parsed = v.parse(modulePackage, { rootPath: 'packages/my..pkg/src' })
  assertEquals(parsed.rootPath, 'packages/my..pkg/src')
})

Deno.test('clientSettings - rejects a packages entry whose rootPath escapes with `..`', () => {
  assertThrows(() =>
    v.parse(clientSettings, {
      basePath: 'skmtc-hub',
      packages: [{ rootPath: '../models', moduleName: '@app/models' }]
    })
  )
})

Deno.test('clientSettings - accepts forward-path packages', () => {
  const parsed = v.parse(clientSettings, {
    basePath: 'skmtc-hub',
    packages: [
      { rootPath: 'packages/models/src', moduleName: '@app/models' },
      { rootPath: 'apps/mock-server', moduleName: '@app/mock-server' }
    ]
  })
  assertEquals(parsed.packages?.length, 2)
})

Deno.test('clientSettings - rejects one package root listed twice, however it is spelled', () => {
  assertThrows(
    () =>
      v.parse(clientSettings, {
        packages: [
          { rootPath: 'packages/models/src', moduleName: '@app/models' },
          { rootPath: './packages/models/src/' }
        ]
      }),
    Error,
    "package rootPath './packages/models/src/' is already listed as 'packages/models/src'"
  )
})

Deno.test('clientSettings - rejects the workspace root as a package root', () => {
  for (const rootPath of ['.', './', '@/', '']) {
    assertThrows(
      () => v.parse(clientSettings, { packages: [{ rootPath, moduleName: '@app/root' }] }),
      Error,
      'is the workspace root',
      `rootPath '${rootPath}'`
    )
  }
})

Deno.test('clientSettings - accepts nested roots, named or not', () => {
  // A nested root is a subpath export. Whether it needs a moduleName is a
  // language question (TypeScript imports by it, Kotlin does not), so the
  // schema does not decide it.
  const parsed = v.parse(clientSettings, {
    packages: [
      { rootPath: 'packages/sdk/src/models', moduleName: '@app/sdk/models' },
      { rootPath: 'packages/sdk/src', moduleName: '@app/sdk' },
      { rootPath: 'packages/sdk/src/internal' }
    ]
  })
  assertEquals(parsed.packages?.length, 3)
})
