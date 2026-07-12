import { CoreContext, StackTrail } from '@skmtc/core'
import type { SkmtcDocumentInput, ClientSettings } from '@skmtc/core'
import { tsWebhookEntry } from './mod.ts'
import { assert, assertStringIncludes, assertEquals } from '@std/assert'

// A down-converted (3.0-shaped) OAS document with a retained `webhooks`
// member — exactly what `@skmtc/convert` produces for a 3.1 source. The
// test drives the WHOLE pipeline: parse webhooks → OasWebhook → dispatch →
// WebhookDriver → render.
const webhookDoc = {
  openapi: '3.0.3',
  info: { title: 'Test', version: '1.0.0' },
  paths: {},
  webhooks: {
    newPet: {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  count: { type: 'integer' }
                },
                required: ['id']
              }
            }
          }
        },
        responses: { '200': { description: 'ok' } }
      }
    }
  }
}

const runGenerate = (doc: unknown) => {
  const context = new CoreContext({ spanId: 'gen-ts-webhook-test', silent: true })
  return context.toArtifacts({
    document: { type: 'oas', value: doc } as SkmtcDocumentInput,
    settings: { basePath: 'src' } as ClientSettings,
    // deno-lint-ignore no-explicit-any -- `toGeneratorConfigMap` is generic
    // over EnrichmentType; a concrete entry's enrichment type can't unify
    // with the open generic, so the map is widened (the codebase convention
    // for test harnesses, e.g. GenerateContext.end-to-end.test.ts).
    toGeneratorConfigMap: () => ({ [tsWebhookEntry.id]: tsWebhookEntry }) as any,
    silent: true,
    stackTrail: new StackTrail(['gen'])
  })
}

Deno.test('gen-ts-webhook - emits a handler type for a webhook payload', () => {
  const result = runGenerate(webhookDoc)

  assert(
    result.parseIssues.every(issue => issue.level !== 'error'),
    `unexpected parse errors: ${JSON.stringify(result.parseIssues)}`
  )

  const generated = Object.values(result.artifacts).find(content =>
    content.includes('WebhookHandler')
  )
  assert(generated, 'expected a generated webhook handler artifact')

  // `export type NewPetWebhookHandler = (payload: { ... }) => void | Promise<void>`
  assertStringIncludes(generated, 'export type NewPetWebhookHandler')
  assertStringIncludes(
    generated,
    '(payload: { id: string; name?: string; count?: number }) => void | Promise<void>'
  )
})

Deno.test('gen-ts-webhook - emits `unknown` payload when the webhook has no request body', () => {
  const doc = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    webhooks: {
      ping: { post: { responses: { '200': { description: 'ok' } } } }
    }
  }

  const result = runGenerate(doc)
  const generated = Object.values(result.artifacts).find(content =>
    content.includes('PingWebhookHandler')
  )
  assert(generated, 'expected a generated handler for the body-less webhook')
  assertStringIncludes(generated, '(payload: unknown) => void | Promise<void>')
})

Deno.test('gen-ts-webhook - non-scalar payload properties ($ref, nested object, array) fall back to `unknown`', () => {
  // The first webhook generator types only scalar leaves precisely;
  // everything else — a `$ref`, an inline nested object, an array — renders
  // `unknown`. (`$ref` resolves first, lands on `type: 'object'`, then falls
  // through to the default.)
  const doc = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    webhooks: {
      complexHook: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    address: { $ref: '#/components/schemas/Address' },
                    meta: { type: 'object', properties: { key: { type: 'string' } } },
                    tags: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['id']
                }
              }
            }
          },
          responses: { '200': { description: 'ok' } }
        }
      }
    },
    components: {
      schemas: { Address: { type: 'object', properties: { city: { type: 'string' } } } }
    }
  }

  const result = runGenerate(doc)
  assert(
    result.parseIssues.every(issue => issue.level !== 'error'),
    `unexpected parse errors: ${JSON.stringify(result.parseIssues)}`
  )

  const generated = Object.values(result.artifacts).find(content =>
    content.includes('ComplexHookWebhookHandler')
  )
  assert(generated, 'expected a generated handler for the complex webhook')
  assertStringIncludes(
    generated,
    '(payload: { id: string; address?: unknown; meta?: unknown; tags?: unknown }) => void | Promise<void>'
  )
})

Deno.test('gen-ts-webhook - emits one handler file per webhook', () => {
  const doc = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    webhooks: {
      newPet: { post: { responses: { '200': { description: 'ok' } } } },
      petUpdated: { put: { responses: { '200': { description: 'ok' } } } }
    }
  }

  const result = runGenerate(doc)

  // One file per webhook, each at `@/webhooks/<PascalName>.generated.ts`
  // (here resolved against basePath `src`).
  const newPet = result.artifacts['src/webhooks/NewPet.generated.ts']
  const petUpdated = result.artifacts['src/webhooks/PetUpdated.generated.ts']

  assert(newPet, 'expected a file for the newPet webhook')
  assert(petUpdated, 'expected a file for the petUpdated webhook')
  assertStringIncludes(newPet, 'export type NewPetWebhookHandler')
  assertStringIncludes(petUpdated, 'export type PetUpdatedWebhookHandler')
})

Deno.test('gen-ts-webhook - identifier and export path follow the <Name>WebhookHandler / @/webhooks convention', () => {
  const result = runGenerate(webhookDoc)

  // Export path: `@/webhooks/<PascalName>.generated.ts` (basePath `src`).
  const exportPath = 'src/webhooks/NewPet.generated.ts'
  const generated = result.artifacts[exportPath]
  assert(
    generated,
    `expected the handler at ${exportPath}, got: ${Object.keys(result.artifacts).join(', ')}`
  )

  // Identifier: `<PascalName>WebhookHandler`, emitted as `export type`.
  assertStringIncludes(generated, 'export type NewPetWebhookHandler')
})

Deno.test('gen-ts-webhook - generates nothing for a document with no webhooks', () => {
  const doc = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: { '/pets': { get: { responses: { '200': { description: 'ok' } } } } }
  }

  const result = runGenerate(doc)
  // The webhook generator only runs over `document.webhooks`; a paths-only
  // document yields no handler artifacts (the isolation guarantee).
  const handlers = Object.values(result.artifacts).filter(content =>
    content.includes('WebhookHandler')
  )
  assertEquals(handlers.length, 0)
})
