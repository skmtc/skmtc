import { mockParseContext } from '@/test/mockParseContext.ts'
import { toExamplesV3 } from './toExamplesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasExample } from './Example.ts'

Deno.test('toExamplesV3 - no examples', () => {
  const result = toExamplesV3({
    example: { value: 'test' },
    examples: undefined,
    exampleKey: 'test',
    context: mockParseContext
  })

  assertEquals(result, {
    test: new OasExample({ value: 'test' })
  })
})
