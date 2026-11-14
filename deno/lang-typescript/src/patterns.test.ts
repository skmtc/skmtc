import { assert, assertEquals, assertFalse } from '@std/assert'
import { escapeRegExpText, toAnyStringExceptPattern, toRegExpLiteral } from '@/src/patterns.ts'

/** Property names from real documents and the characters that break code. */
const AWKWARD_NAMES = [
  'id',
  'a.b',
  'a/b',
  'a"b',
  "a'b",
  'a\\b',
  'a\nb',
  'a\u2028b',
  '$ref',
  'count()',
  'idp:role-restricted',
  'a|b',
  '[x]',
  '24h',
  ''
]

/** Evaluates a regex literal the way a generated file would. */
const evaluateLiteral = (literal: string): RegExp => new Function(`return ${literal}`)()

Deno.test('escapeRegExpText - each name matches itself exactly and nothing near it', () => {
  for (const name of AWKWARD_NAMES) {
    for (const flags of ['', 'u', 'v']) {
      const pattern = new RegExp(`^${escapeRegExpText(name)}$`, flags)

      assert(pattern.test(name), `${JSON.stringify(name)} with flags '${flags}' should match itself`)
    }
  }

  // The trap: unescaped, `a.b` also matches `aXb`, and `a|b` matches `a`.
  assertFalse(new RegExp(`^${escapeRegExpText('a.b')}$`).test('aXb'))
  assertFalse(new RegExp(`^${escapeRegExpText('a|b')}$`).test('a'))
  assertFalse(new RegExp(`^${escapeRegExpText('count()')}$`).test('count'))
})

Deno.test('escapeRegExpText - a plain name is left as it is', () => {
  assertEquals(escapeRegExpText('userName'), 'userName')
  assertEquals(escapeRegExpText('a.b'), 'a\\.b')
})

Deno.test('toAnyStringExceptPattern - matches every string except the names', () => {
  const pattern = new RegExp(toAnyStringExceptPattern({ names: AWKWARD_NAMES }))

  for (const name of AWKWARD_NAMES) {
    assertFalse(pattern.test(name), `${JSON.stringify(name)} is named, so it must not match`)
  }

  for (const other of ['aXb', 'a', 'b', 'count', 'idx', 'xid', '$re', 'a.bc', 'other']) {
    assert(pattern.test(other), `${JSON.stringify(other)} is not named, so it must match`)
  }
})

Deno.test('toAnyStringExceptPattern - with no names, every string matches', () => {
  assertEquals(toAnyStringExceptPattern({ names: [] }), '')
  assert(new RegExp(toAnyStringExceptPattern({ names: [] })).test('anything'))
})

Deno.test('toAnyStringExceptPattern - renders the names in order, escaped', () => {
  assertEquals(toAnyStringExceptPattern({ names: ['id', 'a.b'] }), '^(?!(?:id|a\\.b)$)')
})

Deno.test('toRegExpLiteral - the literal parses and matches what the pattern matches', () => {
  const cases: Array<{ source: string; matches: string[]; misses: string[] }> = [
    { source: '^a/b$', matches: ['a/b'], misses: ['ab'] },
    // An already-escaped slash stays as it is.
    { source: '^a\\/b$', matches: ['a/b'], misses: ['ab'] },
    // A slash inside a class does not end the literal and needs no escape.
    { source: '^[/]$', matches: ['/'], misses: ['a'] },
    { source: '^[a\\]/]+$', matches: ['a]/'], misses: ['b'] },
    { source: '^x-', matches: ['x-rate'], misses: ['rate-x-'] },
    { source: 'a\nb', matches: ['a\nb'], misses: ['ab'] },
    { source: 'a\u2028b', matches: ['a\u2028b'], misses: ['ab'] },
    // A raw line break after a backslash is an escape of that line break.
    { source: 'a\\\nb', matches: ['a\nb'], misses: ['ab'] },
    { source: '', matches: ['', 'anything'], misses: [] },
    { source: toAnyStringExceptPattern({ names: ['a/b', 'a\nb'] }), matches: ['ab', 'x'], misses: ['a/b', 'a\nb'] }
  ]

  for (const { source, matches, misses } of cases) {
    const literal = toRegExpLiteral(source)
    const pattern = evaluateLiteral(literal)

    for (const text of matches) assert(pattern.test(text), `${literal} should match ${JSON.stringify(text)}`)
    for (const text of misses) assertFalse(pattern.test(text), `${literal} should not match ${JSON.stringify(text)}`)
  }
})

Deno.test('toRegExpLiteral - writes flags, and an empty pattern as /(?:)/', () => {
  assertEquals(toRegExpLiteral('^x-', 'u'), '/^x-/u')
  // The trap: `//` would start a comment.
  assertEquals(toRegExpLiteral(''), '/(?:)/')
})
