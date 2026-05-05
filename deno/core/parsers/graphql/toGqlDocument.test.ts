import { assertEquals, assertInstanceOf, assertExists } from '@std/assert'
import { OasObject } from '@/oas/object/Object.ts'
import { OasArray } from '@/oas/array/Array.ts'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasString } from '@/oas/string/String.ts'
import { OasInteger } from '@/oas/integer/Integer.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { toGqlDocument } from './toGqlDocument.ts'
import type { RefName } from '@/types/RefName.ts'

const refName = (s: string) => s as unknown as RefName

Deno.test('toGqlDocument - parses a single object type into the registry', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      name: String
    }

    type Query {
      _empty: Boolean
    }
  `
  const doc = toGqlDocument(sdl)

  assertExists(doc.registry.schemas[refName('User')])
  const user = doc.registry.schemas[refName('User')] as OasObject
  assertInstanceOf(user, OasObject)
  assertEquals(user.title, 'User')
  assertEquals(user.required, ['id'])
})

Deno.test('toGqlDocument - non-null fields go into required', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      name: String!
      bio: String
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const user = doc.registry.schemas[refName('User')] as OasObject
  assertEquals(user.required, ['id', 'name'])
})

Deno.test('toGqlDocument - list type maps to OasArray with correct nullability axes', () => {
  const sdl = /* GraphQL */ `
    type User {
      tags: [String!]!
      maybeTags: [String]
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const user = doc.registry.schemas[refName('User')] as OasObject

  const tags = user.properties!.tags as OasArray
  assertInstanceOf(tags, OasArray)
  assertEquals(tags.nullable, false)
  const tagItem = tags.items as OasString
  assertEquals(tagItem.nullable, false)

  const maybeTags = user.properties!.maybeTags as OasArray
  assertEquals(maybeTags.nullable, true)
  const maybeItem = maybeTags.items as OasString
  assertEquals(maybeItem.nullable, true)
})

Deno.test('toGqlDocument - cross-type reference becomes an OasRef', () => {
  const sdl = /* GraphQL */ `
    type Post {
      id: ID!
    }
    type User {
      posts: [Post!]!
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const user = doc.registry.schemas[refName('User')] as OasObject
  const posts = user.properties!.posts as OasArray
  const item = posts.items as OasRef<'schema'>
  assertInstanceOf(item, OasRef)
  assertEquals(item.toRefName(), refName('Post'))

  // The ref should resolve through the registry's mirror to the Post object.
  const resolved = item.resolveOnce() as OasObject
  assertInstanceOf(resolved, OasObject)
  assertEquals(resolved.title, 'Post')
})

Deno.test('toGqlDocument - input types register under their own name', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    input UserInput {
      name: String!
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  assertExists(doc.registry.schemas[refName('User')])
  assertExists(doc.registry.schemas[refName('UserInput')])
})

Deno.test('toGqlDocument - enum types register as OasString with values', () => {
  const sdl = /* GraphQL */ `
    enum Role { ADMIN USER }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const role = doc.registry.schemas[refName('Role')] as OasString
  assertInstanceOf(role, OasString)
  assertEquals(role.enums, ['ADMIN', 'USER'])
})

