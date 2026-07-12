/**
 * Webhook variant fan-out + cross-generator composition through the REAL
 * Driver path. The webhook analogue of GenerateContext.cross-variant.test.ts
 * and GenerateContext.normalized-model-variants.test.ts.
 *
 *   1. Fan-out: a variants-aware webhook projection (`toIdentifierName` via
 *      `withVariant`) emits one distinct file + Definition per declared
 *      variant.
 *   2. Cross-gen `insertWebhook`: a caller webhook projection inserts a
 *      variants-unaware peer webhook. The peer Definition is registered
 *      exactly once (both caller variants hit the same `'main'` cache key)
 *      and each caller file gets an import pointing at the peer's file.
 *
 * These pin the user-visible value of the variant axis for webhooks (the
 * spy-based dispatch invariants live in GenerateContext.webhooks.test.ts).
 */

import { assertEquals, assertExists, assertInstanceOf, assertStringIncludes } from '@std/assert'
import type * as log from '@std/log'
import * as v from 'valibot'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasWebhook } from '@/oas/webhook/Webhook.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { toTsWebhookProjectionBase } from '@skmtc/lang-typescript'
import { toWebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// Per-variant subject marker (`{}`) parsed as an opaque subject leaf, the
// generator / stack scopes left absent — mirrors the form fixtures.
const variantEnrichmentSchema = v.object({
  subject: v.optional(v.unknown()),
  generator: v.optional(v.unknown()),
  stack: v.optional(v.unknown())
})

const cap = (name: string): string => `${name[0].toUpperCase()}${name.slice(1)}`

const NAME = 'newPet'
const METHOD = 'post' as const

const makeDoc = () =>
  new OasDocument({
    openapi: '3.1.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    webhooks: [new OasWebhook({ name: NAME, method: METHOD, pathItem: undefined, responses: {} })]
  })

// ============================================================================
// 1. Variant fan-out → distinct files + Definitions
// ============================================================================

// Variants-aware handler: identifier AND export path fold `variant`, so each
// variant produces its own (name, exportPath) pair.
const FanoutBase = toTsWebhookProjectionBase({
  id: '@test/fanout-webhook',
  toIdentifierName: ({ webhook, variant }) => withVariant(`${cap(webhook.name)}Handler`, variant),
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ webhook, variant }) =>
    `@/webhooks/${withVariant(`${cap(webhook.name)}Handler`, variant)}.ts`,
  toEnrichmentSchema: () => variantEnrichmentSchema
})

class FanoutHandler extends FanoutBase {
  override toString() {
    return `(payload: unknown) => void`
  }
}

