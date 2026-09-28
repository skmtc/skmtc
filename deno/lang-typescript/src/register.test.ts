import { GenerateContext, OasDocument } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import { Logger } from '@std/log'
import { assertEquals, assertInstanceOf } from '@std/assert'
import { register } from '@/src/register.ts'
import { TsFile } from '@/src/TsFile.ts'
import { createType } from '@/src/createIdentifier.ts'

const toGenerateContext = (): GenerateContextType => {
  return new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new Logger('test', 'CRITICAL'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

const renderedFile = (context: GenerateContextType, path: string): string => {
  const file = context.getFile(path)
  assertInstanceOf(file, TsFile)
  return file.toString()
}

Deno.test('register drops a self-import in every workspace spelling; a bare string is a specifier', () => {
  const context = toGenerateContext()

  register(context, {
    destinationPath: '@/types/x.ts',
    imports: {
      '@\\types\\x.ts': ['X'],
      './types/x.ts': ['X'],
      '/types/x.ts': ['X'],
      'types/x.ts': ['X'],
      '@/types/y.ts': ['Y']
    }
  })

  // `types/x.ts` is a package specifier here, not the destination file.
  assertEquals(
    renderedFile(context, '@/types/x.ts'),
    "import {X} from 'types/x.ts'\nimport {Y} from '@/types/y.ts'"
  )
})

Deno.test('register with a Windows-spelled destinationPath writes into the existing file', () => {
  const context = toGenerateContext()

  register(context, { destinationPath: '@/types/x.ts', imports: { '@/types/y.ts': ['Y'] } })
  register(context, { destinationPath: '@\\types\\x.ts', imports: { '@/types/z.ts': ['Z'] } })

  assertEquals(context.inspectedFiles.size, 1)
  assertEquals(
    renderedFile(context, '@/types/x.ts'),
    "import {Y} from '@/types/y.ts'\nimport {Z} from '@/types/z.ts'"
  )
})

Deno.test('register writes a workspace-spelled module in its one spelling and merges the spellings', () => {
  const context = toGenerateContext()

  register(context, {
    destinationPath: '@/types/x.ts',
    imports: { '@\\types\\y.ts': ['Y'], './types/y.ts': ['Y3'], zod: ['z'] },
    reExports: { '.\\types\\z.ts': [createType('Z')] }
  })

  assertEquals(
    renderedFile(context, '@/types/x.ts'),
    "export type { Z } from '@/types/z.ts'\n\n" +
      "import {Y, Y3} from '@/types/y.ts'\nimport {z} from 'zod'"
  )
})

Deno.test('register renders the peer import exactly as issue #147 expects', () => {
  const context = toGenerateContext()

  register(context, {
    destinationPath: '@/types/widget.generated.ts',
    imports: { '@/types/widgetOwner.generated.ts': [{ name: 'WidgetOwner', type: 'type' }] }
  })

  assertEquals(
    renderedFile(context, '@/types/widget.generated.ts'),
    "import type {WidgetOwner} from '@/types/widgetOwner.generated.ts'"
  )
})
