import { GenerateContext, OasDocument } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { assertEquals, assertInstanceOf } from '@std/assert'
import { register } from './register.ts'
import { TsFile } from './TsFile.ts'

const toGenerateContext = (): GenerateContextType => {
  return new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

Deno.test('register drops a self-import whatever spelling it arrives in', () => {
  const context = toGenerateContext()

  register(context, {
    destinationPath: '@/types/x.ts',
    imports: {
      '@\\types\\x.ts': ['X'],
      './types/x.ts': ['X'],
      '@/types/y.ts': ['Y']
    }
  })

  const file = context.getFile('@/types/x.ts')
  assertInstanceOf(file, TsFile)
  assertEquals(file.toString(), "import {Y} from '@/types/y.ts'")
})

Deno.test('register with a Windows-spelled destinationPath writes into the existing file', () => {
  const context = toGenerateContext()

  register(context, { destinationPath: '@/types/x.ts', imports: { '@/types/y.ts': ['Y'] } })
  register(context, { destinationPath: '@\\types\\x.ts', imports: { '@/types/z.ts': ['Z'] } })

  assertEquals(context.inspectedFiles.size, 1)

  const file = context.getFile('@/types/x.ts')
  assertInstanceOf(file, TsFile)
  assertEquals(file.toString(), "import {Y} from '@/types/y.ts'\nimport {Z} from '@/types/z.ts'")
})

Deno.test('register renders the peer import exactly as issue #147 expects', () => {
  const context = toGenerateContext()

  register(context, {
    destinationPath: '@/types/widget.generated.ts',
    imports: { '@/types/widgetOwner.generated.ts': [{ name: 'WidgetOwner', type: 'type' }] }
  })

  const file = context.getFile('@/types/widget.generated.ts')
  assertInstanceOf(file, TsFile)
  assertEquals(file.toString(), "import type {WidgetOwner} from '@/types/widgetOwner.generated.ts'")
})
