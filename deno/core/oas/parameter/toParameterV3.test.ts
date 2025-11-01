import { mockParseContext } from '@/test/mockParseContext.ts'
import { toParameterListV3 } from './toParameterV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasParameter } from './Parameter.ts'

Deno.test('toParameterListV3 - undefined parameters', () => {
  const result = toParameterListV3({
    parameters: [{ name: 'test', in: 'path' }],
    context: mockParseContext
  })

  assertEquals(result, [
    new OasParameter({
      name: 'test',
      location: 'path',
      required: true,
      style: 'simple',
      explode: false
    })
  ])
})
