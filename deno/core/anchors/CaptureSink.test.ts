import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { CaptureSink, type CaptureChannel } from './CaptureSink.ts'
import type { Span } from './types.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

// Snippets read the sink through `this.context.captureSink`, so the test
// context exposes the shared channel the way `GenerateContext` does — a
// getter over the mutable channel slot.
const makeCaptureContext = (): { context: GenerateContextType; channel: CaptureChannel } => {
  const channel: CaptureChannel = { sink: undefined }
  const context = {
    get captureSink() {
      return channel.sink
    }
  } as unknown as GenerateContextType
  return { context, channel }
}

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

const makeFile = (defs: MockDefinition[]): MockFile => {
  const file = new MockFile({ path: 'out.ts' })
  for (const def of defs) {
    file.definitions.set(def.identifier.name, def)
  }
  return file
}

/**
 * Render a file through a fresh sink with the capture interval open for
 * the duration — the production capture path in miniature: publish the
 * sink on the shared channel, render, clear in `finally`.
 */
const capture = (channel: CaptureChannel, file: MockFile): { text: string; spans: Span[] } => {
  const sink = new CaptureSink()
  channel.sink = sink
  try {
    return sink.captureFile(() => file.toString())
  } finally {
    channel.sink = undefined
  }
}

Deno.test('CaptureSink - top-level Definition spans match file slice', () => {
  const { context: ctx, channel } = makeCaptureContext()
  const value = new FakeSnippet(ctx, () => "'hello'")
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'GREETING' }),
    value
  })
  const { text, spans } = capture(channel, makeFile([def]))

  // Definition span = the whole rendered Definition text.
  const defSpan = spans.find(s => s.producer === def)
  assertEquals(defSpan !== undefined, true)
  assertEquals(text.slice(defSpan!.from, defSpan!.to), def.toString())

  // Child (the `value`) span lands strictly inside the Definition.
  const valueSpan = spans.find(s => s.producer === value)
  assertEquals(valueSpan !== undefined, true)
  assertEquals(text.slice(valueSpan!.from, valueSpan!.to), "'hello'")
  assertEquals(valueSpan!.from >= defSpan!.from, true)
  assertEquals(valueSpan!.to <= defSpan!.to, true)
})

Deno.test('CaptureSink - identical sibling text attributed in document order', () => {
  const { context: ctx, channel } = makeCaptureContext()
  const a = new FakeSnippet(ctx, () => 'x')
  const b = new FakeSnippet(ctx, () => 'x')
  const value = new FakeSnippet(ctx, () => `${a}_${b}`)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'PAIR' }),
    value
  })
  const { text, spans } = capture(channel, makeFile([def]))

  const aSpan = spans.find(s => s.producer === a)
  const bSpan = spans.find(s => s.producer === b)
  assertEquals(aSpan !== undefined, true)
  assertEquals(bSpan !== undefined, true)
  assertEquals(text.slice(aSpan!.from, aSpan!.to), 'x')
  assertEquals(text.slice(bSpan!.from, bSpan!.to), 'x')
  // Document order: a's offset comes before b's.
  assertEquals(aSpan!.from < bSpan!.from, true)
})

Deno.test('CaptureSink - child whose text is not in parent is skipped', () => {
  const { context: ctx, channel } = makeCaptureContext()
  // Child renders one thing, but the parent reshapes it so the
  // original text isn't present in the parent's output.
  const child = new FakeSnippet(ctx, () => 'lowercase')
  const value = new FakeSnippet(ctx, () => {
    // Render the child (captured as an occurrence), then emit different text.
    const _ = child.toString()
    return 'UPPERCASE'
  })
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'CASED' }),
    value
  })
  const { spans } = capture(channel, makeFile([def]))

  // Parent and child both rendered, but only the parent's span survives.
  assertEquals(
    spans.some(s => s.producer === value),
    true
  )
  assertEquals(
    spans.some(s => s.producer === child),
    false
  )
})

