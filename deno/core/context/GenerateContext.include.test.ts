/**
 * Coverage for `ClientSettings.include` — the allow-list counterpart
 * to `skip`. Verifies every documented edge case from the design pass:
 *
 *   1. `include` undefined ⇒ backwards compat (everything emits)
 *   2. `include: []` ⇒ forgiving (treated as undefined)
 *   3. `include: ['gen-X']` ⇒ string form is a no-op (include is
 *      per-generator; gen-X runs, others unaffected)
 *   4. `include: [{ 'gen-X': { '/foo': ['get'] } }]` ⇒ per-op filter
 *   5. Generators not mentioned run normally (include is per-generator,
 *      not document-global)
 *   6. Per-op miss ⇒ captured as `skipped`
 *   7. `include` + `skip` overlap ⇒ skipped wins (`skip` runs after `include`)
 *   8. Hybrid array (string + object entries)
 *   9. Empty per-op dict `{ 'gen-X': {} }` ⇒ everything from gen-X is skipped
 *  10. Per-model include works on model generators
 *  11. Wrong shape (operations dict on model generator) ⇒ no per-model filter
 *  12. Order: isSupported still wins over include (notSupported, not skipped)
 */

import { assertEquals, assertExists } from '@std/assert'
import { spy, type Spy } from '@std/testing/mock'
import * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import type { ResultType } from '@/types/Results.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

type CaptureEntry = { result: ResultType; trail: string }

const makeOasDoc = (
  ops: Array<{ path: string; method: 'get' | 'post' | 'put' | 'delete' }>,
  schemaNames: string[] = []
) =>
  new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: ops.map(
      ({ path, method }) =>
        new OasOperation({ path, method, pathItem: undefined, responses: {} })
    ),
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
    // deno-lint-ignore no-explicit-any — settings shape is verified at runtime
    settings: args.settings as any,
    logger: mockLogger,
    captureCurrentResult,
    // deno-lint-ignore no-explicit-any — minimal generator mock
    toGeneratorConfigMap: () => args.generators as any
  })

  return { context, captures, captureCurrentResult }
}

type OpResult = { path: string; method: string; result: ResultType }

/**
 * Helper: turn raw `captures` from the spy into a per-op report.
 *
 * `StackTrail.toString()` joins its stack with `:`, and any `:`
 * INSIDE a frame name is URL-escaped to `%3A`. So a trail built by
 *   `new StackTrail(['test']).trace(generatorId, …).trace('${path}:${method}', …)`
 * comes out as `test:gen-id:/customers%3Apost`.
 *
 * Parse it back by splitting on `:` and unescaping the leaf.
 */
const toOpResults = (captures: CaptureEntry[], generatorId: string): OpResult[] => {
  const out: OpResult[] = []
  for (const c of captures) {
    const segments = c.trail.split(':')
    // Only operation-level captures have the gen-id followed by an
    // op-shaped leaf. Find the gen-id segment; the leaf must come
    // immediately after.
    const idIdx = segments.indexOf(generatorId)
    if (idIdx === -1 || idIdx >= segments.length - 1) continue
    const leaf = segments[idIdx + 1]?.replaceAll('%3A', ':') ?? ''
    const colon = leaf.lastIndexOf(':')
    if (colon === -1) continue
    out.push({
      path: leaf.slice(0, colon),
      method: leaf.slice(colon + 1),
      result: c.result
    })
  }
  return out
}

/**
 * Helper for model-generator tests: refNames are the leaf in a trail
 * like `test:ts-gen:User`. Returns a refName → result map.
 */
const toModelResults = (
  captures: CaptureEntry[],
  generatorId: string
): Record<string, ResultType> => {
  const out: Record<string, ResultType> = {}
  for (const c of captures) {
    const segments = c.trail.split(':')
    const idIdx = segments.indexOf(generatorId)
    if (idIdx === -1 || idIdx >= segments.length - 1) continue
    const refName = segments[idIdx + 1]
    out[refName] = c.result
  }
  return out
}

// ─── Test fixtures ────────────────────────────────────────────────

const operations = [
  { path: '/customers', method: 'post' as const },
  { path: '/customers', method: 'get' as const },
  { path: '/locations', method: 'post' as const },
  { path: '/orders', method: 'get' as const }
]

const makeGen = (id: string, transformSpy?: Spy) => ({
  id,
  type: 'oasOperation' as const,
  transform: transformSpy ?? spy(() => undefined),
  isSupported: () => true
})

const makeModelGen = (id: string, transformSpy?: Spy) => ({
  id,
  type: 'model' as const,
  transform: transformSpy ?? spy(() => undefined)
})

// ─── Case 1: include undefined → everything emits ─────────────────

