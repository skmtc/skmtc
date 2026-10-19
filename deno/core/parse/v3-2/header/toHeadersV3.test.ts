import { mockParseContext } from '@/test/mockParseContext.ts'
import { toHeadersV3 } from './toHeadersV3.ts'
import { assertEquals } from '@std/assert/equals'
import { assert } from '@std/assert'
import { OasHeader } from '@/oas/header/Header.ts'
import { OasExample } from '@/oas/example/Example.ts'
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

Deno.test('toHeadersV3 - threads the singular example through, keyed by header name', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toHeadersV3({
    stackTrail,
    headers: { 'X-Total-Count': { schema: { type: 'integer' }, example: 42 } },
    context: mockParseContext
  })

  const header = result?.['X-Total-Count']
  assert(header instanceof OasHeader)
  assertEquals(header.examples, { 'X-Total-Count': new OasExample({ value: 42 }) })
})
