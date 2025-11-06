import { mockParseContext } from '@/test/mockParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toServerVariableV3 } from './toServerVariableV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasServerVariable } from './ServerVariable.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toServerVariableV3 - basic server variable', () => {
  const stackTrail = new StackTrail(['TEST'])
  const serverVariable: OpenAPIV3.ServerVariableObject = {
    default: 'v1'
  }
  const oasServerVariable = toServerVariableV3({
    serverVariable,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(oasServerVariable, new OasServerVariable({ default: 'v1' }))
})
