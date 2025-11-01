import { mockParseContext } from '@/test/mockParseContext.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { assertEquals } from '@std/assert/equals'

Deno.test('toAdditionalPropertiesV3 - basic boolean type', () => {
  const result = toAdditionalPropertiesV3({
    additionalProperties: true,
    context: mockParseContext
  })

  assertEquals(result, true)
})
