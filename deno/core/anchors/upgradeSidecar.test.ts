import { assertEquals } from '@std/assert'
import { upgradeSidecar } from './upgradeSidecar.ts'
import { oxcAdapter } from './oxcAdapter.ts'
import { emptySidecar, type Sidecar } from './sidecar.ts'

// A worker-built sidecar: Definition-name landmarks, empty paths,
// parser 'none' — the degraded mode every default CLI run produces.
const workerSidecar = (source: string, spans: [number, number][]): Sidecar => {
  const sidecar = emptySidecar('@/widgets/Widget.tsx', 'openapi.json', 'none')
  sidecar.L = ['WidgetDefinition']
  sidecar.P = ['']
  sidecar.G = [{ name: '@acme/gen-widget', version: '1.0.0', r: 0 }]
  sidecar.R = [{ host: 'jsr.io', type: 'jsr' }]
  sidecar.S = ['#/components/schemas/Widget']
  sidecar.V = ['main']
  sidecar.A = spans.map(([from, to]) => [0, 0, 0, 0, 0, from, to])
  sidecar.N = ['WidgetSnippet']
  sidecar.An = spans.map(() => 0)
  return sidecar
}

const source = [
  "import { helper } from './helper.ts'",
  'const columnHelper = helper()',
  'export const Widget = () => {',
  '  return <div>{columnHelper.render()}</div>',
  '}',
  ''
].join('\n')

Deno.test('upgradeSidecar - resolves real landmarks + paths and stamps the parser', () => {
  // Span 1: the whole `const columnHelper…` statement INCLUDING its
  // trailing newline (renderer-style span). Span 2: the
  // `{columnHelper.render()}` expression container inside Widget.
  const statementFrom = source.indexOf('const columnHelper')
  const statementTo = source.indexOf('export const Widget')
  const containerFrom = source.indexOf('{columnHelper.render()}')
  const containerTo = containerFrom + '{columnHelper.render()}'.length

  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [
      [statementFrom, statementTo],
      [containerFrom, containerTo]
    ]),
    source,
    parser: oxcAdapter
  })

  assertEquals(upgraded.parser, oxcAdapter.id)
  const [statementRow, containerRow] = upgraded.A
  // Whitespace-trimmed statement span resolves to the (non-exported)
  // top-level declaration itself: path is empty.
  assertEquals(upgraded.L[statementRow[0]], 'columnHelper')
  assertEquals(upgraded.P[statementRow[1]], '')
  // The inner span resolves under Widget with a non-empty descent path.
  assertEquals(upgraded.L[containerRow[0]], 'Widget')
  assertEquals(upgraded.P[containerRow[1]].length > 0, true)
  // Untouched pools + span bytes survive.
  assertEquals(upgraded.G, [
    {
      name: '@acme/gen-widget',
      version: '1.0.0',
      r: 0
    }
  ])
  assertEquals([statementRow[5], statementRow[6]], [statementFrom, statementTo])
})

Deno.test('upgradeSidecar - re-anchor round-trip lands on the same node', () => {
  const containerFrom = source.indexOf('{columnHelper.render()}')
  const containerTo = containerFrom + '{columnHelper.render()}'.length
  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [[containerFrom, containerTo]]),
    source,
    parser: oxcAdapter
  })
  const [row] = upgraded.A
  const landmarkName = upgraded.L[row[0]]
  const path = upgraded.P[row[1]] === '' ? [] : upgraded.P[row[1]].split('.').map(Number)

  const reparsed = oxcAdapter.parse('@/widgets/Widget.tsx', source)
  const landmark = oxcAdapter.collectLandmarks(reparsed).get(landmarkName)
  if (landmark === undefined) throw new Error('landmark not found on reparse')
  const node = oxcAdapter.descendPath(landmark, path)
  if (node === undefined) throw new Error('path did not descend')
  const span = oxcAdapter.spanOf(node)
  assertEquals(source.slice(span.start, span.end), '{columnHelper.render()}')
})

Deno.test('upgradeSidecar - keeps the worker landmark when no landmark encloses the span', () => {
  // A span over the import statement — imports are not landmarks, so
  // the ascent walks off the top of the tree.
  const importStatement = "import { helper } from './helper.ts'"
  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [[0, importStatement.length]]),
    source,
    parser: oxcAdapter
  })
  const [row] = upgraded.A
  assertEquals(upgraded.L[row[0]], 'WidgetDefinition')
  assertEquals(upgraded.P[row[1]], '')
  assertEquals(upgraded.parser, oxcAdapter.id)
})

