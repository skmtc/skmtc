import { mockParseContext } from '@/test/mockParseContext.ts'
import { toComponentsV3 } from './toComponentsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasComponents } from './Components.ts'

Deno.test('toComponentsV3 - undefined components', () => {
  const result = toComponentsV3({
    components: {},
    context: mockParseContext
  })

  assertEquals(result, new OasComponents())
})
