import { assertEquals, assertThrows } from '@std/assert'
import { toOasDialect } from './toOasDialect.ts'

Deno.test('toOasDialect - 3.0.x maps to the 3.0 dialect', () => {
  assertEquals(toOasDialect('3.0.0'), '3.0')
  assertEquals(toOasDialect('3.0.3'), '3.0')
})

Deno.test('toOasDialect - 3.1.x maps to the 3.1 dialect', () => {
  assertEquals(toOasDialect('3.1.0'), '3.1')
  assertEquals(toOasDialect('3.1.1'), '3.1')
})

Deno.test('toOasDialect - an unknown version throws (never a silent default)', () => {
  // The whole point of explicit detection: anything that is not 3.0.x /
  // 3.1.x must fail loud rather than route to a default dialect.
  assertThrows(() => toOasDialect('3.2.0'), Error, 'Unsupported OpenAPI version: 3.2.0')
  assertThrows(() => toOasDialect('4.0.0'), Error, 'Unsupported OpenAPI version: 4.0.0')
  assertThrows(() => toOasDialect('2.0'), Error, 'Unsupported OpenAPI version: 2.0')
})

Deno.test('toOasDialect - a missing version throws', () => {
  assertThrows(() => toOasDialect(undefined), Error, 'Unsupported OpenAPI version: (missing)')
  assertThrows(() => toOasDialect(''), Error, 'Unsupported OpenAPI version')
})
