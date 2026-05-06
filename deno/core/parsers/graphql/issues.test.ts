import { assertEquals } from '@std/assert'
import { GqlParseContext } from '@/context/GqlParseContext.ts'

Deno.test('GqlParseContext - records nested-list fallback as a NESTED_LIST_LOSSY warning', () => {
  // `[[Int]]` falls back to OasUnknown — the user should see a warning
  // pointing at the offending field.
  const sdl = /* GraphQL */ `
    type Matrix {
      cells: [[Int]]
    }
    type Query { _: Boolean }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const lossyIssues = ctx.issues.filter(i => i.type === 'NESTED_LIST_LOSSY')
  assertEquals(lossyIssues.length, 1)
  assertEquals(lossyIssues[0].level, 'warning')
  assertEquals(lossyIssues[0].location, 'Matrix.cells')
})

Deno.test('GqlParseContext - records skipped non-root field arguments', () => {
  // GraphQL allows args on any object field; we only model them for root
  // fields. The args on `User.posts` would otherwise vanish silently.
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
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const skipped = ctx.issues.filter(i => i.type === 'SKIPPED_FIELD_ARGUMENTS')
  assertEquals(skipped.length, 2)
  for (const issue of skipped) {
    assertEquals(issue.level, 'warning')
    assertEquals(issue.location, 'User.posts')
  }
  // Each arg is its own issue so consumers can filter by individual name.
  const messages = skipped.map(i => i.message).sort()
  assertEquals(
    messages.some(m => m.includes("'limit'")),
    true
  )
  assertEquals(
    messages.some(m => m.includes("'offset'")),
    true
  )
})

Deno.test('GqlParseContext - root-field arguments are NOT logged as skipped (we model them)', () => {
  const sdl = /* GraphQL */ `
    type User { id: ID! }
    type Query {
      getUser(id: ID!): User
    }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const skipped = ctx.issues.filter(i => i.type === 'SKIPPED_FIELD_ARGUMENTS')
  assertEquals(skipped.length, 0)
})

Deno.test('GqlParseContext - records custom directives as DROPPED_DIRECTIVE warnings', () => {
  const sdl = /* GraphQL */ `
    directive @auth(role: String!) on FIELD_DEFINITION
    directive @cost(value: Int!) on FIELD_DEFINITION

    type User {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 2)
  const names = dropped.map(i => i.location).sort()
  assertEquals(names, ['@auth', '@cost'])
})

Deno.test('GqlParseContext - built-in directives (@skip, @include, @deprecated) are NOT logged', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      legacyName: String @deprecated(reason: "use name")
    }
    type Query { _: Boolean }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 0)
})

Deno.test('GqlParseContext - silent=false mirrors issues to console.warn', () => {
  const sdl = /* GraphQL */ `
    type Matrix { cells: [[Int]] }
    type Query { _: Boolean }
  `

  const captured: string[] = []
  const originalWarn = console.warn
  console.warn = (msg: unknown) => {
    captured.push(String(msg))
  }
  try {
    const ctx = new GqlParseContext({ source: sdl, silent: false })
    ctx.parse()
  } finally {
    console.warn = originalWarn
  }

  assertEquals(
    captured.some(m => m.includes('[gql:warning]') && m.includes('Matrix.cells')),
    true
  )
})

Deno.test('GqlParseContext - field-level applied directives are recorded with field location', () => {
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
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  // 2 directive *definitions* + 2 *applications* = 4
  assertEquals(dropped.length, 4)

  const fieldLevel = dropped.filter(i => i.location.startsWith('User.'))
  assertEquals(fieldLevel.length, 2)
  const fieldLocations = fieldLevel.map(i => i.location).sort()
  assertEquals(fieldLocations, ['User.expensive', 'User.secret'])
})

Deno.test('GqlParseContext - type-level applied directives are recorded with type location', () => {
  const sdl = /* GraphQL */ `
    directive @entity on OBJECT
    type User @entity {
      id: ID!
    }
    type Query { _: Boolean }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const typeLevel = ctx.issues.filter(
    i => i.type === 'DROPPED_DIRECTIVE' && i.location === 'User'
  )
  assertEquals(typeLevel.length, 1)
  assertEquals(typeLevel[0].message.includes("'@entity'"), true)
})

Deno.test('GqlParseContext - root-field applied directives are recorded with operation location', () => {
  const sdl = /* GraphQL */ `
    directive @auth(role: String!) on FIELD_DEFINITION
    type User { id: ID! }
    type Query {
      me: User! @auth(role: "user")
    }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const opLevel = ctx.issues.filter(
    i => i.type === 'DROPPED_DIRECTIVE' && i.location === 'Query.me'
  )
  assertEquals(opLevel.length, 1)
})

Deno.test('GqlParseContext - applied @deprecated is NOT recorded (its reason is captured)', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      legacyName: String @deprecated(reason: "use name")
    }
    type Query { _: Boolean }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  const dropped = ctx.issues.filter(i => i.type === 'DROPPED_DIRECTIVE')
  assertEquals(dropped.length, 0)
})

Deno.test('GqlParseContext - schema with no issues yields an empty issues list', () => {
  const sdl = /* GraphQL */ `
    type User {
      id: ID!
      name: String
    }
    type Query {
      getUser(id: ID!): User!
    }
  `
  const ctx = new GqlParseContext({ source: sdl })
  ctx.parse()

  assertEquals(ctx.issues.length, 0)
})
