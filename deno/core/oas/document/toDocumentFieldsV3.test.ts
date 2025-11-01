import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toDocumentFieldsV3 } from './toDocumentFieldsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasInfo } from '../info/Info.ts'

Deno.test('toDocumentFieldsV3 - basic document fields', () => {
  const documentObject: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  }
  const documentFields = toDocumentFieldsV3({
    documentObject,
    context: mockParseContext
  })

  assertEquals(documentFields.openapi, '3.0.0')
  assertEquals(documentFields.info, new OasInfo({ title: 'Test API', version: '1.0.0' }))
  assertEquals(documentFields.operations, [])
})
