import { assertEquals } from '@std/assert'
import { matchPackage } from '@/helpers/matchPackage.ts'

const sdk = { rootPath: 'packages/sdk/src', moduleName: '@company/sdk' }
const models = { rootPath: 'packages/sdk/src/models', moduleName: '@company/sdk/models' }
const modelsV2 = { rootPath: 'packages/sdk/src/models/v2', moduleName: '@company/sdk/models/v2' }
const api = { rootPath: 'apps/api/src', moduleName: '@company/api' }

Deno.test('matchPackage: no packages, or no package containing the path, is no match', () => {
  assertEquals(matchPackage({ path: 'packages/sdk/src/User.ts', packages: undefined }), undefined)
  assertEquals(matchPackage({ path: 'packages/sdk/src/User.ts', packages: [] }), undefined)
  assertEquals(matchPackage({ path: 'apps/web/src/main.ts', packages: [sdk, api] }), undefined)
  assertEquals(matchPackage({ path: 'zod', packages: [sdk, api] }), undefined)
})

Deno.test('matchPackage: one containing root is both ends of the match', () => {
  assertEquals(matchPackage({ path: 'packages/sdk/src/config.ts', packages: [sdk, api] }), {
    outermost: sdk,
    innermost: sdk
  })
})

Deno.test('matchPackage: sibling roots never join a match', () => {
  const match = matchPackage({ path: 'apps/api/src/routes/users.ts', packages: [sdk, models, api] })

  assertEquals(match, { outermost: api, innermost: api })
})

Deno.test('matchPackage: nested roots resolve to the widest and narrowest, in any listed order', () => {
  const path = 'packages/sdk/src/models/v2/User.ts'
  const expected = { outermost: sdk, innermost: modelsV2 }

  assertEquals(matchPackage({ path, packages: [sdk, models, modelsV2, api] }), expected)
  assertEquals(matchPackage({ path, packages: [api, modelsV2, models, sdk] }), expected)
  assertEquals(matchPackage({ path, packages: [models, api, sdk, modelsV2] }), expected)
})

Deno.test('matchPackage: a path in the middle of a chain stops at the root that holds it', () => {
  const match = matchPackage({
    path: 'packages/sdk/src/models/User.ts',
    packages: [sdk, models, modelsV2]
  })

  assertEquals(match, { outermost: sdk, innermost: models })
})

Deno.test('matchPackage: a directory import of a root belongs to that root', () => {
  assertEquals(
    matchPackage({ path: 'packages/sdk/src/models', packages: [sdk, models, modelsV2] }),
    {
      outermost: sdk,
      innermost: models
    }
  )
  assertEquals(matchPackage({ path: 'packages/sdk/src', packages: [sdk, models] }), {
    outermost: sdk,
    innermost: sdk
  })
})

Deno.test('matchPackage: roots and the path match in any spelling, and the match is canonical', () => {
  const match = matchPackage({
    path: '@/packages/sdk/src/models/User.ts',
    packages: [
      { rootPath: './packages/sdk/src/', moduleName: '@company/sdk' },
      { rootPath: '@/packages/sdk/src/models', moduleName: '@company/sdk/models' }
    ]
  })

  assertEquals(match, { outermost: sdk, innermost: models })
})
