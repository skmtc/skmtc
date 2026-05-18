/**
 * Tests for `buildAttributionState` — the worker-side reconstruction
 * of `AttributionState` from the serialisable payload that crosses
 * the `postMessage` boundary.
 *
 * The function is the seam where the wire shape and the in-memory
 * shape meet: `parser` becomes `tscAdapter`, and `generatorMeta`
 * becomes a lookup function. Tests pin both behaviours.
 */

import { assertEquals, assertStrictEquals } from '@std/assert'
import { tscAdapter } from '@skmtc/core/Anchors'
import { buildAttributionState } from './mod.ts'

Deno.test('buildAttributionState - undefined payload yields undefined', () => {
  assertStrictEquals(buildAttributionState(undefined), undefined)
})

Deno.test('buildAttributionState - enabled without postPass returns instrumentation-only', () => {
  const result = buildAttributionState({ enabled: true })
  assertEquals(result, { enabled: true })
})

Deno.test('buildAttributionState - postPass reconstitutes parser as tscAdapter', () => {
  const result = buildAttributionState({
    enabled: true,
    postPass: { schemaSrc: 'openapi.json' }
  })
  assertStrictEquals(result?.postPass?.parser, tscAdapter)
  assertEquals(result?.postPass?.schemaSrc, 'openapi.json')
})

Deno.test('buildAttributionState - generatorMeta map becomes a lookup function', () => {
  const result = buildAttributionState({
    enabled: true,
    postPass: {
      schemaSrc: 'openapi.json',
      generatorMeta: {
        '@scope/gen-zod': {
          version: '1.2.3',
          registry: { host: 'jsr.io', kind: 'jsr' }
        }
      }
    }
  })

  const lookup = result?.postPass?.generatorMeta
  assertEquals(typeof lookup, 'function')

  const hit = lookup?.('@scope/gen-zod')
  assertEquals(hit?.version, '1.2.3')
  assertEquals(hit?.registry, { host: 'jsr.io', kind: 'jsr' })
})

Deno.test('buildAttributionState - unknown genId falls back to default registry', () => {
  const result = buildAttributionState({
    enabled: true,
    postPass: {
      schemaSrc: 'openapi.json',
      generatorMeta: {
        '@scope/gen-zod': {
          version: '1.2.3',
          registry: { host: 'jsr.skmtc.dev', kind: 'jsr-private' }
        }
      }
    }
  })

  const lookup = result?.postPass?.generatorMeta
  const miss = lookup?.('@unknown/gen-other')
  assertEquals(miss?.version, '')
  assertEquals(miss?.registry, { host: 'jsr.io', kind: 'jsr' })
})

Deno.test('buildAttributionState - omitted generatorMeta leaves lookup undefined', () => {
  const result = buildAttributionState({
    enabled: true,
    postPass: { schemaSrc: 'openapi.json' }
  })

  assertStrictEquals(result?.postPass?.generatorMeta, undefined)
})

Deno.test('buildAttributionState - payload round-trips through structured clone', () => {
  // Real worker postMessage uses structured clone. Verify our shape
  // survives — JSON round-trip is a conservative proxy (structured
  // clone supports everything JSON does plus more).
  const payload = {
    enabled: true,
    postPass: {
      schemaSrc: 'openapi.json',
      generatorMeta: {
        '@scope/gen-zod': {
          version: '0.0.55',
          registry: { host: 'jsr.io', kind: 'jsr' as const }
        }
      }
    }
  }
  const cloned = JSON.parse(JSON.stringify(payload))
  const result = buildAttributionState(cloned)
  assertEquals(
    result?.postPass?.generatorMeta?.('@scope/gen-zod')?.version,
    '0.0.55'
  )
})
