import { assertEquals } from '@std/assert'
import { toCountPhrase } from '@/helpers/toCountPhrase.ts'

Deno.test('toCountPhrase - one takes the singular, other counts the plural', () => {
  assertEquals(toCountPhrase(1, 'file'), '1 file')
  assertEquals(toCountPhrase(0, 'file'), '0 files')
  assertEquals(toCountPhrase(2, 'file'), '2 files')
})

Deno.test('toCountPhrase - an explicit plural is used as given', () => {
  assertEquals(toCountPhrase(3, 'debug', 'debug'), '3 debug')
})
