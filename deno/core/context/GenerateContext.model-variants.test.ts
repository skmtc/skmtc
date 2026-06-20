/**
 * Coverage for the model-variant axis at the engine boundary.
 *
 * Symmetric with `GenerateContext.variants.test.ts` but for the
 * `toModelEntry` path. The engine reads `enrichments[id][refName]`
 * and treats its keys as variant names. This file exercises the same
 * four invariants:
 *
 *   1. Absent enrichment → single `'main'` dispatch.
 *   2. Multi-variant enrichment → one `transform` call per variant
 *      with the variant name threaded through.
 *   3. Non-`'main'` variant declared without `'main'` → engine throws
 *      (loud beats silent zero-output).
 *   4. Skip/include match per `(refName, variant)` tuple; empty
 *      variant array means "every variant of this refName".
 *
 * Peer-variant-mismatch (Driver-level) and generatorKey-collision
 * (variants-aware Projection that ignores variant in `toIdentifier`)
 * live in ModelDriver.test.ts since they need a real Driver path.
 */

import { assertEquals, assertThrows } from '@std/assert'
import { spy, type Spy } from '@std/testing/mock'
import * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import type { ResultType } from '@/types/Results.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

type TransformArgs = {
  context: unknown
  refName: RefName
  acc: unknown
  variant: string
}

type CaptureEntry = { result: ResultType; trail: string }

const makeOasDoc = (schemaNames: string[]) =>
  new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    components:
      schemaNames.length > 0
        ? new OasComponents({
            schemas: Object.fromEntries(schemaNames.map(n => [n, new OasString({})]))
          })
        : undefined
  })

const buildContext = (args: {
  document: OasDocument
  settings: unknown
  generators: Record<string, unknown>
}) => {
  const captures: CaptureEntry[] = []
  const captureCurrentResult: Spy<undefined, [ResultType, StackTrail], void> = spy(
    (result: ResultType, trail: StackTrail) => {
      captures.push({ result, trail: trail.toString() })
    }
  )

  const context = new GenerateContext({
    document: { type: 'oas', value: args.document },
    // deno-lint-ignore no-explicit-any — settings shape verified at runtime
    settings: args.settings as any,
    logger: mockLogger,
    captureCurrentResult,
    // deno-lint-ignore no-explicit-any — minimal generator mock
    toGeneratorConfigMap: () => args.generators as any
  })

  return { context, captures }
}

type VariantResult = { refName: string; variant: string; result: ResultType }

/**
 * Parse the variant capture from the `StackTrail`. The trail produced
 * by `#runModelGenerator` is `<root>:<gen-id>:<refName>:variant%3A <name>`
 * — the inner `:` in the variant leaf gets URL-escaped to `%3A` since
 * `StackTrail.toString()` joins with `:`.
 */
const toVariantResults = (
  captures: CaptureEntry[],
  generatorId: string
): VariantResult[] => {
  const out: VariantResult[] = []
  for (const c of captures) {
    const segments = c.trail.split(':')
    const idIdx = segments.indexOf(generatorId)
    if (idIdx === -1 || idIdx + 2 >= segments.length) continue

    const refName = segments[idIdx + 1] ?? ''
    const variantLeaf = segments[idIdx + 2]?.replaceAll('%3A', ':') ?? ''
    const variantPrefix = 'variant: '
    if (!variantLeaf.startsWith(variantPrefix)) continue
    const variant = variantLeaf.slice(variantPrefix.length)

    out.push({ refName, variant, result: c.result })
  }
  return out
}

const makeGen = (id: string, transform?: Spy) => ({
  id,
  type: 'model' as const,
  transform: transform ?? spy(() => undefined)
})

// ─── Case 1: no enrichments configured → single 'main' dispatch ────

Deno.test('model variants - refName with no enrichment block dispatches a single `main` variant', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: { skip: [] },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.length, 1)
  assertEquals(results[0], {
    refName: 'Customer',
    variant: 'main',
    result: 'success'
  })

  assertEquals(transform.calls.length, 1)
  assertEquals(transform.calls[0].args[0].variant, 'main')
})

// ─── Case 2: multi-variant enrichment → one transform per variant ──

Deno.test('model variants - multi-variant enrichment fans out one transform per declared variant', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            main: { coerce: false },
            coercive: { coerce: true }
          }
        }
      }
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.length, 2)

  const variantNames = results.map(r => r.variant).sort()
  assertEquals(variantNames, ['coercive', 'main'])
  assertEquals(
    results.every(r => r.result === 'success'),
    true
  )

  // `transform` is called once per variant in JSON-insertion order.
  assertEquals(transform.calls.length, 2)
  const variantsCalled = transform.calls.map(c => c.args[0].variant)
  assertEquals(variantsCalled, ['main', 'coercive'])
})

