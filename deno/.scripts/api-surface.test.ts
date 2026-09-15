import { assertEquals } from '@std/assert'
import { diffApiSurface, normalizeDeclaration, toMinor } from './api-surface.ts'

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

  assertEquals(JSON.stringify(normalizeDeclaration(declaration)), JSON.stringify({
    def: {
      params: [{ name: 'args', tsType: { repr: 'Args' } }],
      returnType: { repr: 'string' }
    },
    kind: 'function'
  }))
})

Deno.test('normalizeDeclaration is stable under key order and comment edits', () => {
  const first = { kind: 'class', def: { name: 'A' }, jsDoc: { doc: 'one' } }
  const second = { jsDoc: { doc: 'two' }, def: { name: 'A' }, kind: 'class' }

  assertEquals(
    JSON.stringify(normalizeDeclaration(first)),
    JSON.stringify(normalizeDeclaration(second))
  )
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

Deno.test('toMinor keeps major and minor only', () => {
  assertEquals(toMinor('0.28.6'), '0.28')
  assertEquals(toMinor('1.2.3'), '1.2')
})
