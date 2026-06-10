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

Deno.test('withDescription - single line code', () => {
  const result = withDescription('export function test() {}', { description: 'A simple function' })
  assertEquals(result, '/** A simple function */\nexport function test() {}')
})

Deno.test('withDescription - description with asterisks', () => {
  const result = withDescription('const x = 1', { description: 'This * has * asterisks' })
  assertEquals(result, '/** This * has * asterisks */\nconst x = 1')
})

Deno.test('withDescription - long description', () => {
  const desc = 'This is a very long description that explains many things'
  const result = withDescription('const x = 1', { description: desc })
  assertEquals(result.includes(desc), true)
})

Deno.test('withDescription - empty string description', () => {
  const result = withDescription('const x = 1', { description: '' })
  assertEquals(result, 'const x = 1')
})
