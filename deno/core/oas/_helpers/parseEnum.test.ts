import { mockParseContext } from '@/test/mockParseContext.ts'
import { parseEnum } from './parseEnum.ts'
import { assertEquals } from '@std/assert/equals'

Deno.test('parseEnum - undefined when not array', () => {
  const result = parseEnum({
    value: 'not-an-array',
    nullable: false,
    parent: {},
    check: (item) => typeof item === 'string',
    toMessage: (item) => `Invalid: ${item}`,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})
