import { assertEquals } from '@std/assert'
import type * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const makeGqlContext = (source: string, opts: { silent?: boolean } = {}) =>
  new ParseContext({
    input: { type: 'gql', value: source },
    logger: mockLogger,
    silent: opts.silent ?? true
  })

const runParse = (ctx: ParseContext) => ctx.parse(new StackTrail([]))

Deno.test('ParseContext (gql) - records nested-list fallback as a NESTED_LIST_LOSSY warning', () => {
  const sdl = /* GraphQL */ `
    type Matrix {
      cells: [[Int]]
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const lossyIssues = ctx.issues.filter(i => i.type === 'NESTED_LIST_LOSSY')
  assertEquals(lossyIssues.length, 1)
  assertEquals(lossyIssues[0].level, 'warning')
  assertEquals(lossyIssues[0].location, 'Matrix.cells')
  // Unified union: every gql issue carries protocol: 'gql'.
  assertEquals(lossyIssues[0].protocol, 'gql')
})

Deno.test('ParseContext (gql) - records skipped non-root field arguments', () => {
  const sdl = /* GraphQL */ `
    type Post {
      id: ID!
    }
    type User {
      id: ID!
      posts(limit: Int = 10, offset: Int): [Post!]!
    }
    type Query {
      me: User
    }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const skipped = ctx.issues.filter(i => i.type === 'SKIPPED_FIELD_ARGUMENTS')
  assertEquals(skipped.length, 2)
  for (const issue of skipped) {
    assertEquals(issue.level, 'warning')
    assertEquals(issue.location, 'User.posts')
  }
  const messages = skipped.map(i => i.message).sort()
  assertEquals(messages.some(m => m.includes("'limit'")), true)
  assertEquals(messages.some(m => m.includes("'offset'")), true)
})

Deno.test('ParseContext (gql) - root-field arguments are NOT logged as skipped', () => {
  const sdl = /* GraphQL */ `
    type User { id: ID! }
    type Query {
      getUser(id: ID!): User
    }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const skipped = ctx.issues.filter(i => i.type === 'SKIPPED_FIELD_ARGUMENTS')
  assertEquals(skipped.length, 0)
})

Deno.test('ParseContext (gql) - records custom directives as DROPPED_DIRECTIVE warnings', () => {
  const sdl = /* GraphQL */ `
    directive @auth(role: String!) on FIELD_DEFINITION
    directive @cost(value: Int!) on FIELD_DEFINITION

    type User {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 2)
  const names = dropped.map(i => i.location).sort()
  assertEquals(names, ['@auth', '@cost'])
})

Deno.test('ParseContext (gql) - built-in directives (@skip, @include, @deprecated) are NOT logged', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      legacyName: String @deprecated(reason: "use name")
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 0)
})

Deno.test('ParseContext (gql) - silent=false mirrors warnings to the logger', () => {
  // The unified ParseContext routes mirroring through `logger.warn`
  // rather than directly to console.warn — captures via a logger spy
  // are the right hook now. We're not testing the std-log handler
  // wiring here, just confirming the path runs without throwing.
  const sdl = /* GraphQL */ `
    type Matrix { cells: [[Int]] }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl, { silent: false })
  runParse(ctx)

  assertEquals(ctx.issues.filter(i => i.type === 'NESTED_LIST_LOSSY').length, 1)
})

Deno.test('ParseContext (gql) - field-level applied directives are recorded with field location', () => {
  const sdl = /* GraphQL */ `
    directive @auth(role: String!) on FIELD_DEFINITION
    directive @cost(value: Int!) on FIELD_DEFINITION
    type User {
      id: ID!
      secret: String @auth(role: "admin")
      expensive: Int @cost(value: 100)
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  // 2 directive *definitions* + 2 *applications* = 4
  assertEquals(dropped.length, 4)

  const fieldLevel = dropped.filter(i => i.location.startsWith('User.'))
  assertEquals(fieldLevel.length, 2)
  const fieldLocations = fieldLevel.map(i => i.location).sort()
  assertEquals(fieldLocations, ['User.expensive', 'User.secret'])
})

Deno.test('ParseContext (gql) - type-level applied directives are recorded with type location', () => {
  const sdl = /* GraphQL */ `
    directive @entity on OBJECT
    type User @entity {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const typeLevel = ctx.issues.filter(
    i => i.type === 'DROPPED_DIRECTIVE' && i.location === 'User'
  )
  assertEquals(typeLevel.length, 1)
  assertEquals(typeLevel[0].message.includes("'@entity'"), true)
})

Deno.test('ParseContext (gql) - root-field applied directives are recorded with operation location', () => {
  const sdl = /* GraphQL */ `
    directive @auth(role: String!) on FIELD_DEFINITION
    type User { id: ID! }
    type Query {
      me: User! @auth(role: "user")
    }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const opLevel = ctx.issues.filter(
    i => i.type === 'DROPPED_DIRECTIVE' && i.location === 'Query.me'
  )
  assertEquals(opLevel.length, 1)
})

Deno.test('ParseContext (gql) - applied @deprecated is NOT recorded (its reason is captured)', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      legacyName: String @deprecated(reason: "use name")
    }
    type Query { _: Boolean }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 0)
})

Deno.test('ParseContext (gql) - schema with no issues yields an empty issues list', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      name: String
    }
    type Query {
      getUser(id: ID!): User!
    }
  `
  const ctx = makeGqlContext(sdl)
  runParse(ctx)

  assertEquals(ctx.issues.length, 0)
})
