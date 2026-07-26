import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'no-adhoc-tostring'

Deno.test('no-adhoc-tostring: flags an arrow toString property', () => {
  const messages = messagesFrom(RULE, `const value = { toString: () => 'type("unknown")' }`)
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'a stringable fragment is a Snippet')
})

Deno.test('no-adhoc-tostring: flags a shorthand toString method', () => {
  assertEquals(lint(RULE, `const value = { name: 'x', toString() { return this.name } }`).length, 1)
})

Deno.test('no-adhoc-tostring: flags a quoted toString key', () => {
  assertEquals(lint(RULE, `const value = { 'toString': () => 'x' }`).length, 1)
})

Deno.test('no-adhoc-tostring: silent on a class toString and on unrelated literals', () => {
  const source = `class StringValue extends KtSnippet {
      override toString(): string {
        return 'String'
      }
    }
    const settings = { toIdentifierName: 'x', imports: { './a.ts': ['A'] } }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-adhoc-tostring: silent on a type declaring toString', () => {
  assertEquals(lint(RULE, `type Stringable = { toString: () => string }`), [])
})

Deno.test('no-adhoc-tostring: silent in test files', () => {
  assertEquals(
    lint(RULE, `const value = { toString: () => 'x' }`, '/gen-thing/src/Value.test.ts'),
    []
  )
})
