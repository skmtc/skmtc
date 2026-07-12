import { assertEquals, assertThrows } from '@std/assert'
import type { JsonValue } from './overlay.ts'
import { type PathMatch, queryPaths } from './jsonpath.ts'

function values(matches: PathMatch[]): JsonValue[] {
  return matches.map(match => match.value)
}

const doc: JsonValue = {
  openapi: '3.1.0',
  servers: [
    { url: 'https://dev.example.com', description: 'Dev' },
    { url: 'https://example.com', description: 'Prod' }
  ],
  paths: {
    '/pets': { get: { summary: 'list', tags: ['a'] }, post: { summary: 'create' } },
    '/dogs': { get: { summary: 'list dogs' } }
  },
  components: {
    schemas: {
      Pet: {
        properties: {
          id: { type: 'string' },
          age: { type: 'integer' },
          name: { type: 'string', description: 'the name' }
        }
      }
    }
  }
}

Deno.test('queryPaths - member and bracket access', () => {
  assertEquals(values(queryPaths(doc, '$.openapi')), ['3.1.0'])
  assertEquals(values(queryPaths(doc, "$.paths['/pets'].get.summary")), ['list'])
  assertEquals(values(queryPaths(doc, '$.paths["/dogs"].get.summary')), ['list dogs'])
})

Deno.test('queryPaths - leading name without $ resolves from root', () => {
  assertEquals(values(queryPaths(doc, 'openapi')), ['3.1.0'])
})

Deno.test('queryPaths - wildcard over object and array', () => {
  assertEquals(values(queryPaths(doc, '$.paths.*.get.summary')), ['list', 'list dogs'])
  assertEquals(values(queryPaths(doc, '$.servers[*].description')), ['Dev', 'Prod'])
})

Deno.test('queryPaths - array index, negative index, and union', () => {
  assertEquals(values(queryPaths(doc, '$.servers[0].description')), ['Dev'])
  assertEquals(values(queryPaths(doc, '$.servers[-1].description')), ['Prod'])
  assertEquals(values(queryPaths(doc, '$.servers[0,1].url')), [
    'https://dev.example.com',
    'https://example.com'
  ])
})

Deno.test('queryPaths - recursive descent', () => {
  assertEquals(values(queryPaths(doc, '$..summary')).sort(), ['create', 'list', 'list dogs'].sort())
  assertEquals(values(queryPaths(doc, "$.paths..responses['500']")), [])
})

Deno.test('queryPaths - filter by string equality on an array', () => {
  const matches = queryPaths(doc, "$.servers[?(@.description == 'Dev')]")
  assertEquals(matches.length, 1)
  assertEquals(matches[0].value, { url: 'https://dev.example.com', description: 'Dev' })
})

Deno.test('queryPaths - filter selects object property values', () => {
  const matches = queryPaths(doc, "$.components.schemas.Pet.properties[?(@.type == 'string')]")
  assertEquals(matches.length, 2)
  assertEquals(matches.map(m => m.parentProperty).sort(), ['id', 'name'])
})

Deno.test('queryPaths - recursive descent combined with a filter', () => {
  const matches = queryPaths(doc, "$..[?(@.type == 'integer')]")
  assertEquals(values(matches), [{ type: 'integer' }])
})

Deno.test('queryPaths - filter is null-safe (no throw on null/missing nodes)', () => {
  const withNulls: JsonValue = {
    items: [null, { description: 'keep' }, { other: 1 }, 'a string', 42]
  }
  // jsonpath-plus 10.x throws on the `null` element here; ours simply skips it.
  const matches = queryPaths(withNulls, "$..[?(@.description == 'keep')]")
  assertEquals(values(matches), [{ description: 'keep' }])
})

Deno.test('queryPaths - existence, negation, comparison, and boolean filters', () => {
  const data: JsonValue = {
    rows: [{ n: 1, flag: true }, { n: 5 }, { n: 9, flag: false }]
  }
  assertEquals(values(queryPaths(data, '$.rows[?(@.flag)]')), [{ n: 1, flag: true }])
  assertEquals(values(queryPaths(data, '$.rows[?(!@.flag)]')), [{ n: 5 }, { n: 9, flag: false }])
  assertEquals(values(queryPaths(data, '$.rows[?(@.n >= 5)]')), [{ n: 5 }, { n: 9, flag: false }])
  assertEquals(values(queryPaths(data, '$.rows[?(@.n > 1 && @.n < 9)]')), [{ n: 5 }])
})

Deno.test('queryPaths - parent reference allows in-place mutation', () => {
  const data: JsonValue = { a: { b: { c: 1 } } }
  const [match] = queryPaths(data, '$.a.b.c')
  if (match.parent !== null && !Array.isArray(match.parent)) {
    match.parent[String(match.parentProperty)] = 2
  }
  assertEquals(data, { a: { b: { c: 2 } } })
})

Deno.test('queryPaths - unmatched path returns empty, malformed path throws', () => {
  assertEquals(queryPaths(doc, '$.nope.not.here'), [])
  assertEquals(queryPaths(doc, '£'), []) // parses as a name; just no match
  assertThrows(() => queryPaths(doc, '$.servers[?(@.x ==)]'))
  assertThrows(() => queryPaths(doc, '$.servers[0'))
})
