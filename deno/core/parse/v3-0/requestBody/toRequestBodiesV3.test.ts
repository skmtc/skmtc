import { mockParseContext } from '@/test/mockParseContext.ts'
import { toRequestBodyV3 } from './toRequestBodiesV3.ts'
import { assertEquals } from '@std/assert/equals'
import { OasRequestBody } from '@/oas/requestBody/RequestBody.ts'
import { OasMediaType } from '@/oas/mediaType/MediaType.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { StackTrail } from '@/context/StackTrail.ts'
Deno.test('toRequestBodyV3 - undefined request body', () => {
  const stackTrail = new StackTrail(['TEST'])
  const result = toRequestBodyV3({
    stackTrail,
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
