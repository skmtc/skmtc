import { assertEquals } from '@std/assert'
import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  type GraphQLType
} from 'graphql'
import { unwrapType } from '@/gql/_helpers/unwrapType.ts'

Deno.test('unwrapType - bare nullable scalar', () => {
  const t: GraphQLType = GraphQLString
  const u = unwrapType(t)
  assertEquals(u.named.name, 'String')
  assertEquals(u.isList, false)
  assertEquals(u.outerNullable, true)
  assertEquals(u.itemNullable, true) // unused when !isList
  assertEquals(u.nestedList, false)
})

Deno.test('unwrapType - non-null scalar (T!)', () => {
  const t = new GraphQLNonNull(GraphQLString)
  const u = unwrapType(t)
  assertEquals(u.named.name, 'String')
  assertEquals(u.isList, false)
  assertEquals(u.outerNullable, false)
})

Deno.test('unwrapType - nullable list of nullables ([T])', () => {
  const t = new GraphQLList(GraphQLString)
  const u = unwrapType(t)
  assertEquals(u.isList, true)
  assertEquals(u.outerNullable, true)
  assertEquals(u.itemNullable, true)
})

Deno.test('unwrapType - nullable list of non-nulls ([T!])', () => {
  const t = new GraphQLList(new GraphQLNonNull(GraphQLString))
  const u = unwrapType(t)
  assertEquals(u.isList, true)
  assertEquals(u.outerNullable, true)
  assertEquals(u.itemNullable, false)
})

Deno.test('unwrapType - non-null list of nullables ([T]!)', () => {
  const t = new GraphQLNonNull(new GraphQLList(GraphQLString))
  const u = unwrapType(t)
  assertEquals(u.isList, true)
  assertEquals(u.outerNullable, false)
  assertEquals(u.itemNullable, true)
})

Deno.test('unwrapType - non-null list of non-nulls ([T!]!)', () => {
  const t = new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))
  const u = unwrapType(t)
  assertEquals(u.isList, true)
  assertEquals(u.outerNullable, false)
  assertEquals(u.itemNullable, false)
})

Deno.test('unwrapType - nested list ([[T!]!]!) flagged as nestedList', () => {
  const t = new GraphQLNonNull(
    new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))))
  )
  const u = unwrapType(t)
  assertEquals(u.nestedList, true)
  assertEquals(u.named.name, 'String')
})
