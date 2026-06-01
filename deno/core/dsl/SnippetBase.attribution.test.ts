import { assert, assertEquals, assertNotStrictEquals } from '@std/assert'
import { SnippetBase, seenSnippetConstructors } from './SnippetBase.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

// SnippetBase holds no capture state and installs no shadow `toString`.
// Capture is the render phase's job (see CaptureSink.test.ts); here we
// pin SnippetBase's own contract.
const stubContext = (): GenerateContextType => ({}) as unknown as GenerateContextType

class FakeSnippet extends SnippetBase {
  body: () => string
  toStringCalls = 0

  constructor(context: GenerateContextType, body: () => string, schema?: OasSchema) {
    super({ context, schema })
    this.body = body
  }

  override toString(): string {
    this.toStringCalls++
    return this.body()
  }
}

Deno.test(
  'SnippetBase - no instance-level toString shadow; toString stays on the prototype',
  () => {
    const s = new FakeSnippet(stubContext(), () => 'hello')
    // The constructor no longer reassigns `this.toString`.
    assertEquals(Object.hasOwn(s, 'toString'), false)
    assertEquals(`${s}`, 'hello')
  }
)

Deno.test('SnippetBase - toString is a pure pass-through outside capture (no caching)', () => {
  const s = new FakeSnippet(stubContext(), () => 'hello')
  assertEquals(`${s}`, 'hello')
  assertEquals(`${s}`, 'hello')
  // No cache: the subclass body runs on every coercion.
  assertEquals(s.toStringCalls, 2)
})

Deno.test('SnippetBase - carries no _rendered / _children capture fields', () => {
  const s = new FakeSnippet(stubContext(), () => 'x')
  assertEquals(`${s}`, 'x')
  assertEquals('_rendered' in s, false)
  assertEquals('_children' in s, false)
})

Deno.test('SnippetBase - registers its concrete subclass via new.target', () => {
  new FakeSnippet(stubContext(), () => 'x')
  assert(seenSnippetConstructors.has(FakeSnippet))
})

Deno.test('SnippetBase - empty schemaPointer when no originating schema', () => {
  const s = new FakeSnippet(stubContext(), () => 'x')
  assert(s.schemaPointer.isEmpty())
})

Deno.test('SnippetBase - clones the schema stackTrail (snapshot, not alias)', () => {
  const trail = new StackTrail(['components', 'schemas', 'Pet'])
  const schema = { stackTrail: trail } as unknown as OasSchema
  const s = new FakeSnippet(stubContext(), () => 'x', schema)

  // The snapshot is a distinct instance with equal frames...
  assertNotStrictEquals(s.schemaPointer, trail)
  assertEquals(s.schemaPointer.stackTrail, ['components', 'schemas', 'Pet'])

  // ...so mutating the source trail does not corrupt the captured pointer.
  trail.append('properties')
  assertEquals(s.schemaPointer.stackTrail, ['components', 'schemas', 'Pet'])
})