Deno.test('toGqlDocument - union types register with __typename discriminator', () => {
  const sdl = /* GraphQL */ `
    type User { id: ID! }
    type Admin { id: ID! }
    union Account = User | Admin
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const account = doc.registry.schemas[refName('Account')] as OasUnion
  assertInstanceOf(account, OasUnion)
  assertEquals(account.discriminator?.propertyName, '__typename')
  assertEquals(account.members.length, 2)
})

Deno.test('toGqlDocument - interface emits both base object and union of implementers', () => {
  const sdl = /* GraphQL */ `
    interface Node {
      id: ID!
    }
    type User implements Node {
      id: ID!
      name: String
    }
    type Post implements Node {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  // base interface as object
  const node = doc.registry.schemas[refName('Node')] as OasObject
  assertInstanceOf(node, OasObject)
  // union of implementers
  const nodeUnion = doc.registry.schemas[refName('NodeUnion')] as OasUnion
  assertInstanceOf(nodeUnion, OasUnion)
  assertEquals(nodeUnion.members.length, 2)
})

Deno.test('toGqlDocument - emitInterfaceUnions=false suppresses the union form', () => {
  const sdl = /* GraphQL */ `
    interface Node {
      id: ID!
    }
    type User implements Node {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl, { emitInterfaceUnions: false })
  assertExists(doc.registry.schemas[refName('Node')])
  assertEquals(doc.registry.has(refName('NodeUnion')), false)
})

Deno.test('toGqlDocument - root Query fields become operations', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
    }
    type Query {
      getUser(id: ID!): User
      listUsers(limit: Int): [User!]!
    }
  `
  const doc = toGqlDocument(sdl)

  assertEquals(doc.operations.length, 2)
  assertEquals(doc.operations[0].rootKind, 'query')
  assertEquals(doc.operations[0].fieldName, 'getUser')
  assertEquals(doc.operations[0].arguments.length, 1)
  assertEquals(doc.operations[0].arguments[0].name, 'id')
  assertEquals(doc.operations[0].arguments[0].required, true)

  assertEquals(doc.operations[1].fieldName, 'listUsers')
  assertEquals(doc.operations[1].arguments[0].required, false)
})

Deno.test('toGqlDocument - mutation and subscription root fields surface', () => {
  const sdl = /* GraphQL */ `
    type User { id: ID! }
    type Query { _: Boolean }
    type Mutation { createUser(name: String!): User }
    type Subscription { userCreated: User }
  `
  const doc = toGqlDocument(sdl)
  const kinds = doc.operations.map(o => o.rootKind).sort()
  assertEquals(kinds.includes('mutation'), true)
  assertEquals(kinds.includes('subscription'), true)
  assertEquals(doc.rootTypes.mutation, refName('Mutation'))
  assertEquals(doc.rootTypes.subscription, refName('Subscription'))
})

Deno.test('toGqlDocument - root type names are not registered as schemas', () => {
  const sdl = /* GraphQL */ `
    type Query {
      ping: Boolean
    }
  `
  const doc = toGqlDocument(sdl)
  // Query is referenced via rootTypes.query, not as a registry entry.
  assertEquals(doc.registry.has(refName('Query')), false)
  assertEquals(doc.rootTypes.query, refName('Query'))
})

Deno.test('toGqlDocument - Int field becomes OasInteger int32', () => {
  const sdl = /* GraphQL */ `
    type Counter { count: Int! }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const counter = doc.registry.schemas[refName('Counter')] as OasObject
  const count = counter.properties!.count as OasInteger
  assertInstanceOf(count, OasInteger)
  assertEquals(count.format, 'int32')
})

Deno.test('toGqlDocument - custom scalars register with their name as format', () => {
  const sdl = /* GraphQL */ `
    scalar DateTime
    type Event {
      at: DateTime!
    }
    type Query { _: Boolean }
  `
  const doc = toGqlDocument(sdl)
  const dt = doc.registry.schemas[refName('DateTime')] as OasString
  assertInstanceOf(dt, OasString)
  assertEquals(dt.format, 'DateTime')

  const event = doc.registry.schemas[refName('Event')] as OasObject
  const at = event.properties!.at as OasString
  assertEquals(at.format, 'DateTime')
})

Deno.test('toGqlDocument - argument default values are preserved', () => {
  const sdl = /* GraphQL */ `
    type User { id: ID! }
    type Query {
      listUsers(limit: Int = 10): [User!]!
    }
  `
  const doc = toGqlDocument(sdl)
  const op = doc.operations[0]
  assertEquals(op.arguments[0].defaultValue, 10)
})
