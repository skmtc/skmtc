/**
 * Coverage for the operation-variant axis at the engine boundary.
 *
 * The engine reads `enrichments[id][path][method]` and treats its keys
 * as variant names. This file exercises the four invariants that hold
 * the variant design together:
 *
 *   1. Absent enrichment → single `'main'` dispatch.
 *   2. Multi-variant enrichment → one `transform` call per variant
 *      with the variant name threaded through.
 *   3. Non-`'main'` variant declared without `'main'` → engine throws
 *      (loud beats silent zero-output).
 *   4. Skip/include match per `(path, method, variant)` tuple; empty
 *      variant array means "every variant of this method".
 *
 * Peer-variant-mismatch (Driver-level) and generatorKey-collision
 * (variants-aware Projection that ignores variant in `toIdentifier`)
 * live in OasOperationDriver.test.ts since they need a real Driver
 * path.
 */

import { assertEquals, assertThrows } from '@std/assert'
import { spy, type Spy } from '@std/testing/mock'
import * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import type { ResultType } from '@/types/Results.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

type TransformArgs = {
  context: unknown
  operation: OasOperation
  acc: unknown
  variant: string
}

type CaptureEntry = { result: ResultType; trail: string }

const makeOasDoc = (ops: Array<{ path: string; method: 'get' | 'post' | 'put' | 'patch' }>) =>
  new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: ops.map(
      ({ path, method }) =>
        new OasOperation({ path, method, pathItem: undefined, responses: {} })
    )
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

/**
 * Per-variant report: parse the `StackTrail` produced by the engine
 * loop. The trail format is
 * `<root>:<gen-id>:<path>%3A<method>:variant%3A <name>` — both inner
 * `:` get URL-escaped to `%3A` since the trail joins with `:`.
 *
 * Returns one entry per *variant* capture (the engine emits one
 * `captureCurrentResult` per variant inside each operation frame).
 */
type VariantResult = { path: string; method: string; variant: string; result: ResultType }

const toVariantResults = (
  captures: CaptureEntry[],
  generatorId: string
): VariantResult[] => {
  const out: VariantResult[] = []
  for (const c of captures) {
    const segments = c.trail.split(':')
    const idIdx = segments.indexOf(generatorId)
    if (idIdx === -1 || idIdx + 2 >= segments.length) continue

    const opLeaf = segments[idIdx + 1]?.replaceAll('%3A', ':') ?? ''
    const opColon = opLeaf.lastIndexOf(':')
    if (opColon === -1) continue

    const variantLeaf = segments[idIdx + 2]?.replaceAll('%3A', ':') ?? ''
    // Leaf shape: `variant: <name>` — split off the prefix.
    const variantPrefix = 'variant: '
    if (!variantLeaf.startsWith(variantPrefix)) continue
    const variant = variantLeaf.slice(variantPrefix.length)

    out.push({
      path: opLeaf.slice(0, opColon),
      method: opLeaf.slice(opColon + 1),
      variant,
      result: c.result
    })
  }
  return out
}

const makeGen = (id: string, transform?: Spy) => ({
  id,
  type: 'oasOperation' as const,
  transform: transform ?? spy(() => undefined),
  isSupported: () => true
})

// ─── Case 1: no enrichments configured → single 'main' dispatch ────

Deno.test('variants - operation with no enrichment block dispatches a single `main` variant', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes', method: 'patch' }]),
    settings: { skip: [] },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'form-gen')
  assertEquals(results.length, 1)
  assertEquals(results[0], {
    path: '/quotes',
    method: 'patch',
    variant: 'main',
    result: 'success'
  })

  // `transform` was called exactly once, with `variant: 'main'`.
  assertEquals(transform.calls.length, 1)
  assertEquals(transform.calls[0].args[0].variant, 'main')
})

// ─── Case 2: multi-variant enrichment → one transform per variant ──

Deno.test('variants - multi-variant enrichment fans out one transform per declared variant', () => {
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: {
              main: { title: 'Edit Quote' },
              customer: { title: 'Customer Section' },
              location: { title: 'Location Section' }
            }
          }
        }
      }
    },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'form-gen')
  assertEquals(results.length, 3)

  const variantNames = results.map(r => r.variant).sort()
  assertEquals(variantNames, ['customer', 'location', 'main'])
  assertEquals(results.every(r => r.result === 'success'), true)

  // `transform` was called exactly three times. Variant names are
  // threaded as the `variant` arg in the order keys appear in the
  // enrichment object (JSON-insertion order).
  assertEquals(transform.calls.length, 3)
  const variantsCalled = transform.calls.map(c => c.args[0].variant)
  assertEquals(variantsCalled, ['main', 'customer', 'location'])
})

// ─── Case 3: missing `'main'` → engine throws ──────────────────────

Deno.test('variants - declared variants without `main` throws at engine dispatch', () => {
  const { context } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: {
              customer: { title: 'Customer Section' },
              location: { title: 'Location Section' }
              // No 'main' — should throw.
            }
          }
        }
      }
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })

  assertThrows(
    () => context.toArtifacts(new StackTrail(['test'])),
    Error,
    "must include a 'main' variant"
  )
})

// ─── Case 4a: per-variant skip — `[]` skips every variant ──────────

Deno.test('variants - skip with empty variant array skips every variant of that method', () => {
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: {
              main: {},
              customer: {},
              location: {}
            }
          }
        }
      },
      skip: [{ 'form-gen': { '/quotes/{id}': { patch: [] } } }]
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'form-gen')
  assertEquals(results.length, 3)
  assertEquals(
    results.every(r => r.result === 'skipped'),
    true,
    `Empty skip variant array should skip every variant: ${JSON.stringify(results)}`
  )
})

