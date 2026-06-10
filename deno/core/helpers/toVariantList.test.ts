import { assertEquals, assertThrows } from '@std/assert'
import { toVariantList } from '@/helpers/toVariantList.ts'

Deno.test('toVariantList - undefined enrichment block yields [main]', () => {
  assertEquals(
    toVariantList({
      opEnrichments: undefined,
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - null enrichment block yields [main]', () => {
  assertEquals(
    toVariantList({
      opEnrichments: null,
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - primitive enrichment block yields [main]', () => {
  // Defensive path: per-variant Valibot wrap will reject this shape
  // at config-load time. Until then, fall back to a single 'main' pass.
  assertEquals(
    toVariantList({
      opEnrichments: 'a string',
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - array enrichment block yields [main]', () => {
  // Arrays are objects in JS but shouldn't be treated as variant
  // records — same defensive fallback as primitives.
  assertEquals(
    toVariantList({
      opEnrichments: ['not', 'a', 'variant', 'record'],
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - empty object enrichment block yields [main]', () => {
  // Consumer wrote `{}` — no variants declared, treat as single
  // 'main' pass rather than dispatching zero variants.
  assertEquals(
    toVariantList({
      opEnrichments: {},
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - single main variant yields [main]', () => {
  assertEquals(
    toVariantList({
      opEnrichments: { main: { title: 'Form' } },
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main']
  )
})

Deno.test('toVariantList - multi-variant block preserves JSON-insertion order', () => {
  // Insertion order is the contract: the engine threads `acc` through
  // variants in this exact order, and the manifest captures variants
  // in this exact order. Tests downstream of the engine rely on it.
  assertEquals(
    toVariantList({
      opEnrichments: { main: {}, customer: {}, location: {} },
      generatorId: 'gen-x',
      operationLabel: 'POST /quotes'
    }),
    ['main', 'customer', 'location']
  )
})

Deno.test('toVariantList - missing main with other variants present throws', () => {
  assertThrows(
    () =>
      toVariantList({
        opEnrichments: { customer: {}, location: {} },
        generatorId: '@skmtc/gen-shadcn-form',
        operationLabel: 'PATCH /quotes/{id}'
      }),
    Error,
    "[@skmtc/gen-shadcn-form] Enrichments for 'PATCH /quotes/{id}' must include a 'main' variant. Found variants: customer, location."
  )
})
