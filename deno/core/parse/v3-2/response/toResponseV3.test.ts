import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toResponseV3, toResponsesV3 } from './toResponseV3.ts'
import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert'
import { OasResponse } from '@/oas/response/Response.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import * as log from '@std/log'
Deno.test('toResponsesV3 - basic response', () => {
  const stackTrail = new StackTrail(['TEST'])
  const responses: OpenAPIV3.ResponsesObject = {
    '200': { description: 'Success' }
  }
  const oasResponses = toResponsesV3({ responses, stackTrail, context: mockParseContext })

  assertEquals(oasResponses, {
    '200': new OasResponse({ description: 'Success' })
  })
})

Deno.test('toResponseV3 - reads the 3.2 summary', () => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: { openapi: '3.2.0', info: { title: 'Test', version: '1.0.0' }, paths: {} }
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const response = toResponseV3({
    response: { summary: 'A page of pets', description: 'ok' },
    stackTrail: new StackTrail(['TEST']),
    context
  })

  assert(!response.isRef())
  assertEquals(response.summary, 'A page of pets')
  assertEquals(response.description, 'ok')
  assertEquals(context.issues, [])
})
