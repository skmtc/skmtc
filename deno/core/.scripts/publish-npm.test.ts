import { assertEquals } from '@std/assert'
import { isVersionOnNpm } from './publish-npm.ts'

Deno.test('isVersionOnNpm - true when the version is in the packument', () => {
  const packument = { versions: { '0.18.1': {}, '0.25.0': {} } }
  assertEquals(isVersionOnNpm(packument, '0.25.0'), true)
})

Deno.test('isVersionOnNpm - false when the version is absent', () => {
  const packument = { versions: { '0.18.1': {} } }
  assertEquals(isVersionOnNpm(packument, '0.26.0'), false)
})

Deno.test('isVersionOnNpm - false for a never-published package (404 → null)', () => {
  assertEquals(isVersionOnNpm(null, '0.26.0'), false)
})

Deno.test('isVersionOnNpm - false when the packument has no versions map', () => {
  assertEquals(isVersionOnNpm({}, '0.26.0'), false)
})
