import { assertEquals } from '@std/assert'
import {
  collectExports,
  diffApiSurface,
  isApiSurface,
  normalizeDeclaration,
  toMinor
} from './api-surface.ts'

Deno.test('normalizeDeclaration drops positions and doc comments and sorts keys', () => {
  const declaration = {
    kind: 'function',
    location: { filename: 'a.ts', line: 1, col: 0 },
    jsDoc: { doc: 'comment' },
    def: {
      params: [{ name: 'args', tsType: { repr: 'Args' }, location: { line: 2 } }],
      returnType: { repr: 'string' }
    }
  }

  const expected = {
    def: {
      params: [{ name: 'args', tsType: { repr: 'Args' } }],
      returnType: { repr: 'string' }
    },
    kind: 'function'
  }

  assertEquals(JSON.stringify(normalizeDeclaration(declaration)), JSON.stringify(expected))
})

Deno.test('normalizeDeclaration is stable under key order and comment edits', () => {
  const first = { kind: 'class', def: { name: 'A' }, jsDoc: { doc: 'one' } }
  const second = { jsDoc: { doc: 'two' }, def: { name: 'A' }, kind: 'class' }

  assertEquals(
    JSON.stringify(normalizeDeclaration(first)),
    JSON.stringify(normalizeDeclaration(second))
  )
})

// The current `deno doc --json` shape (deno 2.9): a `nodes` record keyed by
// module URL, each holding `symbols` with per-symbol `declarations`. A
// shape change here is the one thing that can empty the digest silently.
const denoDocFixture = {
  version: 1,
  nodes: {
    'file:///pkg/mod.ts': {
      module_doc: { tags: [] },
      symbols: [
        {
          name: 'toThing',
          declarations: [
            {
              location: { filename: 'file:///pkg/src/toThing.ts', line: 3, col: 0 },
              declarationKind: 'export',
              kind: 'function',
              def: { params: [], returnType: { repr: 'Thing', kind: 'typeRef' } }
            }
          ]
        },
        {
          name: 'Thing',
          declarations: [
            {
              location: { filename: 'file:///pkg/src/Thing.ts', line: 1, col: 0 },
              declarationKind: 'export',
              kind: 'interface',
              def: { properties: [{ name: 'id', tsType: { repr: 'string' } }] }
            },
            {
              location: { filename: 'file:///pkg/src/Thing.ts', line: 9, col: 0 },
              declarationKind: 'export',
              kind: 'variable',
              def: { tsType: { repr: 'Thing' }, kind: 'const' }
            }
          ]
        },
        {
          name: 'hidden',
          declarations: [
            {
              location: { filename: 'file:///pkg/src/hidden.ts', line: 1, col: 0 },
              declarationKind: 'private',
              kind: 'function',
              def: { params: [] }
            }
          ]
        },
        {
          name: 'reexported',
          declarations: [
            {
              location: { filename: 'file:///pkg/mod.ts', line: 1, col: 0 },
              declarationKind: 'export',
              kind: 'import',
              def: { src: 'file:///other/mod.ts', imported: 'reexported' }
            }
          ]
        }
      ]
    }
  }
}

Deno.test('collectExports keeps exported declarations by name and drops private and import ones', () => {
  const exports = collectExports(denoDocFixture)

  assertEquals([...exports.keys()].sort(), ['Thing', 'toThing'])
  assertEquals(
    exports.get('Thing')?.map(declaration => declaration.kind),
    ['interface', 'variable']
  )
  assertEquals(exports.get('toThing')?.length, 1)
})

Deno.test('collectExports finds symbols wherever the module-level shape puts them', () => {
  const nested = { anything: [{ deeper: denoDocFixture.nodes }] }

  assertEquals([...collectExports(nested).keys()].sort(), ['Thing', 'toThing'])
  assertEquals(collectExports({ version: 1, nodes: {} }).size, 0)
})

Deno.test('diffApiSurface names added, removed and re-shaped exports', () => {
  const recorded = { keep: '1', drop: '2', reshape: '3' }
  const current = { keep: '1', reshape: '4', add: '5' }

  assertEquals(diffApiSurface(recorded, current), {
    added: ['add'],
    removed: ['drop'],
    changed: ['reshape']
  })
})

Deno.test('isApiSurface accepts a well-formed record entry and rejects a damaged one', () => {
  const good = { minor: '0.28', deno: '2.9.5', exports: { A: 'abc' }, unresolved: [] }

  assertEquals(isApiSurface(good), true)
  assertEquals(isApiSurface({ minor: '0.28', deno: '2.9.5' }), false)
  assertEquals(isApiSurface({ ...good, exports: { A: 1 } }), false)
  assertEquals(isApiSurface({ ...good, unresolved: 'toThing' }), false)
  assertEquals(isApiSurface(null), false)
})

Deno.test('toMinor keeps major and minor only', () => {
  assertEquals(toMinor('0.28.6'), '0.28')
  assertEquals(toMinor('1.2.3'), '1.2')
})
