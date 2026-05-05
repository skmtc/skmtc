import { assertEquals } from '@std/assert'
import { GraphQLEnumType } from 'graphql'
import { toEnumType } from './toEnumType.ts'

Deno.test('toEnumType - extracts values into enums array', () => {
  const role = new GraphQLEnumType({
    name: 'Role',
    description: 'A user role',
    values: { ADMIN: {}, USER: {}, GUEST: {} }
  })

  const out = toEnumType(role, false)
  assertEquals(out.title, 'Role')
  assertEquals(out.description, 'A user role')
  assertEquals(out.enums, ['ADMIN', 'USER', 'GUEST'])
  assertEquals(out.nullable, false)
})

Deno.test('toEnumType - nullable propagates', () => {
  const e = new GraphQLEnumType({ name: 'X', values: { A: {} } })
  const out = toEnumType(e, true)
  assertEquals(out.nullable, true)
})
