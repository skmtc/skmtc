import { assertEquals } from '@std/assert'
import * as v from 'valibot'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { sidecarSchema, emptySidecar, type Sidecar } from './sidecar.ts'
import { buildSidecar, type ResolvedAnchor } from './buildSidecar.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

const ctx = (): GenerateContextType => ({}) as unknown as GenerateContextType

class TestProducer extends SnippetBase {
  constructor() {
    super({ context: ctx() })
  }
  override toString(): string {
    return ''
  }
}

const anchor = (overrides: Partial<ResolvedAnchor> = {}): ResolvedAnchor => ({
  span: { from: 0, to: 10, producer: new TestProducer() },
  attribution: {
    generatorId: '@scope/gen-ts',
    schemaPointer: 'oas:#/components/schemas/User',
    variant: 'main',
    definitionName: 'User',
    producerName: 'TestProducer'
  },
  landmark: 'User',
  path: [0],
  generatorVersion: '0.0.55',
  registry: { host: 'jsr.io', type: 'jsr' },
  ...overrides
})

Deno.test('emptySidecar - shape passes the valibot schema', () => {
  const empty = emptySidecar('out.ts', 'openapi.json', 'tsc@5.6.3')
  const parsed = v.parse(sidecarSchema, empty)
  assertEquals(parsed.v, 2)
  assertEquals(parsed.A.length, 0)
})

Deno.test('buildSidecar - single anchor populates all pools', () => {
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [anchor()]
  })

  assertEquals(sidecar.R.length, 1)
  assertEquals(sidecar.G.length, 1)
  assertEquals(sidecar.S, ['oas:#/components/schemas/User'])
  assertEquals(sidecar.V, ['main'])
  assertEquals(sidecar.L, ['User'])
  assertEquals(sidecar.P, ['0'])
  assertEquals(sidecar.A, [[0, 0, 0, 0, 0, 0, 10]])
  // Producer-name pool + parallel An index.
  assertEquals(sidecar.N, ['TestProducer'])
  assertEquals(sidecar.An, [0])
})

Deno.test('buildSidecar - repeat string values reuse pool indices', () => {
  const a1 = anchor({
    span: { from: 0, to: 5, producer: new TestProducer() },
    landmark: 'User',
    path: [0]
  })
  const a2 = anchor({
    span: { from: 6, to: 11, producer: new TestProducer() },
    landmark: 'User', // duplicate landmark → same pool index
    path: [0, 1] // distinct path → new pool index
  })
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [a1, a2]
  })

  assertEquals(sidecar.L, ['User']) // landmark only stored once
  assertEquals(sidecar.P, ['0', '0.1']) // two distinct paths
  // Both A rows reference Li=0; second references Pi=1.
  assertEquals(sidecar.A[0][0], 0)
  assertEquals(sidecar.A[1][0], 0)
  assertEquals(sidecar.A[0][1], 0)
  assertEquals(sidecar.A[1][1], 1)
})

Deno.test('buildSidecar - distinct registries pool independently and gi references ri', () => {
  const a1 = anchor({
    landmark: 'A',
    registry: { host: 'jsr.io', type: 'jsr' },
    attribution: {
      generatorId: '@public/gen',
      schemaPointer: 'oas:#/components/schemas/A',
      variant: 'main',
      definitionName: 'A',
      producerName: 'GenA'
    }
  })
  const a2 = anchor({
    landmark: 'B',
    registry: { host: 'jsr.skmtc.dev', type: 'jsr-private' },
    attribution: {
      generatorId: '@private/gen',
      schemaPointer: 'oas:#/components/schemas/B',
      variant: 'main',
      definitionName: 'B',
      producerName: 'GenB'
    }
  })

  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [a1, a2]
  })

  assertEquals(sidecar.R.length, 2)
  assertEquals(sidecar.G.length, 2)
  // First generator references registry 0; second references registry 1.
  assertEquals(sidecar.G[0].r, 0)
  assertEquals(sidecar.G[1].r, 1)
})

Deno.test('buildSidecar - same generator pooled once across many anchors', () => {
  const anchors = Array.from({ length: 5 }, (_, i) =>
    anchor({
      span: { from: i * 10, to: i * 10 + 5, producer: new TestProducer() },
      landmark: `L${i}`
    })
  )
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors
  })

  assertEquals(sidecar.G.length, 1) // same name+version+r → one entry
  assertEquals(sidecar.A.length, 5)
  // All A rows reference gi=0.
  for (const row of sidecar.A) assertEquals(row[2], 0)
})

Deno.test('buildSidecar - anchor with empty landmark is skipped', () => {
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [anchor({ landmark: '' })]
  })

  assertEquals(sidecar.A.length, 0)
  // Empty landmark → no pools polluted with stale state either.
  assertEquals(sidecar.L.length, 0)
})

Deno.test('buildSidecar - undefined srcPtr pools as empty string', () => {
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [
      anchor({
        attribution: {
          generatorId: '@scope/gen-utils',
          schemaPointer: '',
          variant: 'main',
          definitionName: undefined,
          producerName: 'GenUtils'
        }
      })
    ]
  })

  assertEquals(sidecar.S, [''])
  assertEquals(sidecar.A[0][3], 0)
})

Deno.test('buildSidecar - output round-trips through the valibot schema', () => {
  const built = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors: [anchor(), anchor({ landmark: 'Other', path: [1, 2] })]
  })

  // Parse → re-serialise → parse again gives identical structure.
  const parsed = v.parse(sidecarSchema, built)
  const reparsed: Sidecar = v.parse(sidecarSchema, JSON.parse(JSON.stringify(parsed)))
  assertEquals(reparsed, parsed)
})

Deno.test('sidecarSchema - rejects malformed input', () => {
  // Wrong `v` literal.
  const bad = { ...emptySidecar('x', 'y', 'z'), v: 1 }
  let threw = false
  try {
    v.parse(sidecarSchema, bad)
  } catch {
    threw = true
  }
  assertEquals(threw, true)
})

Deno.test('buildSidecar - A row order preserves anchor input order', () => {
  const positions = [
    { from: 100, to: 110 },
    { from: 10, to: 20 },
    { from: 50, to: 60 }
  ]
  const anchors = positions.map((p, i) =>
    anchor({
      span: { from: p.from, to: p.to, producer: new TestProducer() },
      landmark: `L${i}`
    })
  )
  const sidecar = buildSidecar({
    filePath: 'out.ts',
    schemaSrc: 'openapi.json',
    parser: 'tsc@5.6.3',
    anchors
  })

  // Even though offsets aren't sorted, builder preserves caller order.
  assertEquals(
    sidecar.A.map(row => row[5]),
    [100, 10, 50]
  )
})
