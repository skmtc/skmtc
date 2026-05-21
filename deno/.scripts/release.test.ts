import { assertEquals, assertThrows } from '@std/assert'
import { toReleaseOrder, toWorkspaceDep, type WorkspacePackage } from './release.ts'

Deno.test('toWorkspaceDep - extracts a workspace package from a jsr: import', () => {
  const names = new Set(['@skmtc/core', '@skmtc/worker'])
  assertEquals(toWorkspaceDep('jsr:@skmtc/core@0.6.3', names), '@skmtc/core')
  // The `/types` sub-path entry still resolves to its package.
  assertEquals(toWorkspaceDep('jsr:@skmtc/worker@0.3.2/types', names), '@skmtc/worker')
})

Deno.test('toWorkspaceDep - returns null for non-workspace and non-jsr imports', () => {
  const names = new Set(['@skmtc/core'])
  assertEquals(toWorkspaceDep('jsr:@std/path@^1', names), null) // not a workspace package
  assertEquals(toWorkspaceDep('npm:valibot@1.1.0', names), null) // not a jsr: specifier
  assertEquals(toWorkspaceDep('./local/mod.ts', names), null) // relative path
})

const pkg = (name: string, deps: string[]): WorkspacePackage => ({
  name,
  version: '1.0.0',
  dir: `/${name}`,
  deps
})

Deno.test('toReleaseOrder - publishes a dependency before its dependent', () => {
  const order = toReleaseOrder([
    pkg('@skmtc/cli', ['@skmtc/core']),
    pkg('@skmtc/core', [])
  ]).map(p => p.name)
  assertEquals(order, ['@skmtc/core', '@skmtc/cli'])
})

Deno.test('toReleaseOrder - a dep outside the publish set does not constrain order', () => {
  // cli depends on core, but core is already published (absent from
  // the set) — cli releases on its own.
  const order = toReleaseOrder([pkg('@skmtc/cli', ['@skmtc/core'])]).map(p => p.name)
  assertEquals(order, ['@skmtc/cli'])
})

Deno.test('toReleaseOrder - throws on a dependency cycle', () => {
  assertThrows(
    () => toReleaseOrder([pkg('a', ['b']), pkg('b', ['a'])]),
    Error,
    'cycle'
  )
})
