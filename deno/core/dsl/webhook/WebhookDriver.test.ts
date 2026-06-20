/**
 * Driver-level coverage for the webhook insertion lifecycle — the webhook
 * analogue of `OasOperationDriver.test.ts`. Exercises the three invariants
 * §4 calls out (peer-support guard, peer-variant guard, generatorKey
 * collision) plus the surrounding lifecycle (content-settings call, cross-file
 * import registration, Definition caching) the operation Driver pins.
 *
 * The webhook key carries a literal `webhook` discriminator segment
 * (`id|webhook|name|method|variant`), so a variant-mismatch collision throws
 * the same "Registered definition mismatch" the operation Driver does.
 */

import { createVariable, typescript, TsDefinition } from '@skmtc/lang-typescript'
import { assertEquals, assertExists, assert, assertThrows } from '@std/assert'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'
import { WebhookDriver } from './WebhookDriver.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type {
  WebhookProjection,
  ToWebhookIdentifierNameArgs,
  ToWebhookExportPathArgs
} from '@/dsl/webhook/types.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import { toWebhookGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { Method } from '@/types/Method.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'

// ============================================================================
// Test Helpers
// ============================================================================

// Mock GenerateContext — mirrors the operation Driver's helper but exposes
// `toWebhookContentSettings` (the method the webhook Driver calls) and a
// settable `settings` field (read by the peer-variant guard).
const createMockContext = (options?: {
  // deno-lint-ignore no-explicit-any
  findDefinition?: DefinitionBase<any> | undefined
  // deno-lint-ignore no-explicit-any
  settings?: any
}) => {
  // deno-lint-ignore no-explicit-any
  const toWebhookContentSettingsSpy = spy((args: any) => {
    const variant: string = args.variant ?? 'main'
    const enrichments = args.projection.toEnrichments({
      webhook: args.webhook,
      context: mockContext,
      variant
    })
    return new ContentSettings({
      identifier: args.projection.lang.toIdentifier({
        name: args.projection.toIdentifierName({ webhook: args.webhook, enrichments, variant }),
        ...args.projection.toIdentifierType(args.webhook, mockContext)
      }),
      exportPath: args.projection.toExportPath({ webhook: args.webhook, enrichments, variant }),
      enrichments,
      variant
    })
  })

  // deno-lint-ignore no-explicit-any
  const findDefinitionSpy = spy((_args: any) => options?.findDefinition)
  // deno-lint-ignore no-explicit-any
  const registerSpy = spy((_args: any) => {})

  const mockContext = {
    settings: options?.settings,
    toWebhookContentSettings: toWebhookContentSettingsSpy,
    findDefinition: findDefinitionSpy,
    register: registerSpy,
    getFile: spy(() => undefined),
    addFile: spy(() => {})
  } as unknown as GenerateContextType

  return {
    context: mockContext,
    toWebhookContentSettingsSpy,
    findDefinitionSpy,
    registerSpy
  }
}

const createMockWebhook = (options?: { name?: string; method?: Method }): OasWebhook =>
  new OasWebhook({
    name: options?.name ?? 'newPet',
    method: (options?.method ?? 'post') as Method,
    pathItem: undefined,
    responses: {}
  })

