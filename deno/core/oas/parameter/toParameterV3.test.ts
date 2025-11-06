import { mockParseContext } from '@/test/mockParseContext.ts'
import { toParameterListV3 } from './toParameterV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasParameter } from './Parameter.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toParameterListV3 - undefined parameters', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toParameterListV3({
    stackTrail,
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
