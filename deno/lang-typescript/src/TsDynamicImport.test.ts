import { assertEquals } from '@std/assert'
import type { ClientSettings, GenerateContextType } from '@skmtc/core'
import { TsDynamicImport } from './TsDynamicImport.ts'
import { TsFile } from './TsFile.ts'
import { TsImport } from './TsImport.ts'

const contextWith = (settings: ClientSettings | undefined): GenerateContextType =>
  ({ settings }) as GenerateContextType

Deno.test('a dynamic import writes the module text a header import in the same file gets', () => {
  // Packages turn a workspace path into a package name, per destination file.
  const settings = { packages: [{ rootPath: 'packages/sdk/src', moduleName: '@company/sdk' }] }
  const destinationPath = 'apps/cli/src/index.generated.ts'
  const module = '@/packages/sdk/src/config.generated.ts'

  const header = new TsFile({ path: destinationPath, settings })
  header.addImports([TsImport.fromConcise(module, ['config'])])

  const dynamic = new TsDynamicImport({ context: contextWith(settings), module, destinationPath })

  assertEquals(header.toString(), `import {config} from '@company/sdk'`)
  assertEquals(`${dynamic}`, `import('@company/sdk')`)
})

Deno.test('with no packages, a dynamic import writes the module as registered', () => {
  const dynamic = new TsDynamicImport({
    context: contextWith(undefined),
    module: '@/cli/d1/index.generated.ts',
    destinationPath: '@/cli/index.generated.ts'
  })

  assertEquals(`${dynamic}`, `import('@/cli/d1/index.generated.ts')`)
})
