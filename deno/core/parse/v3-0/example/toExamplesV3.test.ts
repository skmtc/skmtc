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

Deno.test('toExamplesV3 - singular example is a literal value', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: 'test',
    examples: undefined,
    exampleKey: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    test: new OasExample({ value: 'test' })
  })
})

Deno.test('toExamplesV3 - singular example keeps an object value whole', () => {
  const stackTrail = new StackTrail(['TEST'])
  // The literal happens to have a `value` key. It is still the example itself,
  // not an Example Object to unwrap.
  const result = toExamplesV3({
    example: { id: 1, value: 'inner' },
    examples: undefined,
    exampleKey: 'application/json',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    'application/json': new OasExample({ value: { id: 1, value: 'inner' } })
  })
})

Deno.test('toExamplesV3 - singular example keeps falsy values', () => {
  const stackTrail = new StackTrail(['TEST'])

  for (const value of [false, 0, '', null]) {
    const result = toExamplesV3({
      example: value,
      examples: undefined,
      exampleKey: 'test',
      stackTrail,
      context: mockParseContext
    })

    assertEquals(result, { test: new OasExample({ value }) })
  }
})

Deno.test('toExamplesV3 - a named example keeps its externalValue', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: undefined,
    examples: {
      large: { summary: 'Too big to inline', externalValue: 'https://example.com/big.json' }
    },
    exampleKey: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    large: new OasExample({
      summary: 'Too big to inline',
      externalValue: 'https://example.com/big.json'
    })
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
