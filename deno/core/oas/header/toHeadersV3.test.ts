import { mockParseContext } from '@/test/mockParseContext.ts'
import { toHeadersV3 } from './toHeadersV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasHeader } from './Header.ts'
import { OasString } from '../string/String.ts'

Deno.test('toHeadersV3 - undefined headers', () => {
  const result = toHeadersV3({
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
