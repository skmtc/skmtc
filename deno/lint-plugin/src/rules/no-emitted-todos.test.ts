import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'no-emitted-todos'

Deno.test('no-emitted-todos: flags each marker kind in emitted text', () => {
  const todo = messagesFrom(RULE, 'const a = `// TODO: implement the handler`')
  assertEquals(todo.length, 1)
  assertStringIncludes(todo[0] ?? '', 'TODO marker in emitted text')

  assertEquals(lint(RULE, 'const b = `// FIXME: wire the client`').length, 1)
  assertEquals(lint(RULE, 'const c = `// XXX: placeholder body`').length, 1)
})

Deno.test('no-emitted-todos: reports once per template, on the first marker', () => {
  const messages = messagesFrom(RULE, 'const a = `// TODO: one\n// FIXME: two\n// XXX: three`')
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'TODO marker')
})

Deno.test('no-emitted-todos: reports a nested template once, and ignores marker-named expressions', () => {
  assertEquals(lint(RULE, 'const a = `head\n${`// TODO: fill in`}\ntail`').length, 1)
  assertEquals(lint(RULE, 'const b = `${todoCount} items`'), [])
})

Deno.test('no-emitted-todos: silent on a lowercase placeholder attribute', () => {
  const source = 'const field = `<input placeholder="Enter a name" />`'
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-emitted-todos: silent on a TODO in the generator own comment', () => {
  const source = `// TODO: add the enum case once the shape is decided
    const rendered = \`export type Thing = string\``
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-emitted-todos: silent on identifiers that merely contain the marker letters', () => {
  assertEquals(lint(RULE, 'const a = `const todoList = []`').length, 0)
})

Deno.test('no-emitted-todos: silent in test files', () => {
  assertEquals(lint(RULE, 'const a = `// TODO: x`', '/gen-thing/src/Value.test.ts'), [])
})
