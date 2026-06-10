import { assertEquals } from '@std/assert'
import { GraphQLEnumType } from 'graphql'
import { toEnumType } from '@/gql/enum/toEnumType.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { mockParseContext } from '@/test/mockParseContext.ts'

const context = mockParseContext
const stackTrail = new StackTrail([])

Deno.test('toEnumType - extracts values into enums array', () => {
  const role = new GraphQLEnumType({
    name: 'Role',
    description: 'A user role',
    values: { ADMIN: {}, USER: {}, GUEST: {} }
  })

  const out = toEnumType({ enumType: role, nullable: false, context, stackTrail })
  assertEquals(out.title, 'Role')
  assertEquals(out.description, 'A user role')
  assertEquals(out.enums, ['ADMIN', 'USER', 'GUEST'])
  assertEquals(out.nullable, false)
})

Deno.test('toEnumType - nullable propagates', () => {
  const e = new GraphQLEnumType({ name: 'X', values: { A: {} } })
  const out = toEnumType({ enumType: e, nullable: true, context, stackTrail })
  assertEquals(out.nullable, true)
})
