import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toExternalDocs } from './toExternalDocs.ts'
import { assertEquals } from '@std/assert/equals'
import { OasExternalDocs } from '@/oas/externalDocs/ExternalDocs.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toExternalDocs - basic external docs', () => {
  const externalDocs: OpenAPIV3.ExternalDocumentationObject = {
    url: 'https://example.com/docs'
  }
  const stackTrail = new StackTrail(['TEST'])
  const oasExternalDocs = toExternalDocs({
    stackTrail,
    externalDocs,
    context: mockParseContext
  })

  assertEquals(oasExternalDocs, new OasExternalDocs({ url: 'https://example.com/docs' }))
})
