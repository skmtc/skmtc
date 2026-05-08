import { assertEquals } from '@std/assert/equals'
import { assertThrows } from '@std/assert/throws'
import { assertStringIncludes } from '@std/assert/string-includes'
import * as v from 'valibot'
import { ConfigValidationError, parseOrExplain } from '@/lib/parse-or-explain.ts'

const schema = v.object({
  name: v.string(),
  group: v.picklist(['forms', 'tables', 'inputs']),
  count: v.number()
})

Deno.test('parseOrExplain - returns parsed value on success', () => {
  const result = parseOrExplain(
    schema,
    { name: 'a', group: 'forms', count: 1 },
    'manifest at /tmp/manifest.json'
  )

  assertEquals(result, { name: 'a', group: 'forms', count: 1 })
})

Deno.test('parseOrExplain - wraps ValiError with context and dot-path', () => {
  const error = assertThrows(
    () =>
      parseOrExplain(
        schema,
        { name: 'a', group: 'graphql-client', count: 1 },
        'manifest at /tmp/manifest.json'
      ),
    ConfigValidationError
  )

  assertStringIncludes(error.message, 'manifest at /tmp/manifest.json')
  assertStringIncludes(error.message, '1 issue')
  assertStringIncludes(error.message, 'group:')
  assertStringIncludes(error.message, 'expected: ("forms" | "tables" | "inputs")')
  assertStringIncludes(error.message, 'received: "graphql-client"')
})

Deno.test('parseOrExplain - reports multiple issues with their paths', () => {
  const error = assertThrows(
    () =>
      parseOrExplain(
        schema,
        { name: 42, group: 'graphql-client', count: 'nope' },
        'manifest at /tmp/manifest.json'
      ),
    ConfigValidationError
  )

  assertStringIncludes(error.message, 'name:')
  assertStringIncludes(error.message, 'group:')
  assertStringIncludes(error.message, 'count:')
  assertEquals(error.issues.length, 3)
})

Deno.test('parseOrExplain - re-throws non-ValiError', () => {
  const sentinel = new Error('not a valibot error')

  const thrown = assertThrows(() =>
    parseOrExplain(
      v.pipe(
        v.unknown(),
        v.transform(() => {
          throw sentinel
        })
      ),
      'whatever',
      'unrelated context'
    )
  )

  assertEquals(thrown, sentinel)
})
