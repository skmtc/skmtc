import { mockParseContext } from '@/test/mockParseContext.ts'
import { toLinksV3 } from './toLinksV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasLink } from '@/oas/link/Link.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toLinksV3 - undefined links', () => {
  const result = toLinksV3({
    stackTrail: new StackTrail(['TEST']),
    links: undefined,
    context: mockParseContext
  })

  assertEquals(result, undefined)
})

Deno.test('toLinksV3 - inline link', () => {
  const result = toLinksV3({
    stackTrail: new StackTrail(['TEST']),
    links: {
      GetUserByUserId: {
        operationId: 'getUser',
        parameters: { userId: '$response.body#/id' },
        description: 'The created user'
      }
    },
    context: mockParseContext
  })

  assertEquals(result, {
    GetUserByUserId: new OasLink({
      operationId: 'getUser',
      parameters: { userId: '$response.body#/id' },
      description: 'The created user'
    })
  })
})
