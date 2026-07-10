/**
 * Round-trip and shape tests for the {@link ClientJsonCompact} codec.
 * The codec's contract is losslessness against `JSON.parse(JSON.stringify(x))`
 * for any JSON value, plus an unambiguous `compact: true` discriminator.
 */

import { assert, assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import {
  COMPACT_VERSION,
  compactClientJson,
  decodeCompact,
  encodeCompact,
  expandClientJson,
  isCompactClientJson
} from './ClientJsonCompact.ts'

const roundTrips = (value: unknown): void => {
  const encoded = encodeCompact(value)
  // Serialize + reparse to prove the envelope survives disk.
  const reparsed = JSON.parse(JSON.stringify(encoded))
  assert(isCompactClientJson(reparsed))
  const decoded = decodeCompact(reparsed)
  assertEquals(JSON.stringify(decoded), JSON.stringify(value))
}

Deno.test('encodeCompact - round-trips primitives', () => {
  roundTrips('hello')
  roundTrips(42)
  roundTrips(-3.14)
  roundTrips(true)
  roundTrips(false)
  roundTrips(null)
})

Deno.test('encodeCompact - round-trips nested objects and arrays', () => {
  roundTrips({
    project: '@acme/api',
    source: './schema.json',
    settings: {
      basePath: 'src',
      packages: [{ rootPath: 'src', moduleName: '@acme/client' }],
      enrichments: {
        '@acme/gen-form': {
          '/users': {
            post: { main: { title: 'Create', fields: [{ moduleSelect: { schemaPath: ['RequestBody', 'name'] } }] } }
          }
        }
      }
    }
  })
})

Deno.test('encodeCompact - interns repeated strings into one pool entry', () => {
  const encoded = encodeCompact({
    a: { schemaPath: ['SuccessResponse', 'items'] },
    b: { schemaPath: ['SuccessResponse', 'items'] }
  })
  // 'schemaPath', 'SuccessResponse', 'items' plus keys 'a','b' — each once.
  assertEquals(encoded.pool.filter(entry => entry === 'SuccessResponse').length, 1)
  assertEquals(encoded.pool.filter(entry => entry === 'items').length, 1)
  assertEquals(encoded.pool.filter(entry => entry === 'schemaPath').length, 1)
})

Deno.test('encodeCompact - drops undefined object entries like JSON.stringify', () => {
  const value = { source: undefined, settings: { basePath: 'src' } }
  const decoded = decodeCompact(encodeCompact(value))
  assertEquals(JSON.stringify(decoded), JSON.stringify(value))
  assertEquals(decoded, { settings: { basePath: 'src' } })
})

Deno.test('encodeCompact - renders undefined array elements as null like JSON.stringify', () => {
  const value = { list: ['a', undefined, 'b'] }
  const decoded = decodeCompact(encodeCompact(value))
  assertEquals(JSON.stringify(decoded), JSON.stringify(value))
})

Deno.test('encodeCompact - preserves object key insertion order', () => {
  const value = { z: 1, a: 2, m: 3 }
  const decoded = decodeCompact(encodeCompact(value))
  assertEquals(Object.keys(decoded as Record<string, unknown>), ['z', 'a', 'm'])
})

Deno.test('encodeCompact - throws on a non-JSON value', () => {
  assertThrows(() => encodeCompact({ fn: () => 1 }), TypeError)
})

Deno.test('encodeCompact - stamps the current format version', () => {
  assertEquals(encodeCompact({}).cv, COMPACT_VERSION)
})

Deno.test('isCompactClientJson - true only for the compact envelope', () => {
  assert(isCompactClientJson(encodeCompact({ settings: {} })))
  assert(!isCompactClientJson({ settings: {} }))
  assert(!isCompactClientJson({ compact: false, settings: {} }))
  assert(!isCompactClientJson(null))
  assert(!isCompactClientJson('compact'))
  assert(!isCompactClientJson([1, 2, 3]))
})

Deno.test('expandClientJson - decodes compact, passes expanded through unchanged', () => {
  const expanded = { project: '@acme/api', settings: { basePath: 'src' } }
  assertEquals(expandClientJson(expanded), expanded)
  assertEquals(expandClientJson(encodeCompact(expanded)), expanded)
})

Deno.test('compactClientJson schema - accepts a real envelope, rejects expanded', () => {
  const envelope = encodeCompact({ settings: { basePath: 'src' } })
  assertEquals(v.parse(compactClientJson, JSON.parse(JSON.stringify(envelope))).compact, true)
  assertThrows(() => v.parse(compactClientJson, { settings: {} }))
})

Deno.test('decodeCompact - throws on an out-of-range pool index', () => {
  assertThrows(
    () => decodeCompact({ compact: true, cv: 1, pool: ['a'], doc: 5 }),
    TypeError
  )
})

Deno.test('decodeCompact - throws on an odd-length object payload', () => {
  assertThrows(
    () => decodeCompact({ compact: true, cv: 1, pool: ['a'], doc: [5, [0]] }),
    TypeError
  )
})