Deno.test('webhook variants - variants-aware handler emits a distinct file per declared variant', () => {
  const entry = toWebhookEntry({
    id: '@test/fanout-webhook',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, webhook, variant }) => {
      context.insertWebhook({ projection: FanoutHandler, webhook, variant })
    }
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: makeDoc() },
    settings: {
      enrichments: {
        '@test/fanout-webhook': {
          [NAME]: { [METHOD]: { main: {}, customer: {} } }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/fanout-webhook': entry }) as any
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const mainFile = files.get('@/webhooks/NewPetHandler.generated.ts')
  const customerFile = files.get('@/webhooks/NewPetHandlerCustomer.generated.ts')

  assertExists(mainFile, 'main-variant file should exist')
  assertExists(customerFile, 'customer-variant file should exist')

  assertInstanceOf(mainFile, CodeFileBase)
  assertInstanceOf(customerFile, CodeFileBase)
  assertExists(mainFile.findDefinitions({ name: 'NewPetHandler' }))
  assertEquals(mainFile.findDefinitions({ name: 'NewPetHandlerCustomer' }), undefined)

  assertExists(customerFile.findDefinitions({ name: 'NewPetHandlerCustomer' }))
  assertEquals(customerFile.findDefinitions({ name: 'NewPetHandler' }), undefined)
})

// ============================================================================
// 2. Cross-gen insertWebhook — peer deduped + import registered
// ============================================================================

// Variants-unaware peer webhook: its identifier IGNORES variant, so both
// caller variants share one (name, exportPath) cache key.
const PeerBase = toTsWebhookProjectionBase({
  id: '@test/peer-webhook',
  toIdentifierName: ({ webhook }) => `${cap(webhook.name)}Ack`,
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ webhook }) => `@/webhooks/shared/${cap(webhook.name)}Ack.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PeerHandler extends PeerBase {
  override toString() {
    return `(ack: unknown) => void`
  }
}

// Variants-aware caller: composes with the peer webhook via
// `context.insertWebhook` (no variant arg → Driver defaults to `'main'`).
const CallerBase = toTsWebhookProjectionBase({
  id: '@test/caller-webhook',
  toIdentifierName: ({ webhook, variant }) => withVariant(`${cap(webhook.name)}Handler`, variant),
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath: ({ webhook, variant }) =>
    `@/webhooks/${withVariant(`${cap(webhook.name)}Handler`, variant)}.ts`,
  toEnrichmentSchema: () => variantEnrichmentSchema
})

class CallerHandler extends CallerBase {
  ackName: string

  constructor(args: {
    context: GenerateContextType
    webhook: OasWebhook
    settings: ConstructorParameters<typeof CallerBase>[0]['settings']
  }) {
    super(args)

    // Insert the variants-unaware peer webhook into this projection's file.
    // No `variant` → both caller variants resolve the peer at `'main'` and
    // share its single Definition; the Driver registers the import because
    // the peer's exportPath differs from this file.
    this.ackName = this.context
      .insertWebhook({
        projection: PeerHandler,
        webhook: args.webhook,
        destinationPath: this.settings.exportPath
      })
      .toName()
  }

  override toString() {
    return `(payload: { ack: ${this.ackName} }) => void`
  }
}

Deno.test('webhook variants - inserted peer webhook is deduped and imported into each caller file', () => {
  const callerEntry = toWebhookEntry({
    id: '@test/caller-webhook',
    toEnrichmentSchema: () => variantEnrichmentSchema,
    transform: ({ context, webhook, variant }) => {
      context.insertWebhook({ projection: CallerHandler, webhook, variant })
    }
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: makeDoc() },
    settings: {
      enrichments: {
        '@test/caller-webhook': {
          [NAME]: { [METHOD]: { main: {}, customer: {} } }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/caller-webhook': callerEntry }) as any
  })

  const { files } = context.toArtifacts(new StackTrail(['test']))

  const peerFile = files.get('@/webhooks/shared/NewPetAck.generated.ts')
  const mainFile = files.get('@/webhooks/NewPetHandler.generated.ts')
  const customerFile = files.get('@/webhooks/NewPetHandlerCustomer.generated.ts')

  assertExists(peerFile, 'peer webhook file should exist')
  assertExists(mainFile, 'main-variant caller file should exist')
  assertExists(customerFile, 'customer-variant caller file should exist')

  // Peer Definition registered exactly once — both caller variants hit the
  // same (name, exportPath) cache key.
  assertInstanceOf(peerFile, CodeFileBase)
  const peerDefinitions = peerFile.findDefinitions()
  assertExists(peerDefinitions)
  assertEquals(
    peerDefinitions.length,
    1,
    `peer file should have exactly one Definition, got: ${peerDefinitions
      .map(definition => definition.identifier.name)
      .join(', ')}`
  )
  assertEquals(peerDefinitions[0].identifier.name, 'NewPetAck')

  // Each caller-variant file imports `NewPetAck` from the peer file.
  assertInstanceOf(mainFile, CodeFileBase)
  assertStringIncludes(
    mainFile.toString(),
    `import type {NewPetAck} from '@/webhooks/shared/NewPetAck.generated.ts'`,
    'main-variant file should import the peer webhook'
  )

  assertInstanceOf(customerFile, CodeFileBase)
  assertStringIncludes(
    customerFile.toString(),
    `import type {NewPetAck} from '@/webhooks/shared/NewPetAck.generated.ts'`,
    'customer-variant file should import the peer webhook'
  )
})
