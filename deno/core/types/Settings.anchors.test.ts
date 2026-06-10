/**
 * Tests for the `anchors` field added to {@link ClientSettings} in
 * Phase D. Focused on the valibot schema's accept/reject behaviour;
 * the consumer wiring (`generateLocal` → `writeSidecars`) is tested
 * separately.
 */

import { assert, assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { anchorsSettings, clientSettings, type ClientSettings } from './Settings.ts'

Deno.test('anchorsSettings - accepts the minimal { enabled } shape', () => {
  const parsed = v.parse(anchorsSettings, { enabled: true })
  assertEquals(parsed.enabled, true)
  assertEquals(parsed.out, undefined)
})

Deno.test('anchorsSettings - accepts the full { enabled, out } shape', () => {
  const parsed = v.parse(anchorsSettings, { enabled: true, out: '.gen-maps' })
  assertEquals(parsed.out, '.gen-maps')
})

Deno.test('anchorsSettings - rejects missing required `enabled`', () => {
  assertThrows(() => v.parse(anchorsSettings, { out: '.maps' }))
})

Deno.test('anchorsSettings - rejects non-boolean `enabled`', () => {
  assertThrows(() => v.parse(anchorsSettings, { enabled: 'yes' }))
})

Deno.test('clientSettings - accepts settings with omitted anchors block', () => {
  // Backwards-compatible: existing projects without anchors continue
  // to parse cleanly.
  const parsed: ClientSettings = v.parse(clientSettings, { basePath: 'src' })
  assertEquals(parsed.anchors, undefined)
})

Deno.test('clientSettings - accepts settings with anchors enabled', () => {
  const parsed = v.parse(clientSettings, {
    basePath: 'src',
    anchors: { enabled: true, out: '.maps' }
  })
  assertEquals(parsed.anchors, { enabled: true, out: '.maps' })
})

Deno.test('clientSettings - rejects malformed anchors block (e.g. invalid `out` type)', () => {
  assertThrows(() =>
    v.parse(clientSettings, {
      basePath: 'src',
      anchors: { enabled: true, out: 42 }
    })
  )
})

Deno.test('clientSettings - anchors round-trip through JSON.stringify / parse', () => {
  const input = { basePath: 'src', anchors: { enabled: true, out: '.maps' } }
  const parsed = v.parse(clientSettings, JSON.parse(JSON.stringify(input)))
  assert(parsed.anchors !== undefined)
  assertEquals(parsed.anchors!.enabled, true)
  assertEquals(parsed.anchors!.out, '.maps')
})
