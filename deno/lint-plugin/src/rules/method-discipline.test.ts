import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'method-discipline'

Deno.test('method-discipline: flags a protocol-mirror getter on a snippet', () => {
  const messages = messagesFrom(
    RULE,
    `class DataClassValue extends KtSnippet {
       get annotations() {
         return this.value.annotations
       }
       override toString(): string {
         return 'x'
       }
     }`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'getter annotations on producer DataClassValue')
})

Deno.test('method-discipline: flags a string-builder method on a projection', () => {
  const messages = messagesFrom(
    RULE,
    `export const ZodBase = toZodModelProjectionBase({ id: 'gen-zod' })
     export class ZodProjection extends ZodBase {
       constructor(args: Args) { super(args) }
       toProperties(): string { return this.entries.join(', ') }
       override toString(): string { return this.toProperties() }
     }`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'method toProperties() on producer ZodProjection')
})

Deno.test('method-discipline: flags through a base named by convention and transitively in-file', () => {
  const source = `class Base extends KtModelBase {
      helperOne(): string { return 'a' }
    }
    class Child extends Base {
      helperTwo(): string { return 'b' }
    }`
  assertEquals(lint(RULE, source).length, 2)
})

Deno.test('method-discipline: flags when the factory is called inline in the extends clause', () => {
  const source = `class Projection extends toTsModelProjectionBase({ id: 'gen-x' }) {
      helper(): string { return 'a' }
    }`
  assertEquals(lint(RULE, source).length, 1)
})

Deno.test('method-discipline: silent on constructor + toString only', () => {
  const source = `class StringValue extends KtSnippet {
      type = 'string' as const
      annotations: KtAnnotation[] = []
      constructor({ context, stringSchema, modifiers }: Args) {
        super({ context })
        this.format = stringSchema.format
      }
      override toString(): string { return 'String' }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('method-discipline: silent on an accumulator mutator', () => {
  const source = `class MockRoutesList extends MswBase {
      routes: MockRoute[] = []
      add(route: MockRoute) {
        this.routes.push(route)
      }
      override toString(): string { return this.routes.join(',') }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('method-discipline: silent on a non-producer class', () => {
  const source = `class Selection {
      toLabel(): string { return this.name }
    }
    class ParamField {
      toInput(): string { return this.name }
    }
    class Database extends Postgres {
      query(): string { return 'select 1' }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('method-discipline: silent in test files', () => {
  const source = `class Value extends KtSnippet {
      helper(): string { return 'a' }
    }`
  assertEquals(lint(RULE, source, '/gen-thing/src/Value.test.ts'), [])
})
