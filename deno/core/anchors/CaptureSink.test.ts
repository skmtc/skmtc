import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { Definition } from '@/dsl/Definition.ts'
import { File } from '@/dsl/File.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { CaptureSink, installCapture } from './CaptureSink.ts'
import type { Span } from './types.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

// SnippetBase holds no capture state; a bare context stub suffices.
const stubContext = (): GenerateContextType => ({}) as unknown as GenerateContextType

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

/**
 * Render a File through a fresh sink with the prototype wrap installed
 * for the duration — the production capture path in miniature.
 */
const capture = (file: File): { text: string; spans: Span[] } => {
  const sink = new CaptureSink()
  const restore = installCapture(sink)
  try {
    return sink.captureFile(() => file.toString())
  } finally {
    restore()
  }
}

Deno.test('CaptureSink - top-level Definition spans match file slice', () => {
  const ctx = stubContext()
  const value = new FakeSnippet(ctx, () => "'hello'")
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('GREETING'),
    value
  })
  const { text, spans } = capture(makeFile([def]))

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
  const ctx = stubContext()
  const a = new FakeSnippet(ctx, () => 'x')
  const b = new FakeSnippet(ctx, () => 'x')
  const value = new FakeSnippet(ctx, () => `${a}_${b}`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('PAIR'),
    value
  })
  const { text, spans } = capture(makeFile([def]))

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
  const ctx = stubContext()
  // Child renders one thing, but the parent reshapes it so the
  // original text isn't present in the parent's output.
  const child = new FakeSnippet(ctx, () => 'lowercase')
  const value = new FakeSnippet(ctx, () => {
    // Render the child (captured as an occurrence), then emit different text.
    const _ = child.toString()
    return 'UPPERCASE'
  })
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('CASED'),
    value
  })
  const { spans } = capture(makeFile([def]))

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
  const ctx = stubContext()
  const empty = new FakeSnippet(ctx, () => '')
  const value = new FakeSnippet(ctx, () => `before${empty}after`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('EMPTY'),
    value
  })
  const { spans } = capture(makeFile([def]))

  assertEquals(
    spans.some(s => s.producer === empty),
    false
  )
})

Deno.test('CaptureSink - multiple Definitions appear in document order', () => {
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
  const { spans } = capture(makeFile([first, second]))

  const firstSpan = spans.find(s => s.producer === first)
  const secondSpan = spans.find(s => s.producer === second)
  assertEquals(firstSpan !== undefined, true)
  assertEquals(secondSpan !== undefined, true)
  assertEquals(firstSpan!.from < secondSpan!.from, true)
})

Deno.test('CaptureSink - property: every span.slice equals producer output', () => {
  const ctx = stubContext()
  const inner = new FakeSnippet(ctx, () => 'inner')
  const middle = new FakeSnippet(ctx, () => `<${inner}/>`)
  const outer = new FakeSnippet(ctx, () => `[ ${middle} ]`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('NESTED'),
    value: outer
  })
  const { text, spans } = capture(makeFile([def]))

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

Deno.test('CaptureSink - returns empty spans when File has no Definitions', () => {
  const file = new File({ path: 'empty.ts', settings: undefined })
  const { spans } = capture(file)
  assertStrictEquals(spans.length, 0)
})

Deno.test('CaptureSink - cycle detection throws rather than infinite-recurse', () => {
  const ctx = stubContext()
  // A snippet whose body re-renders itself — a composition cycle.
  let self: FakeSnippet
  // deno-lint-ignore prefer-const
  self = new FakeSnippet(ctx, () => `wrap(${self})`)
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('CYCLE'),
    value: self
  })

  assertThrows(() => capture(makeFile([def])), Error, 'render cycle')
})

Deno.test('CaptureSink - prototypes restored after capture (pure passthrough)', () => {
  const ctx = stubContext()
  let calls = 0
  const s = new FakeSnippet(ctx, () => {
    calls++
    return 'v'
  })
  const def = new Definition({
    context: ctx,
    identifier: Identifier.createVariable('PURE'),
    value: s
  })
  capture(makeFile([def]))
  const callsAfterCapture = calls

  // After restore, `toString` is the plain subclass method: no wrapper,
  // no caching, called once per coercion.
  assertEquals(`${s}`, 'v')
  assertEquals(`${s}`, 'v')
  assertEquals(calls, callsAfterCapture + 2)
})
