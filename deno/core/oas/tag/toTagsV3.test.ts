import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toTagsV3 } from './toTagsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasTag } from './Tag.ts'

Deno.test('toTagsV3 - basic tags', () => {
  const tags: OpenAPIV3.TagObject[] = [{ name: 'users' }]
  const oasTags = toTagsV3({ tags, context: mockParseContext })

  assertEquals(oasTags, [new OasTag({ name: 'users', description: undefined })])
})
