import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import type { RefName } from '@/types/RefName.ts'

const fixture: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['id']
      }
    }
  }
}

const buildContext = (): ParseContext =>
  new ParseContext({
    input: { type: 'oas', value: fixture },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

Deno.test('attribution - parsed schemas carry JSON-Pointer locations', () => {
  const ctx = buildContext()
  const parsed = ctx.parse(new StackTrail([]))

  if (parsed.type !== 'oas') throw new Error('expected OAS parsed document')
  const doc = parsed.value

  const user = doc.components?.schemas?.['User' as RefName]
  if (!user || user.isRef()) throw new Error('expected concrete User schema')
  if (!(user instanceof OasObject)) throw new Error('expected OasObject')
  assertEquals(user.toLocation(), '#/components/schemas/User')

  const idProp = user.properties?.id
  if (!idProp || !(idProp instanceof OasString)) {
    throw new Error('expected concrete OasString id property')
  }
  assertEquals(idProp.toLocation(), '#/components/schemas/User/properties/id')

  const ageProp = user.properties?.age
  if (!ageProp || !(ageProp instanceof OasInteger)) {
    throw new Error('expected concrete OasInteger age property')
  }
  assertEquals(ageProp.toLocation(), '#/components/schemas/User/properties/age')

  const op = doc.operations[0]
  assertEquals(op?.toLocation(), '#/paths/~1users~1{id}/get')

  const param = op?.parameters?.[0]
  if (!param || param.isRef()) throw new Error('expected concrete parameter')
  assertEquals(param.toLocation(), '#/paths/~1users~1{id}/get/parameters/0')

  const response = op?.responses['200']
  if (!response || response.isRef()) throw new Error('expected concrete response')
  assertEquals(response.toLocation(), '#/paths/~1users~1{id}/get/responses/200')

  const mediaType = response.content?.['application/json']
  if (!mediaType) throw new Error('expected application/json media type')
  assertEquals(
    mediaType.toLocation(),
    '#/paths/~1users~1{id}/get/responses/200/content/application~1json'
  )
})
