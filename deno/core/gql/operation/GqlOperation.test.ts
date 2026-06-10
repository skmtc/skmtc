import { assertEquals } from '@std/assert'
import { GqlOperation } from './GqlOperation.ts'
import { GqlArgument } from '@/gql/argument/GqlArgument.ts'
import { OasString } from '@/oas/string/String.ts'

Deno.test('GqlOperation - identifier combines rootKind and fieldName', () => {
  const op = new GqlOperation({
    rootKind: 'query',
    fieldName: 'getUser',
    arguments: [],
    returnType: new OasString({})
  })

  assertEquals(op.identifier, 'query_getUser')
})

Deno.test('GqlOperation - identifier handles all root kinds', () => {
  const kinds = ['query', 'mutation', 'subscription'] as const

  for (const rootKind of kinds) {
    const op = new GqlOperation({
      rootKind,
      fieldName: 'doThing',
      arguments: [],
      returnType: new OasString({})
    })
    assertEquals(op.identifier, `${rootKind}_doThing`)
  }
})

Deno.test('GqlOperation - deprecated defaults to false', () => {
  const op = new GqlOperation({
    rootKind: 'query',
    fieldName: 'getUser',
    arguments: [],
    returnType: new OasString({})
  })

  assertEquals(op.deprecated, false)
})

Deno.test('GqlOperation - preserves arguments list', () => {
  const idArg = new GqlArgument({
    name: 'id',
    schema: new OasString({}),
    required: true
  })
  const limitArg = new GqlArgument({
    name: 'limit',
    schema: new OasString({}),
    required: false,
    defaultValue: 10
  })

  const op = new GqlOperation({
    rootKind: 'query',
    fieldName: 'listUsers',
    arguments: [idArg, limitArg],
    returnType: new OasString({})
  })

  assertEquals(op.arguments.length, 2)
  assertEquals(op.arguments[0].name, 'id')
  assertEquals(op.arguments[1].defaultValue, 10)
})
