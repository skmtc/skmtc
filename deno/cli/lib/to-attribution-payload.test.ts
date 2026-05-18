import { assertEquals, assertStrictEquals } from '@std/assert'
import { resolveAnchorsEnabled, toAttributionPayload } from './to-attribution-payload.ts'

Deno.test('toAttributionPayload - undefined anchors → undefined payload', () => {
  assertStrictEquals(
    toAttributionPayload({ anchors: undefined, schemaSource: 'openapi.json' }),
    undefined
  )
})

Deno.test('toAttributionPayload - anchors disabled → undefined payload', () => {
  assertStrictEquals(
    toAttributionPayload({ anchors: { enabled: false }, schemaSource: 'openapi.json' }),
    undefined
  )
})

Deno.test('toAttributionPayload - anchors enabled → payload with schemaSrc', () => {
  const payload = toAttributionPayload({
    anchors: { enabled: true },
    schemaSource: 'openapi.json'
  })
  assertEquals(payload, {
    enabled: true,
    postPass: { schemaSrc: 'openapi.json' }
  })
})

Deno.test('toAttributionPayload - missing schemaSource falls back to empty string', () => {
  const payload = toAttributionPayload({
    anchors: { enabled: true },
    schemaSource: undefined
  })
  assertEquals(payload?.postPass?.schemaSrc, '')
})

Deno.test('toAttributionPayload - anchors.out is not threaded (consumed disk-side)', () => {
  // `out` is a CLI/disk concern (the outDir for writeSidecars), not
  // an in-worker concern. The payload should carry only the
  // worker-facing fields.
  const payload = toAttributionPayload({
    anchors: { enabled: true, out: '.gen-maps' },
    schemaSource: 'openapi.json'
  })
  // No `out` field on the payload — by design.
  assertEquals(payload?.postPass, { schemaSrc: 'openapi.json' })
})

// ─── resolveAnchorsEnabled ─────────────────────────────────────────

Deno.test('resolveAnchorsEnabled - no flag, no config → false', () => {
  assertEquals(resolveAnchorsEnabled(undefined, undefined), false)
})

Deno.test('resolveAnchorsEnabled - no flag, config off → false', () => {
  assertEquals(resolveAnchorsEnabled({ enabled: false }, undefined), false)
})

Deno.test('resolveAnchorsEnabled - no flag, config on → true', () => {
  assertEquals(resolveAnchorsEnabled({ enabled: true }, undefined), true)
})

Deno.test('resolveAnchorsEnabled - flag=true overrides config=false', () => {
  assertEquals(resolveAnchorsEnabled({ enabled: false }, true), true)
})

Deno.test('resolveAnchorsEnabled - flag=false overrides config=true', () => {
  assertEquals(resolveAnchorsEnabled({ enabled: true }, false), false)
})

Deno.test('resolveAnchorsEnabled - flag=true overrides missing config', () => {
  assertEquals(resolveAnchorsEnabled(undefined, true), true)
})

// ─── toAttributionPayload + flag override integration ─────────────

Deno.test('toAttributionPayload - flag=true with anchors off → payload emitted', () => {
  const payload = toAttributionPayload({
    anchors: { enabled: false },
    schemaSource: 'openapi.json',
    flagOverride: true
  })
  assertEquals(payload?.enabled, true)
  assertEquals(payload?.postPass?.schemaSrc, 'openapi.json')
})

Deno.test('toAttributionPayload - flag=false with anchors on → no payload', () => {
  assertStrictEquals(
    toAttributionPayload({
      anchors: { enabled: true },
      schemaSource: 'openapi.json',
      flagOverride: false
    }),
    undefined
  )
})
