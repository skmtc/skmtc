import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'no-as-casts'

Deno.test('no-as-casts: flags a cast that silences the schema union', () => {
  const messages = messagesFrom(
    RULE,
    `const value = { toString: () => 'type("unknown")' } as TypeSystemValue`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'as cast (TypeSystemValue)')
})

Deno.test('no-as-casts: silent on as const', () => {
  const source = `class StringValue extends KtSnippet {
      type = 'string' as const
      formats = ['date', 'date-time'] as const
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-as-casts: silent on satisfies and on non-null assertions', () => {
  const source = `const config = { id: 'gen-thing' } satisfies Config
    const name = maybeName!`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-as-casts: flags each cast separately', () => {
  const source = `const a = one as A
    const b = two as B
    const c = three as const`
  assertEquals(lint(RULE, source).length, 2)
})

// `deno-lint-ignore` for an approved cast is applied by the `deno lint`
// driver, not by `Deno.lint.runPlugin` — it is covered in
// `src/test/deno-lint.test.ts`.

Deno.test('no-as-casts: silent in test files — casts are sanctioned there', () => {
  assertEquals(lint(RULE, `const value = raw as Thing`, '/gen-thing/src/Value.test.ts'), [])
})
