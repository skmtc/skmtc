import { GenerateContext, OasDocument } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { assertEquals } from '@std/assert/equals'
import { assertInstanceOf } from '@std/assert/instance-of'
import { assertStringIncludes } from '@std/assert/string-includes'
import { KtAnnotation } from './KtAnnotation.ts'
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

Deno.test('an annotation with a packageName self-registers its import (registering leaf)', () => {
  const context = toGenerateContext()
  const destinationPath = '@/com/example/api/User.generated.kt'

  const annotation = new KtAnnotation({
    context,
    name: 'Serializable',
    packageName: 'kotlinx.serialization',
    destinationPath
  })

  assertEquals(`${annotation}`, '@Serializable')

  const file = context.getFile(destinationPath)
  assertInstanceOf(file, KtFile)
  assertStringIncludes(file.toString(), 'import kotlinx.serialization.Serializable')
})

Deno.test('a same-package annotation registers harmlessly — KtFile suppresses at render', () => {
  const context = toGenerateContext()
  const destinationPath = '@/com/example/api/User.generated.kt'

  new KtAnnotation({
    context,
    name: 'LocalMarker',
    packageName: 'com.example.api',
    destinationPath
  })

  const file = context.getFile(destinationPath)
  assertInstanceOf(file, KtFile)
  assertEquals(file.toString().includes('import com.example.api.LocalMarker'), false)
})

Deno.test('an annotation without a packageName renders only (default-scope annotations)', () => {
  const context = toGenerateContext()

  const annotation = new KtAnnotation({ context, name: 'Deprecated', args: ['"use v2"'] })

  assertEquals(`${annotation}`, '@Deprecated("use v2")')
  assertEquals(context.inspectedFiles.size, 0)
})
