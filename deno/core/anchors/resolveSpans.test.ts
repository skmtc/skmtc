import { assertEquals, assertStrictEquals } from '@std/assert'
import { SnippetBase, __resetRenderStack } from '@/dsl/SnippetBase.ts'
import { Definition } from '@/dsl/Definition.ts'
import { File } from '@/dsl/File.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { resolveSpansForFile } from './resolveSpans.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

const stubContext = (): GenerateContextType =>
  ({
    attribution: { enabled: true }
  }) as unknown as GenerateContextType

class FakeSnippet extends SnippetBase {
  body: () => string

  constructor(context: GenerateContextType, body: () => string, generatorKey?: GeneratorKey) {
    super({ context, generatorKey })
    this.body = body
  }

  override toString(): string {
    return this.body()
  }
}

const makeFile = (defs: Definition[]): File => {
  const file = new File({ path: 'out.ts', settings: undefined })
  for (const def of defs) {
    file.definitions.set(def.identifier.name, def)
  }
  return file
}

Deno.test('resolveSpans - top-level Definition spans match file slice', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const value = new FakeSnippet(ctx, () => "'hello'")
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('GREETING'),
    value
  })
  const file = makeFile([def])
  const text = file.toString()
  const spans = resolveSpansForFile(file)

  // Definition span = the whole rendered Definition text.
  const defSpan = spans.find(s => s.producer === def)
  assertEquals(defSpan !== undefined, true)
  assertEquals(text.slice(defSpan!.from, defSpan!.to), def._rendered)

  // Child (the `value`) span lands strictly inside the Definition.
  const valueSpan = spans.find(s => s.producer === value)
  assertEquals(valueSpan !== undefined, true)
  assertEquals(text.slice(valueSpan!.from, valueSpan!.to), "'hello'")
  assertEquals(valueSpan!.from >= defSpan!.from, true)
  assertEquals(valueSpan!.to <= defSpan!.to, true)
})

Deno.test('resolveSpans - identical sibling text attributed in document order', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const a = new FakeSnippet(ctx, () => 'x')
  const b = new FakeSnippet(ctx, () => 'x')
  const value = new FakeSnippet(ctx, () => `${a}_${b}`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('PAIR'),
    value
  })
  const file = makeFile([def])
  const text = file.toString()
  const spans = resolveSpansForFile(file)

  const aSpan = spans.find(s => s.producer === a)
  const bSpan = spans.find(s => s.producer === b)
  assertEquals(aSpan !== undefined, true)
  assertEquals(bSpan !== undefined, true)
  assertEquals(text.slice(aSpan!.from, aSpan!.to), 'x')
  assertEquals(text.slice(bSpan!.from, bSpan!.to), 'x')
  // Document order: a's offset comes before b's.
  assertEquals(aSpan!.from < bSpan!.from, true)
})

Deno.test('resolveSpans - child whose text is not in parent is skipped', () => {
  __resetRenderStack()
  const ctx = stubContext()
  // Child renders one thing, but the parent reshapes it so the
  // original text isn't present in the parent's output.
  const child = new FakeSnippet(ctx, () => 'lowercase')
  const value = new FakeSnippet(ctx, () => {
    // Touch the child to trigger _rendered capture, then emit different text.
    const _ = child.toString()
    return 'UPPERCASE'
  })
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('CASED'),
    value
  })
  const file = makeFile([def])
  const spans = resolveSpansForFile(file)

  // Parent and child both got registered, but only parent's span survives.
  assertEquals(spans.some(s => s.producer === value), true)
  assertEquals(spans.some(s => s.producer === child), false)
})

Deno.test('resolveSpans - zero-length child is filtered out', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const empty = new FakeSnippet(ctx, () => '')
  const value = new FakeSnippet(ctx, () => `before${empty}after`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('EMPTY'),
    value
  })
  const file = makeFile([def])
  const spans = resolveSpansForFile(file)

  assertEquals(spans.some(s => s.producer === empty), false)
})

Deno.test('resolveSpans - multiple Definitions appear in document order', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const first = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('FIRST'),
    value: new FakeSnippet(ctx, () => '1')
  })
  const second = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('SECOND'),
    value: new FakeSnippet(ctx, () => '2')
  })
  const file = makeFile([first, second])
  const spans = resolveSpansForFile(file)

  const firstSpan = spans.find(s => s.producer === first)
  const secondSpan = spans.find(s => s.producer === second)
  assertEquals(firstSpan !== undefined, true)
  assertEquals(secondSpan !== undefined, true)
  assertEquals(firstSpan!.from < secondSpan!.from, true)
})

Deno.test('resolveSpans - property: every span.slice equals producer._rendered', () => {
  __resetRenderStack()
  const ctx = stubContext()
  const inner = new FakeSnippet(ctx, () => 'inner')
  const middle = new FakeSnippet(ctx, () => `<${inner}/>`)
  const outer = new FakeSnippet(ctx, () => `[ ${middle} ]`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('NESTED'),
    value: outer
  })
  const file = makeFile([def])
  const text = file.toString()
  const spans = resolveSpansForFile(file)

  for (const span of spans) {
    assertEquals(
      text.slice(span.from, span.to),
      span.producer._rendered ?? span.producer.toString(),
      `Span for ${span.producer.constructor.name} should match its rendered text`
    )
  }
})

Deno.test('resolveSpans - returns empty array when File has no Definitions', () => {
  const file = new File({ path: 'empty.ts', settings: undefined })
  const spans = resolveSpansForFile(file)
  assertStrictEquals(spans.length, 0)
})
