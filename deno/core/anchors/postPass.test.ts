import { assert, assertEquals } from '@std/assert'
import { SnippetBase, __resetRenderStack } from '@/dsl/SnippetBase.ts'
import { Definition } from '@/dsl/Definition.ts'
import { File } from '@/dsl/File.ts'
import { Identifier } from '@/dsl/Identifier.ts'
import { toModelGeneratorKey, type GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import { postPass } from './postPass.ts'
import { tscAdapter } from './tscAdapter.ts'

const ctx = (): GenerateContextType =>
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

Deno.test('postPass - single Definition produces one anchor with landmark', () => {
  __resetRenderStack()
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName
  })
  const value = new FakeSnippet(c, () => "z.object({ id: z.string() })", key)
  const def = new Definition({
    context: c,
    identifier: Identifier.createVariable('User'),
    value
  })
  const file = new File({ path: 'out.ts', settings: undefined })
  file.definitions.set(def.identifier.name, def)

  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter
  })

  // At least one anchor landed inside the User landmark.
  const userIdx = sidecar.L.indexOf('User')
  assert(userIdx >= 0, 'User landmark must be pooled')
  const userRows = sidecar.A.filter(row => row[0] === userIdx)
  assert(userRows.length >= 1, 'expected anchors under the User landmark')

  // Parser id flows through.
  assert(sidecar.parser.startsWith('tsc@'))
})

Deno.test('postPass - anchor srcPtr matches the model key shape', () => {
  __resetRenderStack()
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'Customer' as RefName
  })
  const value = new FakeSnippet(c, () => "'inner'", key)
  const def = new Definition({
    context: c,
    identifier: Identifier.createVariable('Customer'),
    value
  })
  const file = new File({ path: 'out.ts', settings: undefined })
  file.definitions.set(def.identifier.name, def)

  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter
  })

  assert(sidecar.S.includes('oas:#/components/schemas/Customer'))
})

Deno.test('postPass - multiple Definitions land under their own landmarks', () => {
  __resetRenderStack()
  const c = ctx()
  const keyA = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'A' as RefName
  })
  const keyB = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'B' as RefName
  })
  const defA = new Definition({
    context: c,
    identifier: Identifier.createVariable('A'),
    value: new FakeSnippet(c, () => '1', keyA)
  })
  const defB = new Definition({
    context: c,
    identifier: Identifier.createVariable('B'),
    value: new FakeSnippet(c, () => '2', keyB)
  })
  const file = new File({ path: 'out.ts', settings: undefined })
  file.definitions.set('A', defA)
  file.definitions.set('B', defB)

  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter
  })

  // Both landmarks pooled, and at least one anchor under each.
  assertEquals(sidecar.L.sort(), ['A', 'B'])
  const aIdx = sidecar.L.indexOf('A')
  const bIdx = sidecar.L.indexOf('B')
  assert(sidecar.A.some(row => row[0] === aIdx))
  assert(sidecar.A.some(row => row[0] === bIdx))
})

Deno.test('postPass - generatorMeta lookup populates generator entries', () => {
  __resetRenderStack()
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'User' as RefName
  })
  const def = new Definition({
    context: c,
    identifier: Identifier.createVariable('User'),
    value: new FakeSnippet(c, () => "'x'", key)
  })
  const file = new File({ path: 'out.ts', settings: undefined })
  file.definitions.set('User', def)

  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter,
    generatorMeta: (genId) => ({
      version: genId === '@scope/gen-zod' ? '1.2.3' : '',
      registry: { host: 'jsr.skmtc.dev', kind: 'jsr-private' }
    })
  })

  assert(sidecar.G.some(g => g.name === '@scope/gen-zod' && g.version === '1.2.3'))
  assert(sidecar.R.some(r => r.host === 'jsr.skmtc.dev' && r.kind === 'jsr-private'))
})

Deno.test('postPass - anchor bytes survive a slice through file.toString()', () => {
  __resetRenderStack()
  const c = ctx()
  const key = toModelGeneratorKey({
    generatorId: '@scope/gen-zod',
    refName: 'Whole' as RefName
  })
  const value = new FakeSnippet(c, () => '"payload"', key)
  const def = new Definition({
    context: c,
    identifier: Identifier.createVariable('Whole'),
    value
  })
  const file = new File({ path: 'out.ts', settings: undefined })
  file.definitions.set('Whole', def)

  const text = file.toString()
  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter
  })

  // Every anchor's byte range slices to a non-empty substring of the
  // file. Stronger property than just "in bounds".
  for (const [, , , , , from, to] of sidecar.A) {
    assert(from >= 0)
    assert(to <= text.length)
    assert(to > from)
  }
})

Deno.test('postPass - empty file yields a sidecar with no anchors', () => {
  const file = new File({ path: 'empty.ts', settings: undefined })
  const sidecar = postPass({
    file,
    schemaSrc: 'openapi.json',
    parser: tscAdapter
  })
  assertEquals(sidecar.A, [])
  // Pools also empty — no metadata to record.
  assertEquals(sidecar.L, [])
  assertEquals(sidecar.G, [])
})
