import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'no-template-imports'

Deno.test('no-template-imports: flags a named import in emitted text', () => {
  const messages = messagesFrom(
    RULE,
    "const rendered = `import { z } from 'zod'\\n\\nexport const schema = z.string()`"
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'imports are added via register')
})

Deno.test('no-template-imports: flags a side-effect import in emitted text', () => {
  assertEquals(lint(RULE, "const rendered = `import './polyfill.js'`").length, 1)
})

Deno.test('no-template-imports: flags an import broken across an interpolation', () => {
  const source = "const rendered = `import { ${name} } from '${path}'`"
  assertEquals(lint(RULE, source).length, 1)
})

Deno.test('no-template-imports: silent on emitted code with no import statement', () => {
  const source = `class Value extends TsSnippet {
      override toString(): string {
        return \`export const \${this.name} = z.object({ \${this.properties} })\`
      }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-template-imports: silent on the generator own imports and on prose mentioning import', () => {
  const source = `import { TsSnippet } from '@skmtc/lang-typescript'
    // Imports are registered, never emitted: see the import channel note.
    const note = 'the import channel is register'`
  assertEquals(lint(RULE, source), [])
})

Deno.test('no-template-imports: silent in test files', () => {
  assertEquals(
    lint(RULE, "const rendered = `import { z } from 'zod'`", '/gen-thing/src/Value.test.ts'),
    []
  )
})
