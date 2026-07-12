/**
 * Mirror of `ParseContext.errorHandling.test.ts` for the GQL surface.
 *
 * Same contract pinned for both protocols:
 *
 *   1. Parsers call `registerRef(consumerStackTrail, refKey)` at every
 *      cross-type reference (GQL: type name; OAS: `$ref` string).
 *   2. When a target fails to parse, `registerRefError(error, refKey)`
 *      records the failure. For GQL this happens inside
 *      `parseGqlDocument`'s try/catch around each named-type call; for
 *      OAS it happens automatically inside `logIssueNoKey` when the
 *      stack trail is at a component location.
 *   3. After parse finishes, `removeErroredItems` prunes consumers and
 *      emits an `INVALID_DEPENDENCY_REF` issue per removed entry. The
 *      original error rides along as `cause`.
 *
 * GQL pruning happens via `GqlDocument.removeItem`, which knows two
 * consumer shapes: field-of-object (`[ParentType, fieldName]`) and
 * root-field-operation (`[<RootType>, fieldName]`).
 */
import { assertEquals } from '@std/assert'
import type * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const makeGqlContext = (sdl: string) =>
  new ParseContext({
    input: { type: 'gql', value: sdl },
    logger: mockLogger,
    silent: true
  })

Deno.test('ParseContext (gql) - registerRefError with undefined refKey is a no-op', () => {
  const ctx = makeGqlContext(`
    type User { id: ID! }
    type Query { me: User }
  `)
  ctx.registerRefError(new Error('boom'), undefined)
  ctx.parse(new StackTrail([]))
  assertEquals(ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF').length, 0)
})

Deno.test('ParseContext (gql) - registerRef during field parse records consumer location', () => {
  // Two object types where one references the other. `toFieldSchema`
  // should record a consumer at `[User, posts]` against the type name
  // `Post`.
  const ctx = makeGqlContext(`
    type Post { id: ID! }
    type User {
      id: ID!
      posts: [Post!]!
    }
    type Query { me: User }
  `)
  ctx.parse(new StackTrail([]))

  // Sanity: nothing pruned yet (no error registered).
  assertEquals(ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF').length, 0)

  // Inject the error that a failing `Post` parse would have recorded
  // (in production this happens via the try/catch in
  // `parseGqlDocument`'s `tryParseType`). Then verify pruning works.
  ctx.registerRefError(new Error('Post is malformed'), 'Post')
  ctx.removeErroredItems()

  const depRefIssues = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRefIssues.length, 1, 'expected User.posts pruned')

  const issue = depRefIssues[0]
  if (issue.protocol !== 'gql' || issue.level !== 'error') {
    throw new Error('expected a gql error issue')
  }
  assertEquals(issue.location, 'User:posts')
  assertEquals(issue.message, 'Post is malformed')
  assertEquals(issue.cause instanceof Error, true)

  // And the User registry entry should no longer carry a `posts` field.
  const user = ctx.registry.schemas['User' as RefName]
  if (!(user instanceof OasObject)) throw new Error('expected User to be an OasObject')
  assertEquals('posts' in (user.properties ?? {}), false)
})

Deno.test('ParseContext (gql) - root-field references to errored type prune the operation', () => {
  const ctx = makeGqlContext(`
    type User { id: ID! }
    type Query {
      me: User
      ping: Boolean
    }
  `)
  const parsed = ctx.parse(new StackTrail([]))
  if (parsed.type !== 'gql') throw new Error('expected gql')

  assertEquals(parsed.value.operations.length, 2, 'me + ping')

  ctx.registerRefError(new Error('User schema malformed'), 'User')
  ctx.removeErroredItems()

  // `me`'s return type referenced User → operation pruned.
  // `ping`'s return type is Boolean → operation unaffected.
  const remaining = parsed.value.operations.map(o => o.fieldName).sort()
  assertEquals(remaining, ['ping'], 'me should have been pruned')

  const depRef = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRef.length, 1)
  assertEquals(depRef[0].location, 'Query:me:return')
})

Deno.test('ParseContext (gql) - multiple field-level consumers all get pruned', () => {
  const ctx = makeGqlContext(`
    type Post { id: ID! }
    type User {
      id: ID!
      latestPost: Post
      featuredPost: Post
    }
    type Admin {
      id: ID!
      pinnedPost: Post
    }
    type Query { _: Boolean }
  `)
  ctx.parse(new StackTrail([]))

  ctx.registerRefError(new Error('Post malformed'), 'Post')
  ctx.removeErroredItems()

  const depRef = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRef.length, 3, 'three Post-consuming fields pruned')

  const user = ctx.registry.schemas['User' as RefName]
  const admin = ctx.registry.schemas['Admin' as RefName]
  if (!(user instanceof OasObject) || !(admin instanceof OasObject)) {
    throw new Error('expected both to be OasObject')
  }
  assertEquals(Object.keys(user.properties ?? {}).sort(), ['id'])
  assertEquals(Object.keys(admin.properties ?? {}).sort(), ['id'])
})

Deno.test('ParseContext (gql) - tryParseType isolates a single bad type without aborting the run', () => {
  // We can't easily make a real type throw during parse without
  // patching, so simulate via the public API: register an error
  // against a name that's also a real registered type. Then confirm
  // the rest of the document survives.
  const ctx = makeGqlContext(`
    type Post { id: ID! }
    type User {
      id: ID!
      posts: [Post!]!
    }
    type Query {
      users: [User!]!
    }
  `)
  ctx.parse(new StackTrail([]))

  // Simulate Post failing in some downstream step.
  ctx.registerRefError(new Error('boom'), 'Post')
  ctx.removeErroredItems()

  // User still exists in registry; just without `posts`.
  const user = ctx.registry.schemas['User' as RefName]
  if (!(user instanceof OasObject)) throw new Error('expected User OasObject')
  assertEquals('id' in (user.properties ?? {}), true)
  assertEquals('posts' in (user.properties ?? {}), false)

  // The Query.users operation is still there — its return type
  // references User, not Post directly.
  assertEquals(
    ctx.issues
      .filter(i => i.type === 'INVALID_DEPENDENCY_REF')
      .map(i => i.location)
      .sort(),
    ['User:posts']
  )
})

Deno.test('ParseContext (gql) - union member references to errored type are pruned', () => {
  const ctx = makeGqlContext(`
    type Article { id: ID! }
    type Video { id: ID! }
    union Content = Article | Video
    type Query { _: Boolean }
  `)
  ctx.parse(new StackTrail([]))

  ctx.registerRefError(new Error('Video failed'), 'Video')
  ctx.removeErroredItems()

  const depRef = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRef.length, 1)
  // Union members are addressed as `[UnionName, members, <index>]`.
  assertEquals(depRef[0].location.startsWith('Content:members:'), true)
})
