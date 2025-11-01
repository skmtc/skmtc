import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toMediaTypeItemsV3 } from './toMediaTypeItemV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasMediaType } from './MediaType.ts'

Deno.test('toMediaTypeItemsV3 - basic media type', () => {
  const content: Record<string, OpenAPIV3.MediaTypeObject> = {
    'application/json': {}
  }
  const oasMediaTypes = toMediaTypeItemsV3({ content, context: mockParseContext })

  assertEquals(oasMediaTypes, {
    'application/json': new OasMediaType({ mediaType: 'application/json' })
  })
})