Deno.test('upgradeSidecar - empty anchor table returns the sidecar unchanged', () => {
  const sidecar = workerSidecar(source, [])
  const upgraded = upgradeSidecar({ sidecar, source, parser: oxcAdapter })
  assertEquals(upgraded, sidecar)
  assertEquals(upgraded.parser, 'none')
})

Deno.test('upgradeSidecar - non-ASCII source is left unchanged (unit skew)', () => {
  const unicodeSource = `const label = 'héllo'\n${source}`
  const sidecar = workerSidecar(unicodeSource, [[0, 21]])
  const upgraded = upgradeSidecar({
    sidecar,
    source: unicodeSource,
    parser: oxcAdapter
  })
  assertEquals(upgraded, sidecar)
  assertEquals(upgraded.parser, 'none')
})

// --- reanchorSidecar: realign spans to the formatted on-disk text -----------

import { reanchorSidecar } from './upgradeSidecar.ts'

// What a consumer formatter makes of `source`: quote flips, semicolons,
// JSX reflow — every raw byte span is invalidated.
const formattedSource = [
  'import { helper } from "./helper.ts";',
  'const columnHelper = helper();',
  'export const Widget = () => {',
  '  return (',
  '    <div>',
  '      {columnHelper.render()}',
  '    </div>',
  '  );',
  '};',
  ''
].join('\n')

Deno.test('reanchorSidecar - realigns spans onto the formatted text', () => {
  const statementFrom = source.indexOf('const columnHelper')
  const statementTo = source.indexOf('export const Widget')
  const containerFrom = source.indexOf('{columnHelper.render()}')
  const containerTo = containerFrom + '{columnHelper.render()}'.length

  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [
      [statementFrom, statementTo],
      [containerFrom, containerTo]
    ]),
    source,
    parser: oxcAdapter
  })
  const realigned = reanchorSidecar({
    sidecar: upgraded,
    source: formattedSource,
    parser: oxcAdapter
  })
  if (realigned === undefined) throw new Error('expected realignment')

  const [statementRow, containerRow] = realigned.A
  const sliceOf = (row: number[]): string => formattedSource.slice(row[5], row[6])
  assertEquals(sliceOf(statementRow), 'const columnHelper = helper();')
  assertEquals(sliceOf(containerRow), '{columnHelper.render()}')
  // Pools + parser stamp carry over untouched.
  assertEquals(realigned.parser, oxcAdapter.id)
  assertEquals(realigned.An?.length, realigned.A.length)
})

Deno.test('reanchorSidecar - drops unresolvable rows, keeping An parallel', () => {
  const containerFrom = source.indexOf('{columnHelper.render()}')
  const containerTo = containerFrom + '{columnHelper.render()}'.length
  // Row 1: an import-statement span — upgrade keeps the worker landmark
  // 'WidgetDefinition' (no real landmark encloses it), which resolves to
  // nothing in the formatted parse → dropped. Row 2 realigns.
  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [
      [0, "import { helper } from './helper.ts'".length],
      [containerFrom, containerTo]
    ]),
    source,
    parser: oxcAdapter
  })
  const realigned = reanchorSidecar({
    sidecar: upgraded,
    source: formattedSource,
    parser: oxcAdapter
  })
  if (realigned === undefined) throw new Error('expected realignment')
  assertEquals(realigned.A.length, 1)
  assertEquals(realigned.An?.length, 1)
  assertEquals(
    formattedSource.slice(realigned.A[0][5], realigned.A[0][6]),
    '{columnHelper.render()}'
  )
})

Deno.test('reanchorSidecar - refuses non-ASCII formatted text', () => {
  const containerFrom = source.indexOf('{columnHelper.render()}')
  const upgraded = upgradeSidecar({
    sidecar: workerSidecar(source, [[containerFrom, containerFrom + 5]]),
    source,
    parser: oxcAdapter
  })
  const realigned = reanchorSidecar({
    sidecar: upgraded,
    source: `// héllo\n${formattedSource}`,
    parser: oxcAdapter
  })
  assertEquals(realigned, undefined)
})