Deno.test('include - undefined leaves existing behavior unchanged', () => {
  const transform = spy(() => undefined)
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: { skip: [] },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  assertEquals(results.length, 4)
  assertEquals(
    results.every(r => r.result === 'success'),
    true,
    `Expected every op to succeed when include is unset, got: ${JSON.stringify(results)}`
  )
})

// ─── Case 2: include: [] → forgiving, same as undefined ───────────

Deno.test('include - empty array is treated as no filter active', () => {
  const transform = spy(() => undefined)
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: { include: [] },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  assertEquals(results.length, 4)
  assertEquals(
    results.every(r => r.result === 'success'),
    true,
    `Empty include must not act as "exclude everything": ${JSON.stringify(results)}`
  )
})

// ─── Case 3: include: ['gen-X'] → only gen-X runs ─────────────────

Deno.test('include - string entry is a no-op; unmentioned generators still run (per-generator)', () => {
  const txA = spy(() => undefined)
  const txB = spy(() => undefined)
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: { include: ['gen-A'] },
    generators: {
      'gen-A': makeGen('gen-A', txA),
      'gen-B': makeGen('gen-B', txB)
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  // gen-A: every op succeeds. A bare-string include entry carries no
  // per-op filter, so gen-A runs default-on.
  const resultsA = toOpResults(captures, 'gen-A')
  assertEquals(
    resultsA.every(r => r.result === 'success'),
    true,
    `gen-A should run for every op: ${JSON.stringify(resultsA)}`
  )
  assertEquals(resultsA.length, 4)

  // gen-B: also runs every op. `include` is per-generator — a
  // generator absent from `include` is unaffected and stays
  // default-on. (The previous global behaviour, where a non-empty
  // `include` silently excluded every unmentioned generator, was
  // removed in favour of per-generator semantics.)
  const resultsB = toOpResults(captures, 'gen-B')
  assertEquals(
    resultsB.every(r => r.result === 'success'),
    true,
    `gen-B should run default-on when not mentioned in include: ${JSON.stringify(resultsB)}`
  )
  assertEquals(resultsB.length, 4)
})

// ─── Case 4: per-op filter via object entry ──────────────────────

Deno.test('include - object entry restricts emission to listed (path, method) pairs', () => {
  const transform = spy(() => undefined)
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: {
      include: [{ 'form-gen': { '/customers': { post: [] }, '/locations': { post: [] } } }]
    },
    generators: { 'form-gen': makeGen('form-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  const successes = results.filter(r => r.result === 'success')
  const skipped = results.filter(r => r.result === 'skipped')

  assertEquals(successes.length, 2)
  assertEquals(
    successes.every(
      r =>
        (r.path === '/customers' && r.method === 'post') ||
        (r.path === '/locations' && r.method === 'post')
    ),
    true,
    `Wrong ops succeeded: ${JSON.stringify(successes)}`
  )
  assertEquals(skipped.length, 2)
})

// ─── Case 6: per-op miss → captured as `skipped` ─────────────────

Deno.test('include - operations outside the allow-list emit `skipped` (not silent)', () => {
  // This is the diagnostic guarantee: per-op misses ARE visible in
  // the manifest (as `skipped`), unlike the whole-generator silent
  // exclusion. The operator can grep results to see which ops were
  // gated out.
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/customers', method: 'post' }]),
    settings: { include: [{ 'form-gen': { '/locations': { post: [] } } }] },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  assertEquals(results.length, 1)
  assertEquals(results[0].result, 'skipped')
})

// ─── Case 7: include + skip overlap → skipped wins ────────────────

Deno.test('include + skip - skip runs after include; overlap is skipped', () => {
  // POST /customers is in the include allow-list AND in the skip
  // deny-list. The documented precedence (include first, skip
  // second) means it ends up `skipped`.
  const { context, captures } = buildContext({
    document: makeOasDoc([{ path: '/customers', method: 'post' }]),
    settings: {
      include: [{ 'form-gen': { '/customers': { post: [] } } }],
      skip: [{ 'form-gen': { '/customers': { post: [] } } }]
    },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  assertEquals(results.length, 1)
  assertEquals(results[0].result, 'skipped')
})

// ─── Case 8: hybrid array (string + object) ──────────────────────

Deno.test('include - hybrid entries: string for one gen, object for another', () => {
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: {
      include: [
        'gen-A', // whole generator
        { 'gen-B': { '/customers': { post: [] } } } // per-op
      ]
    },
    generators: {
      'gen-A': makeGen('gen-A'),
      'gen-B': makeGen('gen-B'),
      'gen-C': makeGen('gen-C') // not mentioned anywhere
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  // gen-A: every op succeeds (string form, no per-op filter).
  const a = toOpResults(captures, 'gen-A')
  assertEquals(a.length, 4)
  assertEquals(a.every(r => r.result === 'success'), true)

  // gen-B: only POST /customers succeeds; the other 3 are skipped.
  const b = toOpResults(captures, 'gen-B')
  assertEquals(b.length, 4)
  assertEquals(b.filter(r => r.result === 'success').length, 1)
  assertEquals(b.filter(r => r.result === 'skipped').length, 3)

  // gen-C: not mentioned in `include` at all — runs default-on.
  // `include` is per-generator; omission does not exclude.
  const c = toOpResults(captures, 'gen-C')
  assertEquals(c.length, 4)
  assertEquals(c.every(r => r.result === 'success'), true)
})

// ─── Case 9: empty per-op dict → everything skipped for that gen ─

Deno.test('include - empty operations dict on a generator filters out all its ops', () => {
  const { context, captures } = buildContext({
    document: makeOasDoc(operations),
    settings: { include: [{ 'form-gen': {} }] },
    generators: { 'form-gen': makeGen('form-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const results = toOpResults(captures, 'form-gen')
  assertEquals(results.length, 4)
  // Generator was admitted by whole-generator gate (mentioned in
  // include), but per-op filter matches nothing — so every op is
  // captured as `skipped`.
  assertEquals(
    results.every(r => r.result === 'skipped'),
    true,
    `All ops should be skipped when per-op filter is empty: ${JSON.stringify(results)}`
  )
})

// ─── Case 10: model include ──────────────────────────────────────

Deno.test('include - per-model filter restricts emission to listed refNames', () => {
  const doc = makeOasDoc([], ['User', 'Order', 'Product'])
  const { context, captures } = buildContext({
    document: doc,
    settings: { include: [{ 'ts-gen': { 'User': [], 'Product': [] } }] },
    generators: { 'ts-gen': makeModelGen('ts-gen') }
  })
  context.toArtifacts(new StackTrail(['test']))

  const byRef = toModelResults(captures, 'ts-gen')
  assertEquals(byRef['User'], 'success')
  assertEquals(byRef['Product'], 'success')
  assertEquals(byRef['Order'], 'skipped')
})

// ─── Case 11: wrong shape → forgiving (no per-model filter active) ─

Deno.test(
  'include - operations-shape entry on a model generator does not activate per-model filter',
  () => {
    // Edge: user wrote an operations-shaped entry (`{ 'ts-gen': {...} }`)
    // but `ts-gen` is a model generator. `toIncludeModels` returns
    // undefined (not an array), so no per-model filter is applied —
    // the generator is admitted by the whole-generator gate and emits
    // for every refName. Forgiving interpretation matches existing
    // skip behavior.
    const doc = makeOasDoc([], ['User', 'Order'])
    const { context, captures } = buildContext({
      document: doc,
      settings: { include: [{ 'ts-gen': { '/users': { get: [] } } }] },
      generators: { 'ts-gen': makeModelGen('ts-gen') }
    })
    context.toArtifacts(new StackTrail(['test']))

    const byRef = toModelResults(captures, 'ts-gen')
    // Both refNames emit success — no per-model filter active.
    assertEquals(byRef['User'], 'success')
    assertEquals(byRef['Order'], 'success')
  }
)

// ─── Case 12: isSupported still wins (notSupported, not skipped) ─

Deno.test(
  'include - isSupported runs first; unsupported ops emit notSupported even if included',
  () => {
    // The operation is in the include allow-list, but `isSupported`
    // returns false. We must see `notSupported`, NOT `skipped` —
    // include should not mask capability rejection.
    const transform = spy(() => undefined)
    const { context, captures } = buildContext({
      document: makeOasDoc([{ path: '/customers', method: 'post' }]),
      settings: { include: [{ 'form-gen': { '/customers': { post: [] } } }] },
      generators: {
        'form-gen': {
          id: 'form-gen',
          type: 'oasOperation' as const,
          transform,
          isSupported: () => false
        }
      }
    })
    context.toArtifacts(new StackTrail(['test']))

    const results = toOpResults(captures, 'form-gen')
    assertEquals(results.length, 1)
    assertEquals(results[0].result, 'notSupported')
  }
)

// ─── Bonus: include array with a GQL generator does not crash ─────

Deno.test('include - an include array containing a GQL generator is handled cleanly', () => {
  // `include` entries are protocol-neutral. With a GQL generator and
  // an OAS document the generator simply isn't dispatched (its type
  // doesn't match the document) — the point of this test is that
  // `toArtifacts` handles the mixed config without crashing.
  const { context } = buildContext({
    document: makeOasDoc([]),
    settings: { include: ['gql-gen'] },
    generators: {
      'gql-gen': {
        id: 'gql-gen',
        type: 'gqlOperation' as const,
        transform: spy(() => undefined),
        isSupported: () => true
      }
    }
  })
  // Should not throw.
  const stackTrail = new StackTrail(['test'])
  const result = context.toArtifacts(stackTrail)
  assertExists(result)
})