Deno.test('CaptureSink - zero-length child is filtered out', () => {
  const { context: ctx, channel } = makeCaptureContext()
  const empty = new FakeSnippet(ctx, () => '')
  const value = new FakeSnippet(ctx, () => `before${empty}after`)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'EMPTY' }),
    value
  })
  const { spans } = capture(channel, makeFile([def]))

  assertEquals(
    spans.some(s => s.producer === empty),
    false
  )
})

Deno.test('CaptureSink - multiple Definitions appear in document order', () => {
  const { context: ctx, channel } = makeCaptureContext()
  const first = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'FIRST' }),
    value: new FakeSnippet(ctx, () => '1')
  })
  const second = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'SECOND' }),
    value: new FakeSnippet(ctx, () => '2')
  })
  const { spans } = capture(channel, makeFile([first, second]))

  const firstSpan = spans.find(s => s.producer === first)
  const secondSpan = spans.find(s => s.producer === second)
  assertEquals(firstSpan !== undefined, true)
  assertEquals(secondSpan !== undefined, true)
  assertEquals(firstSpan!.from < secondSpan!.from, true)
})

Deno.test('CaptureSink - property: every span.slice equals producer output', () => {
  const { context: ctx, channel } = makeCaptureContext()
  const inner = new FakeSnippet(ctx, () => 'inner')
  const middle = new FakeSnippet(ctx, () => `<${inner}/>`)
  const outer = new FakeSnippet(ctx, () => `[ ${middle} ]`)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'NESTED' }),
    value: outer
  })
  const { text, spans } = capture(channel, makeFile([def]))

  for (const span of spans) {
    // Fixtures are deterministic, so re-rendering the producer yields the
    // same text the sink captured.
    assertEquals(
      text.slice(span.from, span.to),
      span.producer.toString(),
      `Span for ${span.producer.constructor.name} should match its rendered text`
    )
  }
})

Deno.test('CaptureSink - returns empty spans when the file has no Definitions', () => {
  const { channel } = makeCaptureContext()
  const file = new MockFile({ path: 'empty.ts' })
  const { spans } = capture(channel, file)
  assertStrictEquals(spans.length, 0)
})

Deno.test('CaptureSink - cycle detection throws rather than infinite-recurse', () => {
  const { context: ctx, channel } = makeCaptureContext()
  // A snippet whose body re-renders itself — a composition cycle.
  const self: FakeSnippet = new FakeSnippet(ctx, () => `wrap(${self})`)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'CYCLE' }),
    value: self
  })

  assertThrows(() => capture(channel, makeFile([def])), Error, 'render cycle')
})

Deno.test('CaptureSink - pure pass-through after the capture interval closes', () => {
  const { context: ctx, channel } = makeCaptureContext()
  let calls = 0
  const s = new FakeSnippet(ctx, () => {
    calls++
    return 'v'
  })
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'PURE' }),
    value: s
  })
  capture(channel, makeFile([def]))
  const callsAfterCapture = calls

  // With the interval closed, the wrapper passes straight through to the
  // subclass method: no caching, called once per coercion.
  assertEquals(`${s}`, 'v')
  assertEquals(`${s}`, 'v')
  assertEquals(calls, callsAfterCapture + 2)
})

Deno.test('CaptureSink - keyless snippet constructed mid-render is captured', () => {
  // The old registry-based capture missed snippets constructed DURING the
  // capture render (the installer had already iterated). Self-wrapping at
  // construction closes that gap: a keyless snippet born inside another
  // snippet's toString still gets its own span.
  const { context: ctx, channel } = makeCaptureContext()
  const value = new FakeSnippet(ctx, () => `pre ${new FakeSnippet(ctx, () => 'midborn')} post`)
  const def = new MockDefinition({
    context: ctx,
    identifier: new IdentifierBase({ name: 'MID' }),
    value
  })
  const { text, spans } = capture(channel, makeFile([def]))

  const midSpan = spans.find(s => text.slice(s.from, s.to) === 'midborn')
  assertEquals(midSpan !== undefined, true)
  assertEquals(midSpan!.producer.generatorKey, undefined)
})
