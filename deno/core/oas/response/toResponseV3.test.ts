import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toResponsesV3 } from './toResponseV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasResponse } from './Response.ts'

Deno.test('toResponsesV3 - basic response', () => {
  const responses: OpenAPIV3.ResponsesObject = {
    '200': { description: 'Success' }
  }
  const oasResponses = toResponsesV3({ responses, context: mockParseContext })

  assertEquals(oasResponses, {
    '200': new OasResponse({ description: 'Success' })
  })
})
