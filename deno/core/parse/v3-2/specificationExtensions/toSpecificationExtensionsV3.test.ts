import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSpecificationExtensionsV3 } from './toSpecificationExtensionsV3.ts'
import { assertEquals } from '@std/assert/equals'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toSpecificationExtensionsV3 - empty object returns undefined', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toSpecificationExtensionsV3({
    skipped: {
      'x-test': 'test'
    },
    parent: {},
    parentType: 'test',
    stackTrail,
    context: mockParseContext
  })

  assertEquals(result, {
    'x-test': 'test'
  })
})
