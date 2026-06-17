/**
 * Coverage for the webhook subject at the engine boundary — the webhook
 * analogue of GenerateContext.variants.test.ts. Exercises the dispatch
 * invariants via a transform-spy (no real Driver needed):
 *
 *   1. Absent enrichment → single `'main'` dispatch.
 *   2. Multi-variant enrichment → one transform per variant.
 *   3. Non-`'main'` variant declared without `'main'` → engine throws.
 *   4. ISOLATION: a webhook generator runs only over `document.webhooks`,
 *      an operation generator only over `document.operations` — neither
 *      ever sees the other's subject. This is the load-bearing Phase 4
 *      invariant (inverted webhook semantics must never reach a client
 *      generator).
 *
 * Driver-level guards (peer-variant / peer-support / generatorKey
 * collision) mirror OasOperationDriver's and are covered there + in
 * GeneratorKeys.test.ts.
 */

import { assertEquals, assertThrows } from '@std/assert'
import { spy, type Spy } from '@std/testing/mock'
import * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { ResultType } from '@/types/Results.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

type Method = 'get' | 'post' | 'patch'
type WebhookTransformArgs = { context: unknown; webhook: OasWebhook; variant: string }
type OperationTransformArgs = { context: unknown; operation: OasOperation; variant: string }

const makeDoc = (args: {
  operations?: Array<{ path: string; method: Method }>
  webhooks?: Array<{ name: string; method: Method }>
}) =>
  new OasDocument({
    openapi: '3.1.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: (args.operations ?? []).map(
      ({ path, method }) => new OasOperation({ path, method, pathItem: undefined, responses: {} })
    ),
    webhooks: (args.webhooks ?? []).map(
      ({ name, method }) => new OasWebhook({ name, method, pathItem: undefined, responses: {} })
    )
  })

const buildContext = (args: {
  document: OasDocument
  settings: unknown
  generators: Record<string, unknown>
}) => {
  const captures: { result: ResultType; trail: string }[] = []
  const captureCurrentResult = spy((result: ResultType, trail: StackTrail) => {
    captures.push({ result, trail: trail.toString() })
  })

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

const makeWebhookGen = (id: string, transform?: Spy) => ({
  id,
  type: 'webhook' as const,
  transform: transform ?? spy(() => undefined),
  isSupported: () => true
})

const makeOpGen = (id: string, transform?: Spy) => ({
  id,
  type: 'oasOperation' as const,
  transform: transform ?? spy(() => undefined),
  isSupported: () => true
})

Deno.test('webhooks - no enrichment block dispatches a single `main` variant', () => {
  const transform: Spy<undefined, [WebhookTransformArgs], unknown> = spy(
    (_args: WebhookTransformArgs) => undefined
  )
  const { context } = buildContext({
    document: makeDoc({ webhooks: [{ name: 'newPet', method: 'post' }] }),
    settings: { skip: [] },
    generators: { 'wh-gen': makeWebhookGen('wh-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  assertEquals(transform.calls.length, 1)
  assertEquals(transform.calls[0].args[0].variant, 'main')
  assertEquals(transform.calls[0].args[0].webhook.name, 'newPet')
})

Deno.test('webhooks - multi-variant enrichment fans out one transform per declared variant', () => {
  const transform: Spy<undefined, [WebhookTransformArgs], unknown> = spy(
    (_args: WebhookTransformArgs) => undefined
  )
  const { context } = buildContext({
    document: makeDoc({ webhooks: [{ name: 'newPet', method: 'post' }] }),
    settings: {
      enrichments: {
        'wh-gen': { newPet: { post: { main: {}, customer: {} } } }
      }
    },
    generators: { 'wh-gen': makeWebhookGen('wh-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  assertEquals(transform.calls.length, 2)
  assertEquals(
    transform.calls.map(c => c.args[0].variant),
    ['main', 'customer']
  )
})

Deno.test('webhooks - declared variants without `main` throws at engine dispatch', () => {
  const { context } = buildContext({
    document: makeDoc({ webhooks: [{ name: 'newPet', method: 'post' }] }),
    settings: { enrichments: { 'wh-gen': { newPet: { post: { customer: {} } } } } },
    generators: { 'wh-gen': makeWebhookGen('wh-gen') }
  })

  assertThrows(() => context.toArtifacts(new StackTrail(['test'])))
})

Deno.test('webhooks - webhook and operation generators stay isolated', () => {
  const whTransform: Spy<undefined, [WebhookTransformArgs], unknown> = spy(
    (_args: WebhookTransformArgs) => undefined
  )
  const opTransform: Spy<undefined, [OperationTransformArgs], unknown> = spy(
    (_args: OperationTransformArgs) => undefined
  )
  const { context } = buildContext({
    document: makeDoc({
      operations: [{ path: '/pets', method: 'get' }],
      webhooks: [{ name: 'newPet', method: 'post' }]
    }),
    settings: { skip: [] },
    generators: {
      'wh-gen': makeWebhookGen('wh-gen', whTransform),
      'op-gen': makeOpGen('op-gen', opTransform)
    }
  })
  context.toArtifacts(new StackTrail(['test']))

  // the webhook generator saw exactly the webhook, never the operation
  assertEquals(whTransform.calls.length, 1)
  assertEquals(whTransform.calls[0].args[0].webhook.name, 'newPet')

  // the operation generator saw exactly the operation, never the webhook
  assertEquals(opTransform.calls.length, 1)
  assertEquals(opTransform.calls[0].args[0].operation.path, '/pets')
})

Deno.test('webhooks - per-(name, method, variant) skip removes only the matched webhook variant', () => {
  const transform: Spy<undefined, [WebhookTransformArgs], unknown> = spy(
    (_args: WebhookTransformArgs) => undefined
  )
  const { context } = buildContext({
    document: makeDoc({
      webhooks: [
        { name: 'newPet', method: 'post' },
        { name: 'petUpdated', method: 'post' }
      ]
    }),
    settings: {
      // skip is keyed by webhook name in the path slot (reusing the
      // operation filter shape); `[]` means every variant of that method.
      skip: [{ 'wh-gen': { newPet: { post: [] } } }]
    },
    generators: { 'wh-gen': makeWebhookGen('wh-gen', transform) }
  })
  context.toArtifacts(new StackTrail(['test']))

  // newPet skipped; petUpdated still transformed
  assertEquals(transform.calls.length, 1)
  assertEquals(transform.calls[0].args[0].webhook.name, 'petUpdated')
})
