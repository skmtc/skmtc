import { assert, assertEquals, assertThrows } from '@std/assert'
import type { Sidecar } from './sidecar.ts'
import { entriesForSidecar, parseNdjson, toNdjson } from './rollup.ts'

const baseSidecar = (overrides: Partial<Sidecar> = {}): Sidecar => ({
  v: 2,
  f: 'src/types/User.generated.ts',
  src: 'openapi.json',
  parser: 'tsc@5.6.3',
  R: [{ host: 'jsr.io', kind: 'jsr' }],
  G: [{ name: '@skmtc/gen-typescript', version: '0.0.55', r: 0 }],
  S: ['oas:#/components/schemas/User'],
  V: ['main'],
  L: ['User'],
  P: [''],
  A: [[0, 0, 0, 0, 0, 0, 100]],
  ...overrides
})

Deno.test('entriesForSidecar - one entry per landmark from a single-Definition sidecar', () => {
  const entries = entriesForSidecar(baseSidecar())
  assertEquals(entries.length, 1)
  assertEquals(entries[0], {
    f: 'src/types/User.generated.ts',
    name: 'User',
    g: '@skmtc/gen-typescript',
    s: 'oas:#/components/schemas/User',
    v: 'main'
  })
})

Deno.test('entriesForSidecar - inner Snippet anchors do not produce extra rollup rows', () => {
  // Two anchors for the same landmark: an outermost (path '') row and
  // a nested Snippet anchor (path '0'). The rollup should still emit
  // one row.
  const sc = baseSidecar({
    P: ['', '0'],
    A: [
      [0, 0, 0, 0, 0, 0, 100], // landmark itself
      [0, 1, 0, 0, 0, 10, 50] // nested Snippet
    ]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(entries.length, 1)
  assertEquals(entries[0].name, 'User')
})

Deno.test('entriesForSidecar - multi-landmark file emits one row per Definition', () => {
  const sc = baseSidecar({
    L: ['A', 'B', 'C'],
    P: [''],
    S: ['oas:#/components/schemas/A', 'oas:#/components/schemas/B', 'oas:#/components/schemas/C'],
    A: [
      [0, 0, 0, 0, 0, 0, 10],
      [1, 0, 0, 1, 0, 11, 30],
      [2, 0, 0, 2, 0, 31, 50]
    ]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(
    entries.map(e => e.name),
    ['A', 'B', 'C']
  )
  assertEquals(entries[0].s, 'oas:#/components/schemas/A')
  assertEquals(entries[2].s, 'oas:#/components/schemas/C')
})

Deno.test('entriesForSidecar - falls back to first anchor when no path-empty row exists', () => {
  // Pathological: only a nested-path anchor for landmark, no outermost.
  const sc = baseSidecar({
    P: ['0'],
    A: [[0, 0, 0, 0, 0, 5, 25]]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(entries.length, 1)
  assertEquals(entries[0].name, 'User')
})

Deno.test('entriesForSidecar - prefers path-empty row even when nested row appears first', () => {
  const sc = baseSidecar({
    P: ['0', ''],
    A: [
      [0, 0, 0, 0, 0, 10, 50], // nested first
      [0, 1, 0, 0, 0, 0, 100] // outermost second
    ]
  })
  const entries = entriesForSidecar(sc)
  // The function picks the outermost (path-empty) row; the nested row
  // doesn't produce a second entry.
  assertEquals(entries.length, 1)
})

Deno.test('entriesForSidecar - empty sidecar yields no entries', () => {
  const sc = baseSidecar({ L: [], P: [], A: [] })
  assertEquals(entriesForSidecar(sc), [])
})

Deno.test('toNdjson - emits one JSON object per line with trailing newline', () => {
  const text = toNdjson([
    { f: 'a.ts', name: 'A', g: 'gen', s: 'oas:#/components/schemas/A', v: 'main' },
    { f: 'b.ts', name: 'B', g: 'gen', s: 'oas:#/components/schemas/B', v: 'main' }
  ])
  const lines = text.split('\n')
  assertEquals(lines.length, 3) // two rows + one empty trailing line
  assertEquals(lines[2], '')
  assertEquals(JSON.parse(lines[0]).name, 'A')
  assertEquals(JSON.parse(lines[1]).name, 'B')
})

Deno.test('toNdjson - empty input yields empty string (no trailing newline)', () => {
  assertEquals(toNdjson([]), '')
})

Deno.test('parseNdjson - round-trips through toNdjson', () => {
  const entries = [
    { f: 'a.ts', name: 'A', g: 'gen-1', s: 'oas:#/components/schemas/A', v: 'main' },
    { f: 'b.ts', name: 'B', g: 'gen-2', s: '', v: 'customer' }
  ]
  const round = parseNdjson(toNdjson(entries))
  assertEquals(round, entries)
})

Deno.test('parseNdjson - rejects malformed lines via valibot', () => {
  // Missing required `name` field.
  const bad = '{"f":"a.ts","g":"gen","s":"","v":"main"}\n'
  assertThrows(() => parseNdjson(bad))
})

Deno.test('parseNdjson - empty input yields empty array', () => {
  assertEquals(parseNdjson(''), [])
})

Deno.test('entriesForSidecar - variant from V pool flows through', () => {
  const sc = baseSidecar({
    V: ['main', 'customer'],
    L: ['Form'],
    A: [[0, 0, 0, 0, 1, 0, 50]]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(entries[0].v, 'customer')
})

Deno.test('entriesForSidecar - generator pooled by index, reflected in rollup', () => {
  const sc = baseSidecar({
    G: [
      { name: '@scope/gen-zod', version: '1.0.0', r: 0 },
      { name: '@scope/gen-typescript', version: '0.0.55', r: 0 }
    ],
    L: ['A', 'B'],
    A: [
      [0, 0, 0, 0, 0, 0, 50],
      [1, 0, 1, 0, 0, 51, 100]
    ]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(entries[0].g, '@scope/gen-zod')
  assertEquals(entries[1].g, '@scope/gen-typescript')
})

Deno.test('entriesForSidecar - missing generator entry yields empty g string', () => {
  // Defensive: anchor references a gi that's out of bounds. Should
  // not throw — generator data degraded gracefully.
  const sc = baseSidecar({
    G: [],
    A: [[0, 0, 99, 0, 0, 0, 100]]
  })
  const entries = entriesForSidecar(sc)
  assertEquals(entries[0].g, '')
})

Deno.test('parseNdjson - tolerates extra blank lines between entries', () => {
  const text = '{"f":"a.ts","name":"A","g":"g","s":"","v":"main"}\n\n{"f":"b.ts","name":"B","g":"g","s":"","v":"main"}\n'
  const entries = parseNdjson(text)
  assertEquals(entries.length, 2)
  assert(entries[0].name === 'A' && entries[1].name === 'B')
})
