import { assertEquals, assert, assertFalse } from '@std/assert'
import {
  toJsonPointer,
  fromJsonPointer,
  append,
  escapeSegment,
  unescapeSegment,
  isJsonPointer,
  type JsonPointer
} from './JsonPointer.ts'

Deno.test('escapeSegment — RFC 6901 special chars', () => {
  assertEquals(escapeSegment('simple'), 'simple')
  assertEquals(escapeSegment('/users/{id}'), '~1users~1{id}')
  assertEquals(escapeSegment('tilde~thing'), 'tilde~0thing')
  // Tilde must escape before slash to avoid double-encoding
  assertEquals(escapeSegment('mix/~/slash'), 'mix~1~0~1slash')
})

Deno.test('unescapeSegment — round-trip', () => {
  assertEquals(unescapeSegment('~1users~1{id}'), '/users/{id}')
  assertEquals(unescapeSegment('tilde~0thing'), 'tilde~thing')
  assertEquals(unescapeSegment('mix~1~0~1slash'), 'mix/~/slash')
})

Deno.test('toJsonPointer — basic', () => {
  assertEquals(toJsonPointer([]), '#/' as JsonPointer)
  assertEquals(toJsonPointer(['components']), '#/components' as JsonPointer)
  assertEquals(
    toJsonPointer(['components', 'schemas', 'User']),
    '#/components/schemas/User' as JsonPointer
  )
})

Deno.test('toJsonPointer — escapes path segments', () => {
  assertEquals(
    toJsonPointer(['paths', '/users/{id}', 'get']),
    '#/paths/~1users~1{id}/get' as JsonPointer
  )
})

Deno.test('fromJsonPointer — parses URI fragment form', () => {
  assertEquals(fromJsonPointer('#/'), [])
  assertEquals(fromJsonPointer('#/components'), ['components'])
  assertEquals(fromJsonPointer('#/components/schemas/User'), ['components', 'schemas', 'User'])
  assertEquals(fromJsonPointer('#/paths/~1users~1{id}/get'), ['paths', '/users/{id}', 'get'])
})

Deno.test('fromJsonPointer — parses raw form', () => {
  assertEquals(fromJsonPointer('/components/schemas/User'), ['components', 'schemas', 'User'])
})

Deno.test('fromJsonPointer — root forms', () => {
  assertEquals(fromJsonPointer('#'), [])
  assertEquals(fromJsonPointer(''), [])
})

Deno.test('fromJsonPointer — rejects malformed', () => {
  assertEquals(fromJsonPointer('components/schemas/User'), undefined)
  assertEquals(fromJsonPointer('garbage'), undefined)
})

Deno.test('round-trip preserves adversarial segments', () => {
  const segments = [
    'paths',
    '/some/{var}/path',
    'responses',
    '200',
    'content',
    'application/json',
    'schema',
    'properties',
    'metadata',
    'additionalProperties',
    '~tilde'
  ]
  const pointer = toJsonPointer(segments)
  assertEquals(fromJsonPointer(pointer), segments)
})

Deno.test('append — extends pointer', () => {
  const base = toJsonPointer(['components', 'schemas', 'User'])
  assertEquals(append(base, 'properties'), '#/components/schemas/User/properties' as JsonPointer)
  assertEquals(
    append(base, 'properties', 'email'),
    '#/components/schemas/User/properties/email' as JsonPointer
  )
})

Deno.test('append — handles root pointer', () => {
  const root = toJsonPointer([])
  assertEquals(append(root, 'components'), '#/components' as JsonPointer)
})

Deno.test('append — escapes appended segments', () => {
  const base = toJsonPointer(['paths'])
  assertEquals(append(base, '/users/{id}'), '#/paths/~1users~1{id}' as JsonPointer)
})

Deno.test('append — empty segment list is a no-op', () => {
  const base = toJsonPointer(['components'])
  assertEquals(append(base), base)
})

Deno.test('isJsonPointer — type guard', () => {
  assert(isJsonPointer('#/'))
  assert(isJsonPointer('#/components/schemas/User'))
  assertFalse(isJsonPointer('components/schemas/User'))
  assertFalse(isJsonPointer(42))
  assertFalse(isJsonPointer(null))
  assertFalse(isJsonPointer(undefined))
})
