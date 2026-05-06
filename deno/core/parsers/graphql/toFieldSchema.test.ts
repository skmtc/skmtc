import { assertEquals, assertInstanceOf } from '@std/assert'
import { OasObject } from '@/oas/object/Object.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { toGqlDocument } from './toGqlDocument.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'

const refName = (s: string) => s as unknown as RefName

Deno.test('toFieldSchema - nullable ref return wraps in nullable OasUnion', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      getUser(id: ID!): User
    }
  `
  const doc = toGqlDocument(sdl)
  const op = doc.operations.find(
    (o: GqlOperation) => o.fieldName === 'getUser'
  )!
  // Without the wrap fix this is a bare OasRef and the generator emits
  // `User` instead of the correct `User | null`.
  const ret = op.returnType as OasUnion
  assertInstanceOf(ret, OasUnion)
  assertEquals(ret.nullable, true)
  assertEquals(ret.members.length, 1)
  const inner = ret.members[0] as OasRef<'schema'>
  assertInstanceOf(inner, OasRef)
  assertEquals(inner.toRefName(), refName('User'))
})

Deno.test('toFieldSchema - non-null ref return stays a bare OasRef', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      getUser(id: ID!): User!
    }
  `
  const doc = toGqlDocument(sdl)
  const op = doc.operations.find(
    (o: GqlOperation) => o.fieldName === 'getUser'
  )!
  const ret = op.returnType as OasRef<'schema'>
  assertInstanceOf(ret, OasRef)
  assertEquals(ret.toRefName(), refName('User'))
})

Deno.test('toFieldSchema - nullable ref field on an object wraps the same way', () => {
  const sdl = /* GraphQL */ `
    type Profile {
      id: ID!
    }
    type User {
      id: ID!
      profile: Profile
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const user = doc.registry.schemas[refName('User')] as OasObject
  const profile = user.properties!.profile as OasUnion
  assertInstanceOf(profile, OasUnion)
  assertEquals(profile.nullable, true)
  const inner = profile.members[0] as OasRef<'schema'>
  assertInstanceOf(inner, OasRef)
  assertEquals(inner.toRefName(), refName('Profile'))
})

Deno.test('toFieldSchema - list of nullable refs ([User]!) wraps the inner only', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      maybeUsers: [User]!
    }
  `
  const doc = toGqlDocument(sdl)
  const op = doc.operations.find(
    (o: GqlOperation) => o.fieldName === 'maybeUsers'
  )!
  const arr = op.returnType as OasArray
  assertInstanceOf(arr, OasArray)
  assertEquals(arr.nullable, false)
  const item = arr.items as OasUnion
  assertInstanceOf(item, OasUnion)
  assertEquals(item.nullable, true)
  const ref = item.members[0] as OasRef<'schema'>
  assertInstanceOf(ref, OasRef)
  assertEquals(ref.toRefName(), refName('User'))
})

Deno.test('toFieldSchema - list of non-null refs ([User!]) leaves items as bare refs', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      users: [User!]
    }
  `
  const doc = toGqlDocument(sdl)
  const op = doc.operations.find(
    (o: GqlOperation) => o.fieldName === 'users'
  )!
  const arr = op.returnType as OasArray
  assertInstanceOf(arr, OasArray)
  assertEquals(arr.nullable, true)
  const item = arr.items as OasRef<'schema'>
  assertInstanceOf(item, OasRef)
  assertEquals(item.toRefName(), refName('User'))
})
