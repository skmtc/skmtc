import { mockParseContext } from '@/test/mockParseContext.ts'
import { toRequestBodyV3 } from './toRequestBodiesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasRequestBody } from './RequestBody.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'
import { OasObject } from '../object/Object.ts'

Deno.test('toRequestBodyV3 - undefined request body', () => {
  const result = toRequestBodyV3({
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object'
          }
        }
      }
    },
    context: mockParseContext
  })

  assertEquals(
    result,
    new OasRequestBody({
      content: {
        'application/json': new OasMediaType({
          mediaType: 'application/json',
          schema: new OasObject()
        })
      }
    })
  )
})
