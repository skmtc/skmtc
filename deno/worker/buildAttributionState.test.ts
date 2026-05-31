/**
 * Tests for `buildAttributionState` — the worker-side reconstruction
 * of `AttributionState` from the serialisable payload that crosses
 * the `postMessage` boundary.
 *
 * The function is the seam where the wire shape and the in-memory
 * shape meet. `parser` is intentionally omitted worker-side because
 * native parsers don't bundle cleanly via `deno bundle`; landmarks
 * fall back to the enclosing Definition's identifier. Tests pin the
 * shape that crosses the wire.
 */

import { assertEquals, assertStrictEquals } from '@std/assert'
import { buildAttributionState } from './mod.ts'

Deno.test('buildAttributionState - undefined payload yields undefined', () => {
  assertStrictEquals(buildAttributionState(undefined), undefined)
})

Deno.test('buildAttributionState - no postPass yields undefined', () => {
  const result = buildAttributionState({})
  assertStrictEquals(result, undefined)
})

Deno.test('buildAttributionState - postPass leaves parser undefined (worker-side fallback)', () => {
  const result = buildAttributionState({
    postPass: { schemaSrc: 'openapi.json' }
  })
  assertStrictEquals(result?.postPass?.parser, undefined)
  assertEquals(result?.postPass?.schemaSrc, 'openapi.json')
})

Deno.test('buildAttributionState - generatorMeta map becomes a lookup function', () => {
  const result = buildAttributionState({
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
    postPass: { schemaSrc: 'openapi.json' }
  })

  assertStrictEquals(result?.postPass?.generatorMeta, undefined)
})

Deno.test('buildAttributionState - payload round-trips through structured clone', () => {
  // Real worker postMessage uses structured clone. Verify our shape
  // survives — JSON round-trip is a conservative proxy (structured
  // clone supports everything JSON does plus more).
  const payload = {
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
