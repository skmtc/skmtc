import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerVariableV3 } from './toServerVariableV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasServerVariable } from './ServerVariable.ts'

Deno.test('toServerVariableV3 - basic server variable', () => {
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'v1'
  }
  const oasServerVariable = toServerVariableV3({
    serverVariable,
    context: mockParseContext
  })

  assertEquals(oasServerVariable, new OasServerVariable({ default: 'v1' }))
})
