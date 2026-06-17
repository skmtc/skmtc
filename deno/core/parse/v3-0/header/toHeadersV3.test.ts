import { mockParseContext } from '@/test/mockParseContext.ts'
import { toHeadersV3 } from './toHeadersV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasHeader } from '@/oas/header/Header.ts'
import { OasString } from '@/oas/string/String.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toHeadersV3 - undefined headers', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toHeadersV3({
    stackTrail,
    headers: {
      'x-test': {
        schema: {
          type: 'string'
        }
      }
    },
    context: mockParseContext
  })

  assertEquals(result, {
    'x-test': new OasHeader({
      schema: new OasString()
    })
  })
})
