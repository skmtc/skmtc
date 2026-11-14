import { assert, assertEquals, assertFalse, assertThrows } from '@std/assert'
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

// The trap: a `/` or a line break written into a literal as it is ends the
// literal, and the rest of the line becomes code.
Deno.test('toRegExpLiteral - escapes only what would end the literal', () => {
  const cases: Array<[string, string]> = [
    ['^a/b$', '/^a\\/b$/'],
    // An already-escaped slash stays as it is.
    ['^a\\/b$', '/^a\\/b$/'],
    // A slash inside a class does not end the literal and needs no escape.
    ['^[/]$', '/^[/]$/'],
    ['^[a\\]/]+$', '/^[a\\]/]+$/'],
    ['a\nb', '/a\\nb/'],
    ['a\u2028b', '/a\\u2028b/'],
    // A raw line break after a backslash is an escape of that line break.
    ['a\\\nb', '/a\\nb/'],
    [toAnyStringExceptPattern({ names: ['a/b', 'a\nb'] }), '/^(?!(?:a\\/b|a\\nb)$)/']
  ]

  for (const [source, expected] of cases) {
    assertEquals(toRegExpLiteral(source), expected, JSON.stringify(source))
  }
})

Deno.test('toRegExpLiteral - writes flags, and an empty pattern as /(?:)/', () => {
  assertEquals(toRegExpLiteral('^x-', 'u'), '/^x-/u')
  // The trap: `//` would start a comment.
  assertEquals(toRegExpLiteral(''), '/(?:)/')
})

// The trap: each of these, written into the literal, breaks the file around
// it rather than one regex. A trailing `\` escapes the closing `/`, a leading
// `*` opens a block comment, and flags are written into code as they are.
Deno.test('toRegExpLiteral - throws on a pattern or flags that are not valid JavaScript', () => {
  const cases: Array<[string, string]> = [
    ['abc\\', ''],
    ['*x', ''],
    ['(?i)abc', ''],
    ['a', 'g;run()//'],
    ['a', 'gg'],
    ['a', 'uv']
  ]

  for (const [source, flags] of cases) {
    assertThrows(() => toRegExpLiteral(source, flags), SyntaxError, undefined, `${JSON.stringify(source)} /${flags}`)
  }
})
