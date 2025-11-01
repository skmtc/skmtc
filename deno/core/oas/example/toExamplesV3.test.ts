import { mockParseContext } from '@/test/mockParseContext.ts'
import { toExamplesV3 } from './toExamplesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasExample } from './Example.ts'

Deno.test('toExamplesV3 - no examples', () => {
  const result = toExamplesV3({
    example: undefined,
    examples: undefined,
    exampleKey: 'test',
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toExamplesV3 - basic example', () => {
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

Deno.test('toExamplesV3 - examples collection', () => {
  const result = toExamplesV3({
    example: undefined,
    examples: { basic: { value: 'testings' } },
    exampleKey: 'test',
    context: mockParseContext
  })

  assertEquals(result, {
    basic: new OasExample({ value: 'testings' })
  })
})
