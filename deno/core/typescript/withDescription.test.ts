import { assertEquals } from '@std/assert'
import { withDescription } from './withDescription.ts'

Deno.test('withDescription - adds JSDoc comment', () => {
  const result = withDescription('const x = 1', { description: 'A constant' })
  assertEquals(result, '/** A constant */\nconst x = 1')
})

Deno.test('withDescription - returns value without comment when no description', () => {
  const result = withDescription('const x = 1', { description: undefined })
  assertEquals(result, 'const x = 1')
})

Deno.test('withDescription - handles empty description', () => {
  const result = withDescription('const x = 1', {})
  assertEquals(result, 'const x = 1')
})

Deno.test('withDescription - handles multiline code', () => {
  const code = 'function test() {\n  return true\n}'
  const result = withDescription(code, { description: 'A test function' })
  assertEquals(result, '/** A test function */\nfunction test() {\n  return true\n}')
})

Deno.test('withDescription - preserves special characters in description', () => {
  const result = withDescription('const x = 1', { description: 'Value with <special> & chars' })
  assertEquals(result, '/** Value with <special> & chars */\nconst x = 1')
})
