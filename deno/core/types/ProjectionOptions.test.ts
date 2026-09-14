import { assertEquals } from '@std/assert'
import { readProjectionOptions } from './ProjectionOptions.ts'

Deno.test('readProjectionOptions - reads the slot, absent or present', () => {
  assertEquals(readProjectionOptions<undefined>(undefined), undefined)
  assertEquals(readProjectionOptions<undefined>({}), undefined)
  assertEquals(readProjectionOptions<{ suffix: string }>({ options: { suffix: 'Input' } }), {
    suffix: 'Input'
  })
})