Deno.test('model variants - per-variant transforms see the same refName threaded with different variants', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context } = buildContext({
    document: makeOasDoc(['Order']),
    settings: {
      enrichments: {
        'zod-gen': {
          Order: {
            main: {},
            coercive: {}
          }
        }
      }
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  assertEquals(transform.calls.length, 2)
  for (const call of transform.calls) {
    assertEquals(call.args[0].refName, 'Order')
  }
})

// ─── Case 3: missing 'main' → engine throws ────────────────────────

Deno.test('model variants - declaring a non-`main` variant without `main` throws at engine start', () => {
  const { context } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            // No 'main' — only a non-default variant. The engine throws.
            coercive: { coerce: true }
          }
        }
      }
    },
    generators: { 'zod-gen': makeGen('zod-gen') }
  })

  assertThrows(
    () => context.toArtifacts(new StackTrail(['test'])),
    Error,
    `must include a 'main' variant`
  )
})

// ─── Case 4: skip per (refName, variant) tuple ─────────────────────

Deno.test('model variants - skip with empty variant array denies all variants of the refName', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            main: {},
            coercive: {}
          }
        }
      },
      skip: [{ 'zod-gen': { Customer: [] } }]
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.length, 2)
  assertEquals(
    results.every(r => r.result === 'skipped'),
    true
  )
  assertEquals(transform.calls.length, 0)
})

Deno.test('model variants - skip with named variants denies only the listed ones', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            main: {},
            coercive: {}
          }
        }
      },
      skip: [{ 'zod-gen': { Customer: ['coercive'] } }]
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen').sort((a, b) =>
    a.variant.localeCompare(b.variant)
  )
  assertEquals(results.length, 2)
  assertEquals(results.find(r => r.variant === 'main')?.result, 'success')
  assertEquals(results.find(r => r.variant === 'coercive')?.result, 'skipped')
})

Deno.test('model variants - include with named variants restricts emission to listed variants', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            main: {},
            coercive: {}
          }
        }
      },
      include: [{ 'zod-gen': { Customer: ['coercive'] } }]
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.find(r => r.variant === 'main')?.result, 'skipped')
  assertEquals(results.find(r => r.variant === 'coercive')?.result, 'success')
})

Deno.test('model variants - include + skip on same variant: skip wins', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: {
      enrichments: {
        'zod-gen': {
          Customer: {
            main: {},
            coercive: {}
          }
        }
      },
      include: [{ 'zod-gen': { Customer: [] } }],
      skip: [{ 'zod-gen': { Customer: ['coercive'] } }]
    },
    generators: { 'zod-gen': makeGen('zod-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.find(r => r.variant === 'main')?.result, 'success')
  assertEquals(results.find(r => r.variant === 'coercive')?.result, 'skipped')
})

// ─── isSupported capability gate (symmetric with the operation arm) ──

Deno.test('model variants - isSupported gates which refNames dispatch', () => {
  // The generator supports only `Customer`. `Order` must emit
  // `notSupported` and its `transform` must not run.
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer', 'Order']),
    settings: { skip: [] },
    generators: {
      'zod-gen': {
        id: 'zod-gen',
        type: 'model' as const,
        transform,
        isSupported: ({ refName }: { refName: RefName }) => refName === 'Customer'
      }
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.find(r => r.refName === 'Customer')?.result, 'success')
  assertEquals(results.find(r => r.refName === 'Order')?.result, 'notSupported')

  // transform ran for Customer only.
  assertEquals(transform.calls.length, 1)
  assertEquals(transform.calls[0].args[0].refName, 'Customer')
})

Deno.test('model variants - isSupported runs before include; unsupported emits notSupported even if included', () => {
  // The refName is in the include allow-list, but `isSupported` returns
  // false. We must see `notSupported`, NOT `skipped` — include must not
  // mask capability rejection. Mirrors the operation-arm ordering test.
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc(['Customer']),
    settings: { include: [{ 'zod-gen': { Customer: [] } }] },
    generators: {
      'zod-gen': {
        id: 'zod-gen',
        type: 'model' as const,
        transform,
        isSupported: () => false
      }
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'zod-gen')
  assertEquals(results.length, 1)
  assertEquals(results[0].result, 'notSupported')
  assertEquals(transform.calls.length, 0)
})