// Mock WebhookProjection — the webhook sibling of `createMockProjection`.
// The instance IS the generated value (has `toString()`); the constructor
// injects the webhook generatorKey, matching what the projection base does.
const createMockProjection = (options?: {
  id?: string
  exportPath?: string
  // deno-lint-ignore no-explicit-any
  enrichments?: any
  isSupported?: () => boolean
  // Variants-aware: fold `variant` into the name. Off by default — the
  // common variants-unaware projection ignores `variant` and so collides
  // across variants (the case the collision test exercises).
  variantAware?: boolean
}): WebhookProjection<SnippetBase, undefined> => {
  class MockProjection extends SnippetBase {
    static id = options?.id ?? 'MockWebhookGen'
    static type = 'webhook' as const
    static lang = typescript
    static isSupported = options?.isSupported

    static toIdentifierName({ webhook, variant }: ToWebhookIdentifierNameArgs): string {
      return options?.variantAware && variant !== 'main' ? `${webhook.name}_${variant}` : webhook.name
    }

    static toIdentifierType(): IdentifierType {
      return { kind: 'type' }
    }

    static toExportPath({ webhook }: ToWebhookExportPathArgs): string {
      return options?.exportPath ?? `./webhooks/${webhook.name}.ts`
    }

    static toEnrichments(): undefined {
      return options?.enrichments
    }

    settings: ContentSettings<undefined>
    webhook: OasWebhook

    constructor(args: {
      context: GenerateContextType
      settings: ContentSettings<undefined>
      webhook: OasWebhook
    }) {
      const generatorKey = toWebhookGeneratorKey({
        generatorId: MockProjection.id,
        webhook: args.webhook,
        variant: args.settings.variant ?? 'main'
      })

      super({ context: args.context, generatorKey })

      this.settings = args.settings
      this.webhook = args.webhook
    }

    override toString(): string {
      return 'mock webhook handler'
    }
  }

  // deno-lint-ignore no-explicit-any
  return MockProjection as any
}

// ============================================================================
// Tests
// ============================================================================

