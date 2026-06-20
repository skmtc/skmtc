/**
 * Coverage for the OasWebhook receiver-semantic helpers — `toPayload` /
 * `toPayloadSchema` (the received payload), `toParams` (inbound params), and
 * `toAckResponse` / `toAckResponseCode` (the ack the handler returns).
 *
 * Webhooks are built by parsing a `webhooks` fragment (the same path
 * generators consume) rather than hand-constructing the sub-component tree.
 */

import type { OpenAPIV3 } from 'openapi-types'
import { assert, assertEquals, assertExists } from '@std/assert'
import { toWebhooksV3 } from '@/parse/v3-1/webhook/toWebhooksV3.ts'
import { mockParseContext } from '@/test/mockParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasObject } from '@/oas/object/Object.ts'

const webhook = (pathItem: OpenAPIV3.PathItemObject) =>
  toWebhooksV3({
    webhooks: { hook: pathItem },
    stackTrail: new StackTrail(['TEST']),
    context: mockParseContext
  })[0]

Deno.test('OasWebhook - toPayload / toPayloadSchema return the received body', () => {
  const hook = webhook({
    post: {
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
          }
        }
      },
      responses: { '200': { description: 'ok' } }
    }
  })

  assertExists(hook.toPayload())
  const schema = hook.toPayloadSchema()
  assert(schema instanceof OasObject, 'payload schema is the object body')
  // A media type the body does not carry → undefined.
  assertEquals(hook.toPayloadSchema('application/xml'), undefined)
})

Deno.test('OasWebhook - toPayload* is undefined when there is no body', () => {
  const hook = webhook({ post: { responses: { '204': { description: 'no content' } } } })

  assertEquals(hook.toPayload(), undefined)
  assertEquals(hook.toPayloadSchema(), undefined)
})

Deno.test('OasWebhook - toParams resolves inbound params and filters by location', () => {
  const hook = webhook({
    post: {
      parameters: [
        { name: 'X-Signature', in: 'header', schema: { type: 'string' } },
        { name: 'tenant', in: 'query', schema: { type: 'string' } }
      ],
      responses: { '200': { description: 'ok' } }
    }
  })

  assertEquals(hook.toParams().length, 2)
  const headers = hook.toParams(['header'])
  assertEquals(headers.length, 1)
  assertEquals(headers[0].name, 'X-Signature')
  assertEquals(headers[0].location, 'header')
  assertEquals(hook.toParams(['cookie']).length, 0)
})

Deno.test('OasWebhook - toAckResponseCode picks the lowest 2xx the handler returns', () => {
  const hook = webhook({
    post: {
      responses: {
        '202': { description: 'accepted' },
        '200': { description: 'ok' },
        '500': { description: 'error' }
      }
    }
  })

  assertEquals(hook.toAckResponseCode(), '200')
  assertExists(hook.toAckResponse())
})

Deno.test('OasWebhook - toAckResponseCode resolves a 2XX range key (the remote.com case)', () => {
  // remote.com's 108 webhooks all declare only `2XX`; a range key must resolve.
  const hook = webhook({ post: { responses: { '2XX': { description: 'accepted' } } } })

  assertEquals(hook.toAckResponseCode(), '2XX')
  assertExists(hook.toAckResponse())
})

Deno.test('OasWebhook - toAckResponseCode falls back to default, else undefined', () => {
  const withDefault = webhook({ post: { responses: { default: { description: 'ack' } } } })
  assertEquals(withDefault.toAckResponseCode(), 'default')

  const noAck = webhook({ post: { responses: { '404': { description: 'not found' } } } })
  assertEquals(noAck.toAckResponseCode(), undefined)
  assertEquals(noAck.toAckResponse(), undefined)
})
