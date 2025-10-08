import { assertEquals } from '@std/assert/equals'
import { formatNumber } from './formatNumber.ts'

Deno.test('formatNumber - formats small numbers', () => {
  assertEquals(formatNumber(42), '42')
})

Deno.test('formatNumber - formats zero', () => {
  assertEquals(formatNumber(0), '0')
})

Deno.test('formatNumber - formats thousands with comma', () => {
  assertEquals(formatNumber(1234), '1,234')
})

Deno.test('formatNumber - formats millions with commas', () => {
  assertEquals(formatNumber(1234567), '1,234,567')
})

Deno.test('formatNumber - formats large numbers', () => {
  assertEquals(formatNumber(1234567890), '1,234,567,890')
})

Deno.test('formatNumber - rounds decimal numbers', () => {
  assertEquals(formatNumber(1234.56), '1,235')
})

Deno.test('formatNumber - rounds down when needed', () => {
  assertEquals(formatNumber(1234.4), '1,234')
})

Deno.test('formatNumber - rounds up at .5', () => {
  assertEquals(formatNumber(999.5), '1,000')
})

Deno.test('formatNumber - handles negative numbers', () => {
  assertEquals(formatNumber(-1234), '-1,234')
})

Deno.test('formatNumber - formats with German locale', () => {
  assertEquals(formatNumber(1234567, 'de-DE'), '1.234.567')
})

Deno.test('formatNumber - formats with French locale', () => {
  const result = formatNumber(1234567, 'fr-FR')
  // French uses non-breaking space (U+202F) as separator
  assertEquals(result.replace(/\s/g, ' '), '1 234 567')
})