// ─── Case 4b: per-variant skip — named array skips only those ──────

Deno.test('variants - skip with named variant array skips only those variants', () => {
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: {
              main: {},
              customer: {},
              location: {}
            }
          }
        }
      },
      skip: [{ 'form-gen': { '/quotes/{id}': { patch: ['customer'] } } }]
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'form-gen')
  const byVariant = Object.fromEntries(results.map(r => [r.variant, r.result]))

  assertEquals(byVariant.main, 'success')
  assertEquals(byVariant.customer, 'skipped')
  assertEquals(byVariant.location, 'success')
})

// ─── Case 4c: per-variant include — only listed variants admitted ──

Deno.test('variants - include with named variant array admits only those variants', () => {
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: {
              main: {},
              customer: {},
              location: {}
            }
          }
        }
      },
      include: [{ 'form-gen': { '/quotes/{id}': { patch: ['customer'] } } }]
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toVariantResults(captures, 'form-gen')
  const byVariant = Object.fromEntries(results.map(r => [r.variant, r.result]))

  assertEquals(byVariant.main, 'skipped')
  assertEquals(byVariant.customer, 'success')
  assertEquals(byVariant.location, 'skipped')
})

// ─── StackTrail nesting: variant frame lives INSIDE operation frame

Deno.test('variants - StackTrail nests the variant frame inside the operation frame', () => {
  // Pinning a real bug from step 6 of the variants rollout: the
  // variant-fan-out trace was originally chained off the outer
  // `stackTrail` instead of the per-operation `opTrail`. That made
  // variant frames *siblings* of operation frames in the trail,
  // not children — manifest entries lost their operation context.
  //
  // The correct shape is operation → variant. Asserted here by
  // checking the trail prefix for every captured variant entry:
  // it must start with `root:gen-id:<operation>` BEFORE the
  // `variant: <name>` leaf.
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: { main: {}, customer: {} }
          }
        }
      }
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const variantCaptures = captures.filter(c => c.trail.includes('variant'))
  assertEquals(variantCaptures.length, 2)

  for (const c of variantCaptures) {
    // `:` is the separator, so an operation frame containing `:`
    // (e.g. `/quotes/{id}:patch`) is URL-encoded to
    // `/quotes/{id}%3Apatch`. The trail therefore looks like
    // `test:form-gen:/quotes/{id}%3Apatch:variant%3A <name>`.
    const segments = c.trail.split(':')
    const variantIdx = segments.findIndex(s => s.startsWith('variant%3A'))
    // Variant frame must NOT be the immediate child of the
    // generator-id frame — there has to be an operation frame
    // between them.
    const generatorIdx = segments.indexOf('form-gen')
    assertEquals(
      variantIdx,
      generatorIdx + 2,
      `Variant frame at position ${variantIdx} should sit two segments after gen-id at ${generatorIdx} (operation frame in between). Trail: ${c.trail}`
    )
  }
})

// ─── Case 5: variants-unaware peer sees `variant: 'main'` ──────────

Deno.test('variants - a generator with no enrichments configured still receives variant: main', () => {
  // Variants-unaware generators stay fully working — the engine
  // never forces them to opt into the variant axis. This is the
  // contract that lets gen-zod / gen-typescript / etc. coexist with
  // a variants-aware gen-shadcn-form in the same project.
  const txZod: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const txForm: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )

  const { context } = buildContext({
    document: makeOasDoc([{ path: '/quotes/{id}', method: 'patch' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/quotes/{id}': {
            patch: { main: {}, customer: {} }
          }
        }
        // No enrichment under 'zod-gen' — its dispatch should still
        // resolve to a single 'main' pass.
      }
    },
    generators: {
      'zod-gen': makeGen('zod-gen', txZod),
      'form-gen': makeGen('form-gen', txForm)
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  // zod-gen runs once with 'main'; form-gen runs twice (main + customer).
  assertEquals(txZod.calls.length, 1)
  assertEquals(txZod.calls[0].args[0].variant, 'main')

  assertEquals(txForm.calls.length, 2)
  assertEquals(
    txForm.calls.map(c => c.args[0].variant),
    ['main', 'customer']
  )
})

// ─── Dotted operation paths: enrichment keys are literal, not lodash paths ──

Deno.test('variants - enrichment resolves for operation paths containing dots', () => {
  // Real-world shape: OneBusAway-style paths end in `.json`. The lookup
  // must treat the whole path as ONE key — a dot-joined lodash string
  // path would split `current-time.json` into nested keys and miss
  // (the gen-kotlin-sdk arc discovery, note 32).
  const transform: Spy<undefined, [TransformArgs], unknown> = spy(
    (_args: TransformArgs) => undefined
  )
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/api/where/current-time.json', method: 'get' }]),
    settings: {
      enrichments: {
        'form-gen': {
          '/api/where/current-time.json': {
            get: {
              main: { title: 'Current Time' },
              extended: { title: 'Extended' }
            }
          }
        }
      }
    },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  // Both declared variants dispatch — proving the dotted path resolved
  // to its enrichment block instead of falling back to single-'main'.
  const results = toVariantResults(captures, 'form-gen')
  assertEquals(results.map(r => r.variant).sort(), ['extended', 'main'])
  assertEquals(transform.calls.length, 2)
})
