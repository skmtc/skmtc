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
    toGeneratorConfigMap: () => ({ [tsWebhookEntry.id]: tsWebhookEntry } as any),
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
