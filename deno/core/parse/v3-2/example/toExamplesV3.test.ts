import { mockParseContext } from '@/test/mockParseContext.ts'
import { toExamplesV3 } from './toExamplesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasExample } from '@/oas/example/Example.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import * as log from '@std/log'
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

Deno.test('toExamplesV3 - examples wins when a document declares both', () => {
  const stackTrail = new StackTrail(['TEST'])
  // Malformed input — the spec makes the two mutually exclusive. Keep the
  // richer field: a falsy singular must not discard the whole named map.
  const result = toExamplesV3({
    example: null,
    examples: {
      empty: { summary: 'No body', value: null },
      full: { summary: 'Populated', value: { id: 1 } }
    },
    exampleKey: 'application/json',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    empty: new OasExample({ summary: 'No body', value: null }),
    full: new OasExample({ summary: 'Populated', value: { id: 1 } })
  })
})

Deno.test('toExamplesV3 - an empty examples map does not discard the singular', () => {
  const stackTrail = new StackTrail(['TEST'])
  // `examples` is declared but carries nothing, so preferring it would drop the
  // one example the document does have and put nothing in its place.
  const result = toExamplesV3({
    example: { id: 1 },
    examples: {},
    exampleKey: 'application/json',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    'application/json': new OasExample({ value: { id: 1 } })
  })
})

Deno.test('toExamplesV3 - the warning names the field that was used', () => {
  const context = new ParseContext({
    input: {
      type: 'oas',
      value: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} }
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  toExamplesV3({
    example: { id: 1 },
    examples: { full: { value: { id: 2 } } },
    exampleKey: 'application/json',
    stackTrail: new StackTrail(['TEST']),
    context
  })

  toExamplesV3({
    example: { id: 1 },
    examples: {},
    exampleKey: 'application/json',
    stackTrail: new StackTrail(['TEST']),
    context
  })

  assertEquals(
    context.issues
      .filter(issue => issue.type === 'EXAMPLE_AND_EXAMPLES_DEFINED')
      .map(issue => issue.message),
    [
      'Both example and examples are defined for application/json; using examples',
      'Both example and examples are defined for application/json; using example'
    ]
  )
})

Deno.test('toExamplesV3 - an empty examples map alone yields no examples', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toExamplesV3({
    example: undefined,
    examples: {},
    exampleKey: 'application/json',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, undefined)
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
