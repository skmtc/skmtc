import { assert, assertEquals } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { TsDefinition, createVariable } from '@skmtc/lang-typescript'
import { TsFile } from '@skmtc/lang-typescript'
import { toModelGeneratorKey, type GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import { postPass } from './postPass.ts'
import { CaptureSink, type CaptureChannel } from './CaptureSink.ts'
import type { Span } from './types.ts'
import { oxcAdapter } from './oxcAdapter.ts'

// Snippets read the sink through `this.context.captureSink`; the stub
// exposes a per-test shared channel the way `GenerateContext` does.
const channel: CaptureChannel = { sink: undefined }
const ctx = (): GenerateContextType =>
  ({
    get captureSink() {
      return channel.sink
    }
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

/**
 * Render a file through a sink with the capture interval open for the
 * duration and return the inputs `postPass` expects: the file path, the
 * rendered source, and the resolved spans.
 */
const renderFile = (file: TsFile): { filePath: string; source: string; spans: Span[] } => {
  const sink = new CaptureSink()
  channel.sink = sink
  try {
    const { text, spans } = sink.captureFile(() => file.toString())
    return { filePath: file.path, source: text, spans }
  } finally {
    channel.sink = undefined
  }
}

Deno.test('postPass - single Definition produces one anchor with landmark', () => {
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName,
    variant: 'main'
  })
  const value = new FakeSnippet(c, () => 'z.object({ id: z.string() })', key)
  const def = new TsDefinition({
    context: c,
    identifier: createVariable('User'),
    value
  })
  const file = new TsFile({ path: 'out.ts', settings: undefined })
  file.definitions.set(def.identifier.name, def)

  const sidecar = postPass({
    ...renderFile(file),
    schemaSrc: 'openapi.json',
    parser: oxcAdapter
  })

  // At least one anchor landed inside the User landmark.
  const userIdx = sidecar.L.indexOf('User')
  assert(userIdx >= 0, 'User landmark must be pooled')
  const userRows = sidecar.A.filter(row => row[0] === userIdx)
  assert(userRows.length >= 1, 'expected anchors under the User landmark')

  // Parser id flows through.
  assert(sidecar.parser.startsWith('oxc@'))
})

Deno.test('postPass - anchor srcPtr matches the model key shape', () => {
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'Customer' as RefName,
    variant: 'main'
  })
  const value = new FakeSnippet(c, () => "'inner'", key)
  const def = new TsDefinition({
    context: c,
    identifier: createVariable('Customer'),
    value
  })
  const file = new TsFile({ path: 'out.ts', settings: undefined })
  file.definitions.set(def.identifier.name, def)

  const sidecar = postPass({
    ...renderFile(file),
    schemaSrc: 'openapi.json',
    parser: oxcAdapter
  })

  assert(sidecar.S.includes('#/components/schemas/Customer'))
})

Deno.test('postPass - multiple Definitions land under their own landmarks', () => {
  const c = ctx()
  const keyA = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'A' as RefName,
    variant: 'main'
  })
  const keyB = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'B' as RefName,
    variant: 'main'
  })
  const defA = new TsDefinition({
    context: c,
    identifier: createVariable('A'),
    value: new FakeSnippet(c, () => '1', keyA)
  })
  const defB = new TsDefinition({
    context: c,
    identifier: createVariable('B'),
    value: new FakeSnippet(c, () => '2', keyB)
  })
  const file = new TsFile({ path: 'out.ts', settings: undefined })
  file.definitions.set('A', defA)
  file.definitions.set('B', defB)

  const sidecar = postPass({
    ...renderFile(file),
    schemaSrc: 'openapi.json',
    parser: oxcAdapter
  })

  // Both landmarks pooled, and at least one anchor under each.
  assertEquals(sidecar.L.sort(), ['A', 'B'])
  const aIdx = sidecar.L.indexOf('A')
  const bIdx = sidecar.L.indexOf('B')
  assert(sidecar.A.some(row => row[0] === aIdx))
  assert(sidecar.A.some(row => row[0] === bIdx))
})

Deno.test('postPass - generatorMeta lookup populates generator entries', () => {
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName,
    variant: 'main'
  })
  const def = new TsDefinition({
    context: c,
    identifier: createVariable('User'),
    value: new FakeSnippet(c, () => "'x'", key)
  })
  const file = new TsFile({ path: 'out.ts', settings: undefined })
  file.definitions.set('User', def)

  const sidecar = postPass({
    ...renderFile(file),
    schemaSrc: 'openapi.json',
    parser: oxcAdapter,
    generatorMeta: generatorId => ({
      version: generatorId === '@scope/gen-zod' ? '1.2.3' : '',
      registry: { host: 'jsr.skmtc.dev', type: 'jsr-private' }
    })
  })

  assert(sidecar.G.some(g => g.name === '@scope/gen-zod' && g.version === '1.2.3'))
  assert(sidecar.R.some(r => r.host === 'jsr.skmtc.dev' && r.type === 'jsr-private'))
})

Deno.test('postPass - anchor bytes survive a slice through the rendered source', () => {
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'Whole' as RefName,
    variant: 'main'
  })
  const value = new FakeSnippet(c, () => '"payload"', key)
  const def = new TsDefinition({
    context: c,
    identifier: createVariable('Whole'),
    value
  })
  const file = new TsFile({ path: 'out.ts', settings: undefined })
  file.definitions.set('Whole', def)

  const rendered = renderFile(file)
  const sidecar = postPass({
    ...rendered,
    schemaSrc: 'openapi.json',
    parser: oxcAdapter
  })

  // Every anchor's byte range slices to a non-empty substring of the
  // file. Stronger property than just "in bounds".
  for (const [, , , , , from, to] of sidecar.A) {
    assert(from >= 0)
    assert(to <= rendered.source.length)
    assert(to > from)
  }
})

Deno.test('postPass - empty file yields a sidecar with no anchors', () => {
  const file = new TsFile({ path: 'empty.ts', settings: undefined })
  const sidecar = postPass({
    ...renderFile(file),
    schemaSrc: 'openapi.json',
    parser: oxcAdapter
  })
  assertEquals(sidecar.A, [])
  // Pools also empty — no metadata to record.
  assertEquals(sidecar.L, [])
  assertEquals(sidecar.G, [])
})
