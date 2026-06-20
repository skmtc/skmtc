import { assertEquals } from '@std/assert'
import type { OasResponse } from './Response.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toPrimaryResponseCode } from './toPrimaryResponseCode.ts'

// The resolver reads only the keys (and `default` truthiness), so the values
// are placeholders.
const codes = (...keys: string[]): Record<string, OasResponse | OasRef<'response'>> =>
  Object.fromEntries(keys.map(key => [key, {} as OasResponse]))

Deno.test('toPrimaryResponseCode - lowest specific 2xx wins', () => {
  assertEquals(toPrimaryResponseCode(codes('500', '201', '200')), '200')
})

Deno.test('toPrimaryResponseCode - a 2XX range key resolves when there is no specific 2xx', () => {
  assertEquals(toPrimaryResponseCode(codes('2XX')), '2XX')
  // Case-insensitive, and a non-2xx range is ignored.
  assertEquals(toPrimaryResponseCode(codes('4XX', '2xx')), '2xx')
})

Deno.test('toPrimaryResponseCode - a specific 2xx beats a 2XX range', () => {
  assertEquals(toPrimaryResponseCode(codes('2XX', '200')), '200')
})

Deno.test('toPrimaryResponseCode - falls back to default, else undefined', () => {
  assertEquals(toPrimaryResponseCode(codes('default')), 'default')
  assertEquals(toPrimaryResponseCode(codes('404', '500')), undefined)
  assertEquals(toPrimaryResponseCode(codes()), undefined)
})
