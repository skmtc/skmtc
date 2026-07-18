import { GenerateContext, OasDocument } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { assertEquals } from '@std/assert/equals'
import { assertInstanceOf } from '@std/assert/instance-of'
import { register } from './register.ts'
import { KtFile } from './KtFile.ts'

const toGenerateContext = (): GenerateContextType => {
  return new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

const banner = '// Generated file — do not edit.'

Deno.test('custom registers leading content, rendered above the package directive', () => {
  const context = toGenerateContext()
  const destinationPath = '@/com/example/api/User.generated.kt'

  register(context, {
    imports: { 'kotlinx.serialization': ['Serializable'] },
    custom: banner,
    destinationPath
  })

  const file = context.getFile(destinationPath)
  assertInstanceOf(file, KtFile)

  assertEquals(
    file.toString(),
    '// Generated file — do not edit.\n\n' +
      'package com.example.api\n\n' +
      'import kotlinx.serialization.Serializable\n'
  )
})

Deno.test('custom follows the neutral slot semantics — last non-undefined write wins', () => {
  const context = toGenerateContext()
  const destinationPath = '@/com/example/api/User.generated.kt'

  register(context, { custom: banner, destinationPath })
  register(context, { destinationPath })
  register(context, { custom: '// A later banner.', destinationPath })

  const file = context.getFile(destinationPath)
  assertInstanceOf(file, KtFile)
  assertEquals(file.custom, '// A later banner.')
})
