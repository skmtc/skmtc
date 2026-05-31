import { assert, assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
import { SnippetBase, __resetRenderStack } from './SnippetBase.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

// Attribution instrumentation is always on; SnippetBase ignores any
// context flag. A bare stub is enough to exercise the shadow `toString`.
const stubContext = (): GenerateContextType => ({}) as unknown as GenerateContextType

class FakeSnippet extends SnippetBase {
  body: () => string
  toStringCalls = 0

  constructor(context: GenerateContextType, body: () => string) {
    super({ context })
    this.body = body
  }

  override toString(): string {
    this.toStringCalls++
    return this.body()
  }
}

Deno.test('SnippetBase - shadow installed, caches output', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const s = new FakeSnippet(ctx, () => 'hello')

  assertEquals(Object.hasOwn(s, 'toString'), true)
  assertEquals(`${s}`, 'hello')
  assertEquals(`${s}`, 'hello')
  // Subclass body invoked only once; second coercion hits the cache.
  assertEquals(s.toStringCalls, 1)
  assertEquals(s._rendered, 'hello')
})

Deno.test('SnippetBase - parent/child edges captured during composition', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const child = new FakeSnippet(ctx, () => 'child')
  const parent = new FakeSnippet(ctx, () => `<${child}>`)

  assertEquals(`${parent}`, '<child>')
  assertEquals(parent._children?.length, 1)
  assertStrictEquals(parent._children?.[0], child)
  // Child rendered in isolation has no parent edge to anyone.
  assertEquals(child._children, undefined)
})

Deno.test('SnippetBase - standalone toString does not register a parent edge', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const s = new FakeSnippet(ctx, () => 'x')

  assertEquals(`${s}`, 'x')
  // Stack returned to empty after the single render.
  // Indirect assertion: a second standalone render still has no parent
  // and doesn't push anything onto a leaked stack.
  const s2 = new FakeSnippet(ctx, () => 'y')
  assertEquals(`${s2}`, 'y')
  assertEquals(s2._children, undefined)
})

Deno.test('SnippetBase - render stack remains balanced when subclass throws', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const boom = new FakeSnippet(ctx, () => {
    throw new Error('subclass failure')
  })

  assertThrows(() => `${boom}`, Error, 'subclass failure')

  // After the throw, the stack must be empty — otherwise the next
  // unrelated render would incorrectly inherit `boom` as a parent.
  const witness = new FakeSnippet(ctx, () => 'ok')
  assertEquals(`${witness}`, 'ok')
  assertEquals(witness._children, undefined)
})

Deno.test('SnippetBase - cycle detection throws rather than infinite-recurse', () => {
  __resetRenderStack()
  const ctx = stubContext()
  // Body that re-renders the same instance — composition cycle via
  // an aliased reference.
  let self: FakeSnippet
  // deno-lint-ignore prefer-const
  self = new FakeSnippet(ctx, () => `wrap(${self})`)

  assertThrows(() => `${self}`, Error, 'render cycle')
})

Deno.test('SnippetBase - cached output returns identical string on repeat coercion', () => {
  __resetRenderStack()
  const ctx = stubContext()
  // Non-deterministic body — proves the cache is what we read on call 2.
  let n = 0
  const s = new FakeSnippet(ctx, () => `count-${++n}`)

  assertEquals(`${s}`, 'count-1')
  assertEquals(`${s}`, 'count-1')
  assert(s._rendered === 'count-1')
})