Deno.test('WebhookDriver', async t => {
  await t.step('Constructor and Property Initialization', async t => {
    await t.step('should initialize all required properties correctly', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertEquals(driver.context, context)
      assertEquals(driver.projection, projection)
      assertEquals(driver.webhook, webhook)
      assertExists(driver.settings)
      assertExists(driver.definition)
    })

    await t.step('should initialize with all optional parameters', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({
        context,
        projection,
        webhook,
        destinationPath: './custom/path.ts',
        noExport: true,
        variant: 'main'
      })

      assertEquals(driver.destinationPath, './custom/path.ts')
      assertEquals(driver.noExport, true)
    })

    await t.step('should call context.toWebhookContentSettings during construction', () => {
      const { context, toWebhookContentSettingsSpy } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertSpyCalls(toWebhookContentSettingsSpy, 1)
      assertSpyCall(toWebhookContentSettingsSpy, 0, {
        args: [{ webhook, projection, variant: 'main' }]
      })
    })

    await t.step('should set settings from toWebhookContentSettings result', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook({ name: 'petUpdated' })

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertEquals(driver.settings.identifier.name, 'petUpdated')
      assertExists(driver.settings.exportPath)
    })

    await t.step('should handle different HTTP methods', () => {
      const methods: Method[] = ['get', 'post', 'put', 'delete', 'patch']

      methods.forEach(method => {
        const { context } = createMockContext()
        const projection = createMockProjection()
        const webhook = createMockWebhook({ method })

        const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

        assertEquals(driver.webhook.method, method)
        assertExists(driver.definition)
      })
    })

    await t.step('should preserve enrichment type information', () => {
      const { context } = createMockContext()
      const enrichments = { customData: 'test' }
      const projection = createMockProjection({ enrichments })
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertEquals(driver.settings.enrichments, enrichments)
    })
  })

  await t.step('Import Registration Logic', async t => {
    await t.step('should register import when destinationPath differs from exportPath', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './webhooks/newPet.ts' })
      const webhook = createMockWebhook({ name: 'newPet' })

      new WebhookDriver({
        context,
        projection,
        webhook,
        destinationPath: './handlers/index.ts',
        variant: 'main'
      })

      // Once for the definition, once for the cross-file import.
      assertSpyCalls(registerSpy, 2)

      const importCall = registerSpy.calls.find(call => call.args[0].imports !== undefined)
      assertExists(importCall)
      assertEquals(importCall.args[0].imports[0].mergeKey(), './webhooks/newPet.ts')
      // The handler identifier is `kind: 'type'`, so the import collapses to
      // a statement-level `import type { … }` (the representative form for a
      // generator emitting `export type`).
      assertEquals(
        importCall.args[0].imports[0].toString(),
        `import type {newPet} from './webhooks/newPet.ts'`
      )
      assertEquals(importCall.args[0].destinationPath, './handlers/index.ts')
    })

    await t.step('should not register import when paths match', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './webhooks/newPet.ts' })
      const webhook = createMockWebhook({ name: 'newPet' })

      new WebhookDriver({
        context,
        projection,
        webhook,
        destinationPath: './webhooks/newPet.ts',
        variant: 'main'
      })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should not register import when destinationPath is undefined', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './webhooks/newPet.ts' })
      const webhook = createMockWebhook()

      new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })

    await t.step('should normalize paths before comparison', () => {
      const { context, registerSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './webhooks//newPet.ts' })
      const webhook = createMockWebhook()

      new WebhookDriver({
        context,
        projection,
        webhook,
        destinationPath: './webhooks/newPet.ts',
        variant: 'main'
      })

      // Same path after normalization → no import.
      assertSpyCalls(registerSpy, 1)
      assertEquals(registerSpy.calls[0].args[0].imports, undefined)
    })
  })

  await t.step('Definition Caching', async t => {
    await t.step('should call context.findDefinition with correct arguments', () => {
      const { context, findDefinitionSpy } = createMockContext()
      const projection = createMockProjection({ exportPath: './webhooks/test.ts' })
      const webhook = createMockWebhook({ name: 'testHook' })

      new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertSpyCalls(findDefinitionSpy, 1)
      assertSpyCall(findDefinitionSpy, 0, {
        args: [{ name: 'testHook', exportPath: './webhooks/test.ts' }]
      })
    })

    await t.step('should create new definition when not cached', () => {
      const { context, findDefinitionSpy } = createMockContext({ findDefinition: undefined })
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertSpyCalls(findDefinitionSpy, 1)
      assert(driver.definition instanceof DefinitionBase)
    })

    await t.step('should instantiate projection with correct parameters', () => {
      const { context } = createMockContext()
      // deno-lint-ignore no-explicit-any
      let capturedArgs: any = null

      class SpyProjection extends SnippetBase {
        static id = 'SpyWebhookGen'
        static type = 'webhook' as const
        static lang = typescript
        static toIdentifierName = ({ webhook }: ToWebhookIdentifierNameArgs) => webhook.name
        static toIdentifierType = (): IdentifierType => ({ kind: 'type' })
        static toExportPath = (_args: ToWebhookExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined
        static createIdentifier = (name: string) => createVariable(name)

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          webhook: OasWebhook
        }) {
          super({
            context: args.context,
            generatorKey: toWebhookGeneratorKey({
              generatorId: 'SpyWebhookGen',
              webhook: args.webhook,
              variant: 'main'
            })
          })
          capturedArgs = args
        }

        override toString() {
          return 'test'
        }
      }

      const webhook = createMockWebhook({ name: 'testHook' })

      // deno-lint-ignore no-explicit-any
      new WebhookDriver({ context, projection: SpyProjection as any, webhook, variant: 'main' })

      assertExists(capturedArgs)
      assertEquals(capturedArgs.context, context)
      assertEquals(capturedArgs.webhook, webhook)
      assertExists(capturedArgs.settings)
    })

    await t.step('should use cached definition when available', () => {
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      // deno-lint-ignore no-explicit-any
      const mockContext = {} as any
      const cachedValue = new projection({
        context: mockContext,
        settings: new ContentSettings({
          identifier: createVariable('newPet'),
          exportPath: './webhooks/newPet.ts',
          enrichments: undefined,
          variant: 'main'
        }),
        webhook
      })

      const cachedDef = new TsDefinition({
        context: mockContext,
        identifier: createVariable('newPet'),
        value: cachedValue
      })

      const { context } = createMockContext({ findDefinition: cachedDef })

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertEquals(driver.definition, cachedDef)
    })

    await t.step('should skip instantiation when definition cached', () => {
      let instantiated = false

      class TrackingProjection extends SnippetBase {
        static id = 'TrackingWebhookGen'
        static type = 'webhook' as const
        static lang = typescript
        static toIdentifierName = ({ webhook }: ToWebhookIdentifierNameArgs) => webhook.name
        static toIdentifierType = (): IdentifierType => ({ kind: 'type' })
        static toExportPath = (_args: ToWebhookExportPathArgs) => './test.ts'
        static toEnrichments = () => undefined

        constructor(args: {
          context: GenerateContextType
          settings: ContentSettings<undefined>
          webhook: OasWebhook
        }) {
          super({
            context: args.context,
            generatorKey: toWebhookGeneratorKey({
              generatorId: 'TrackingWebhookGen',
              webhook: args.webhook,
              variant: 'main'
            })
          })
          instantiated = true
        }

        override toString() {
          return 'test'
        }
      }

      const webhook = createMockWebhook()

      const tempValue = new TrackingProjection({
        // deno-lint-ignore no-explicit-any
        context: {} as any,
        settings: new ContentSettings({
          identifier: createVariable('newPet'),
          exportPath: './test.ts',
          enrichments: undefined,
          variant: 'main'
        }),
        webhook
      })

      instantiated = false

      const cachedDef = new TsDefinition({
        // deno-lint-ignore no-explicit-any
        context: {} as any,
        identifier: createVariable('newPet'),
        value: tempValue
      })

      const { context } = createMockContext({ findDefinition: cachedDef })

      // deno-lint-ignore no-explicit-any
      new WebhookDriver({ context, projection: TrackingProjection as any, webhook, variant: 'main' })

      assertEquals(instantiated, false)
    })
  })

  await t.step('Cache Validation (affirmDefinition)', async t => {
    await t.step('should throw error on generator key mismatch', () => {
      const webhook = createMockWebhook()
      const projection = createMockProjection({ id: 'MockWebhookGen' })

      // Cached value carries a DIFFERENT generator's key for the same
      // (name, exportPath) — the collision the integrity check catches.
      const differentProjection = createMockProjection({ id: 'DifferentWebhookGen' })
      const cachedValue = new differentProjection({
        // deno-lint-ignore no-explicit-any
        context: {} as any,
        settings: new ContentSettings({
          identifier: createVariable('newPet'),
          exportPath: './webhooks/newPet.ts',
          enrichments: undefined,
          variant: 'main'
        }),
        webhook
      })

      const cachedDef = new TsDefinition({
        // deno-lint-ignore no-explicit-any
        context: {} as any,
        identifier: createVariable('newPet'),
        value: cachedValue
      })

      const { context } = createMockContext({ findDefinition: cachedDef })

      assertThrows(
        () => new WebhookDriver({ context, projection, webhook, variant: 'main' }),
        Error,
        'Registered definition mismatch'
      )
    })

    await t.step('should include both keys in error message', () => {
      const webhook = createMockWebhook()
      const cachedKey = toWebhookGeneratorKey({
        generatorId: 'CachedWebhookGen',
        webhook,
        variant: 'main'
      })
      const cachedDef = new TsDefinition({
        // deno-lint-ignore no-explicit-any
        context: {} as any,
        identifier: createVariable('newPet'),
        value: {
          generatorKey: cachedKey,
          toString: () => 'cached'
          // deno-lint-ignore no-explicit-any
        } as any
      })

      const { context } = createMockContext({ findDefinition: cachedDef })
      const projection = createMockProjection({ id: 'NewWebhookGen' })

      let errorMessage = ''
      try {
        new WebhookDriver({ context, projection, webhook, variant: 'main' })
      } catch (error) {
        errorMessage = (error as Error).message
      }

      assert(errorMessage.includes('CachedWebhookGen'))
      assert(errorMessage.includes('NewWebhookGen'))
    })

    await t.step('webhook key carries the `webhook` discriminator segment', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'TestWebhookGen' })
      const webhook = createMockWebhook({ name: 'newPet', method: 'post' })

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      const key = driver.definition.generatorKey
      assertExists(key)
      // `id|webhook|name|method|variant` — the literal `webhook` segment is
      // what keeps a webhook named `users` from colliding with path `/users`.
      assertEquals(key, 'TestWebhookGen|webhook|newPet|post|main')
    })
  })

  await t.step('Variant validation', async t => {
    await t.step("default 'main' variant succeeds when the peer has no enrichments", () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertExists(driver.definition)
    })

    await t.step('explicit non-main variant throws when the peer has no enrichments', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ id: 'unconfigured-peer' })
      const webhook = createMockWebhook()

      assertThrows(
        () => new WebhookDriver({ context, projection, webhook, variant: 'description' }),
        Error,
        "Cannot insert variant 'description'"
      )
    })

    await t.step('explicit variant throws when the peer declares a different one', () => {
      const projection = createMockProjection({ id: 'peer-gen' })
      const webhook = createMockWebhook({ name: 'newPet', method: 'post' })

      const { context } = createMockContext({
        settings: {
          enrichments: {
            'peer-gen': { newPet: { post: { main: {}, customer: {} } } }
          }
        }
      })

      assertThrows(
        () => new WebhookDriver({ context, projection, webhook, variant: 'description' }),
        Error,
        'Available variants: main, customer'
      )
    })

    await t.step('explicit variant succeeds when the peer declares it', () => {
      const projection = createMockProjection({ id: 'peer-gen', variantAware: true })
      const webhook = createMockWebhook({ name: 'newPet', method: 'post' })

      const { context } = createMockContext({
        settings: {
          enrichments: {
            'peer-gen': { newPet: { post: { main: {}, customer: {} } } }
          }
        }
      })

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'customer' })

      assertEquals(driver.variant, 'customer')
      assertEquals(driver.settings.variant, 'customer')
    })

    await t.step(
      'variants-aware Projection that forgets to vary toIdentifier collides on second variant',
      () => {
        // The webhook analogue of the operation collision test. A
        // variants-unaware identifier produces the same (name, exportPath)
        // for both variants; the cached 'main' Definition's key
        // (`…|webhook|newPet|post|main`) mismatches the new 'customer' key,
        // so `affirmDefinition` throws.
        const webhook = createMockWebhook({ name: 'newPet', method: 'post' })

        const mainKey = toWebhookGeneratorKey({
          generatorId: 'forgetful-gen',
          webhook,
          variant: 'main'
        })
        const cachedDef = new TsDefinition({
          // deno-lint-ignore no-explicit-any
          context: {} as any,
          identifier: createVariable('newPet'),
          value: {
            generatorKey: mainKey,
            toString: () => 'cached'
            // deno-lint-ignore no-explicit-any
          } as any
        })

        const { context } = createMockContext({
          findDefinition: cachedDef,
          settings: {
            enrichments: {
              'forgetful-gen': { newPet: { post: { main: {}, customer: {} } } }
            }
          }
        })

        // variantAware: false → toIdentifierName ignores `variant`, so the
        // 'customer' call reuses the 'main' cache slot and collides.
        const projection = createMockProjection({ id: 'forgetful-gen' })

        assertThrows(
          () => new WebhookDriver({ context, projection, webhook, variant: 'customer' }),
          Error,
          'Registered definition mismatch'
        )
      }
    )
  })

  await t.step('Peer support validation', async t => {
    await t.step('insertion succeeds when the peer supports the webhook', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({ isSupported: () => true })
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertExists(driver.definition)
    })

    await t.step('insertion throws when the peer does not support the webhook', () => {
      const { context } = createMockContext()
      const projection = createMockProjection({
        id: 'unsupporting-peer',
        isSupported: () => false
      })
      const webhook = createMockWebhook({ name: 'newPet', method: 'post' })

      assertThrows(
        () => new WebhookDriver({ context, projection, webhook, variant: 'main' }),
        Error,
        'does not support this webhook'
      )
    })

    await t.step('a peer with no isSupported static supports every webhook', () => {
      const { context } = createMockContext()
      const projection = createMockProjection()
      const webhook = createMockWebhook()

      const driver = new WebhookDriver({ context, projection, webhook, variant: 'main' })

      assertExists(driver.definition)
    })
  })
})
