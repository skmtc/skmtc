import { assert, assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert'
import { SnippetBase } from './SnippetBase.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { CaptureSink } from '@/anchors/CaptureSink.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

// SnippetBase self-wraps `toString` at construction (own-property wrapper)
// and reads the capture sink through `this.context.captureSink`. Outside
// the capture interval the wrapper is a pure pass-through. Full occurrence
// semantics live in CaptureSink.test.ts; here we pin SnippetBase's own
// contract.
const stubContext = (): GenerateContextType => ({}) as unknown as GenerateContextType

class FakeSnippet extends SnippetBase {
  body: () => string
  toStringCalls = 0

  constructor(context: GenerateContextType, body: () => string, stackTrail?: StackTrail) {
    super({ context, stackTrail })
    this.body = body
  }

  override toString(): string {
    this.toStringCalls++
    return this.body()
  }
}

Deno.test('SnippetBase - installs a shared, non-enumerable own-property toString wrapper', () => {
  const first = new FakeSnippet(stubContext(), () => 'hello')
  const second = new FakeSnippet(stubContext(), () => 'world')

  // Self-wrap at birth: the wrapper is an own property (it must shadow
  // every prototype toString)...
  assertEquals(Object.hasOwn(first, 'toString'), true)
  // ...one shared function value, no per-instance closure...
  assertStrictEquals(first.toString, second.toString)
  // ...non-enumerable, so it never shows up in spreads / Object.keys.
  assertEquals(Object.keys(first).includes('toString'), false)
  // The prototype's real implementation is untouched.
  assertEquals(`${first}`, 'hello')
  assertEquals(`${second}`, 'world')
})

Deno.test('SnippetBase - toString is a pure pass-through outside the capture interval', () => {
  // Bare mock context: `.captureSink` reads `undefined` → pass-through.
  const s = new FakeSnippet(stubContext(), () => 'hello')
  assertEquals(`${s}`, 'hello')
  assertEquals(`${s}`, 'hello')
  // No cache: the subclass body runs on every coercion.
  assertEquals(s.toStringCalls, 2)
})

Deno.test('SnippetBase - observes into the context capture sink during a file render', () => {
  const sink = new CaptureSink()
  const context = { captureSink: sink } as unknown as GenerateContextType
  const s = new FakeSnippet(context, () => 'observed')

  // Inside the sink's file render, the wrapper routes through observe —
  // output is returned verbatim and the real toString still runs.
  const { text } = sink.captureFile(() => `${s}`)
  assertEquals(text, 'observed')
  assertEquals(s.toStringCalls, 1)

  // Between files (interval open, no file rendering) observe passes through.
  assertEquals(`${s}`, 'observed')
  assertEquals(s.toStringCalls, 2)
})

Deno.test('SnippetBase - carries no _rendered / _children capture fields', () => {
  const s = new FakeSnippet(stubContext(), () => 'x')
  assertEquals(`${s}`, 'x')
  assertEquals('_rendered' in s, false)
  assertEquals('_children' in s, false)
})

Deno.test('SnippetBase - empty stackTrail when no originating position is passed', () => {
  const s = new FakeSnippet(stubContext(), () => 'x')
  assert(s.stackTrail.isEmpty())
})

Deno.test('SnippetBase - stores the caller-supplied stackTrail snapshot as-is', () => {
  // The clone lives at the CALL SITE — the boundary where the live,
  // mutable trail is in hand: `stackTrail: schema.stackTrail.clone()`.
  const live = new StackTrail(['components', 'schemas', 'Pet'])
  const s = new FakeSnippet(stubContext(), () => 'x', live.clone())

  // The snapshot is a distinct instance with equal frames...
  assertNotStrictEquals(s.stackTrail, live)
  assertEquals(s.stackTrail.stackTrail, ['components', 'schemas', 'Pet'])

  // ...so mutating the source trail does not corrupt the captured position.
  live.append('properties')
  assertEquals(s.stackTrail.stackTrail, ['components', 'schemas', 'Pet'])
})
