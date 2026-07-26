import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'no-redundant-ref-guard'

Deno.test('no-redundant-ref-guard: flags the guard in either branch order', () => {
  const messages = messagesFrom(
    RULE,
    `const a = schema.isRef() ? schema.resolve() : schema
     const b = schema.isRef() ? schema : schema.resolve()`
  )
  assertEquals(messages.length, 2)
  assertStringIncludes(messages[0] ?? '', 'redundant isRef() guard')
})

Deno.test('no-redundant-ref-guard: flags resolveOnce and offers it as the fix', () => {
  const diagnostics = lint(RULE, `const a = property.isRef() ? property.resolveOnce() : property`)
  assertEquals(diagnostics.length, 1)
  assertEquals(diagnostics[0]?.fix?.[0]?.text, 'property.resolveOnce()')
})

Deno.test('no-redundant-ref-guard: silent on genuine isRef branching', () => {
  const source = `const name = schema.isRef() ? schema.toRefName() : fallbackName
    const kind = schema.isRef() ? 'ref' : schema.type`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-redundant-ref-guard: silent on an unconditional resolve', () => {
  const source = `const resolved = context.resolveSchemaRefOnce(refName, id).resolve()`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-redundant-ref-guard: silent when the subjects differ', () => {
  assertEquals(lint(RULE, `const a = left.isRef() ? right.resolve() : right`), [])
})

Deno.test('no-redundant-ref-guard: silent in test files', () => {
  assertEquals(
    lint(RULE, `const a = schema.isRef() ? schema.resolve() : schema`, '/g/src/V.test.ts'),
    []
  )
})
