import { assertEquals } from 'jsr:@std/assert@^1.0.9'
import { normaliseModuleName } from './File.ts'

Deno.test('Uses appRoot for internal imports when provided', () => {
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

Deno.test('Uses full path for internal imports when appRoot is not provided', () => {
  const normalisedModuleName = normaliseModuleName({
    destinationPath: '@/apps/dashboard/src/components/component.ts',
    exportPath: '@/apps/dashboard/src/some/item.ts',
    packages: undefined
  })

  assertEquals(normalisedModuleName, '@/apps/dashboard/src/some/item.ts')
})

Deno.test('Uses module name for external imports when provided', () => {
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
