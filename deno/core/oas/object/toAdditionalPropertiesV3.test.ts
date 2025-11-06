import { mockParseContext } from '@/test/mockParseContext.ts'
import { toAdditionalPropertiesV3 } from './toAdditionalPropertiesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toAdditionalPropertiesV3 - basic boolean type', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toAdditionalPropertiesV3({
    additionalProperties: true,
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, true)
})
