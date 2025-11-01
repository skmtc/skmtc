import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSpecificationExtensionsV3 } from './toSpecificationExtensionsV3.ts'
import { assertEquals } from '@std/assert/equals'

Deno.test('toSpecificationExtensionsV3 - empty object returns undefined', () => {
  const result = toSpecificationExtensionsV3({
    skipped: {
      'x-test': 'test'
    },
    parent: {},
    parentType: 'test',
    context: mockParseContext
  })

  assertEquals(result, {
    'x-test': 'test'
  })
})
