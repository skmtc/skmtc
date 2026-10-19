import { assertEquals } from '@std/assert'
import { methodValues, methodValuesNoTrace } from '@/types/Method.ts'

Deno.test('methodValuesNoTrace - is methodValues without trace', () => {
  assertEquals(
    methodValuesNoTrace,
    methodValues.filter(method => method !== 'trace')
  )
})
