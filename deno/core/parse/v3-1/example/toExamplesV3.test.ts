import { mockParseContext } from '@/test/mockParseContext.ts'
import { toExamplesV3 } from './toExamplesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasExample } from '@/oas/example/Example.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toExamplesV3 - no examples', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: undefined,
    examples: undefined,
    exampleKey: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toExamplesV3 - basic example', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: { value: 'test' },
    examples: undefined,
    exampleKey: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    test: new OasExample({ value: 'test' })
  })
})

Deno.test('toExamplesV3 - examples collection', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: undefined,
    examples: { basic: { value: 'testings' } },
    exampleKey: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    basic: new OasExample({ value: 'testings' })
  })
})
