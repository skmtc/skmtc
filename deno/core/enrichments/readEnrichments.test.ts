import { assertEquals, assertThrows } from '@std/assert'
import * as v from 'valibot'
import { toGeneratorEnrichment, toStackEnrichment } from '@/enrichments/readEnrichments.ts'
import { generatorEnrichments } from '@/types/Enrichments.ts'
import type { ClientSettings } from '@/types/Settings.ts'

const settings = (enrichments: Record<string, unknown>): { settings: ClientSettings } => ({
  settings: { enrichments } as ClientSettings
})

Deno.test('toGeneratorEnrichment — reads the _generator leaf, typed', () => {
  const schema = v.object({ basePackage: v.string() })
  const ctx = settings({
    '@scope/gen-x': {
      _generator: { basePackage: 'org.example' },
      User: { main: {} }
    }
  })

  const config = toGeneratorEnrichment(ctx, '@scope/gen-x', schema)
  assertEquals(config.basePackage, 'org.example')
})

Deno.test('toGeneratorEnrichment — absent block + optional schema → undefined', () => {
  const schema = v.optional(v.object({ basePackage: v.string() }))
  const ctx = settings({ '@scope/gen-x': { User: { main: {} } } })

  assertEquals(toGeneratorEnrichment(ctx, '@scope/gen-x', schema), undefined)
})

Deno.test('toGeneratorEnrichment — required schema + absent block throws (fail-open at call site)', () => {
  const schema = v.object({ basePackage: v.string() })
  const ctx = settings({})

  assertThrows(() => toGeneratorEnrichment(ctx, '@scope/gen-x', schema))
})

Deno.test('toStackEnrichment — reads the _stack leaf, typed', () => {
  const schema = v.object({ basePackage: v.string() })
  const ctx = settings({ _stack: { basePackage: 'org.shared' } })

  assertEquals(toStackEnrichment(ctx, schema).basePackage, 'org.shared')
})

Deno.test('toStackEnrichment — partial schema ignores fields other generators read', () => {
  // The shared bag carries fields for several generators; a consumer
  // reads only its slice and is unaffected by the rest.
  const schema = v.object({ basePackage: v.string() })
  const ctx = settings({
    _stack: { basePackage: 'org.shared', clientPrefix: 'Acme', retries: 3 }
  })

  assertEquals(toStackEnrichment(ctx, schema).basePackage, 'org.shared')
})

Deno.test('generatorEnrichments — accepts reserved _stack / _generator and customer keys', () => {
  const result = v.safeParse(generatorEnrichments, {
    _stack: { basePackage: 'org.shared' },
    '@scope/gen-x': {
      _generator: { basePackage: 'org.example' },
      User: { main: {} }
    }
  })
  assertEquals(result.success, true)
})

Deno.test('generatorEnrichments — rejects an unknown _-prefixed top-level key', () => {
  const result = v.safeParse(generatorEnrichments, { _stuck: { some: 'value' } })
  assertEquals(result.success, false)
})

Deno.test('generatorEnrichments — rejects an unknown _-prefixed key inside a generator slot', () => {
  const result = v.safeParse(generatorEnrichments, {
    '@scope/gen-x': { _generatorr: { some: 'value' }, User: { main: {} } }
  })
  assertEquals(result.success, false)
})
