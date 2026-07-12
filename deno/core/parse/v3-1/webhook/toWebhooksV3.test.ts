/**
 * Parse-level coverage for the 3.1 `webhooks` object → `OasWebhook[]`
 * flattening. Mirrors `toOperationsV3`'s `paths` flattening; here the map is
 * keyed by webhook NAME, not URL path.
 *
 * §5 edge cases of the webhooks arc:
 *   - a PathItem with multiple methods → one OasWebhook per method
 *   - a PathItem `$ref` → currently dropped (documented limitation)
 *   - a name with non-identifier characters → preserved raw (sanitization is
 *     a generator concern, not a parse concern)
 *   - parameters / security / servers carried onto the OasWebhook
 *   - absent / empty `webhooks` → `[]`
 */

import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals, assertExists } from '@std/assert'
import { toWebhooksV3 } from './toWebhooksV3.ts'
import { mockParseContext } from '@/test/mockParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

const run = (webhooks: Record<string, OpenAPIV3.PathItemObject> | undefined) =>
  toWebhooksV3({ webhooks, stackTrail: new StackTrail(['TEST']), context: mockParseContext })

Deno.test('toWebhooksV3 - absent webhooks object returns []', () => {
  assertEquals(run(undefined), [])
})

Deno.test('toWebhooksV3 - empty webhooks object returns []', () => {
  assertEquals(run({}), [])
})

Deno.test('toWebhooksV3 - flattens a single webhook into one OasWebhook', () => {
  const webhooks = run({
    newPet: { post: { responses: { '200': { description: 'ok' } } } }
  })

  assertEquals(webhooks.length, 1)
  assertEquals(webhooks[0].name, 'newPet')
  assertEquals(webhooks[0].method, 'post')
  assertEquals(webhooks[0].oasType, 'webhook')
})

Deno.test('toWebhooksV3 - a PathItem with multiple methods yields one OasWebhook per method', () => {
  const webhooks = run({
    newPet: {
      get: { responses: { '200': { description: 'ok' } } },
      post: { responses: { '201': { description: 'created' } } }
    }
  })

  assertEquals(webhooks.length, 2)
  // Both webhooks share the name; the method distinguishes them.
  assertEquals(
    webhooks.every(webhook => webhook.name === 'newPet'),
    true
  )
  assertEquals(webhooks.map(webhook => webhook.method).toSorted(), ['get', 'post'])
})

Deno.test('toWebhooksV3 - multiple named webhooks each flatten independently', () => {
  const webhooks = run({
    newPet: { post: { responses: { '200': { description: 'ok' } } } },
    petUpdated: { put: { responses: { '200': { description: 'ok' } } } }
  })

  assertEquals(webhooks.length, 2)
  assertEquals(webhooks.map(webhook => `${webhook.name}:${webhook.method}`).toSorted(), [
    'newPet:post',
    'petUpdated:put'
  ])
})

Deno.test('toWebhooksV3 - a webhook name with non-identifier characters is preserved raw', () => {
  // Sanitization to a TS-safe identifier is a GENERATOR concern
  // (toIdentifierName). The parser must preserve the original key verbatim
  // so routing keys (enrichments / skip / include) match the schema.
  const rawName = 'pet-updated/v2'
  const webhooks = run({
    [rawName]: { post: { responses: { '200': { description: 'ok' } } } }
  })

  assertEquals(webhooks.length, 1)
  assertEquals(webhooks[0].name, rawName)
})

Deno.test('toWebhooksV3 - parameters, security and servers are carried onto the OasWebhook', () => {
  const webhooks = run({
    newPet: {
      post: {
        parameters: [
          { name: 'X-Signature', in: 'header', required: true, schema: { type: 'string' } }
        ],
        security: [{ apiKey: [] }],
        servers: [{ url: 'https://hooks.example.com' }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: { '200': { description: 'ok' } }
      }
    }
  })

  assertEquals(webhooks.length, 1)
  const webhook = webhooks[0]

  assertExists(webhook.parameters)
  assertEquals(webhook.parameters?.length, 1)

  assertExists(webhook.security)
  assertEquals(webhook.security?.length, 1)

  assertExists(webhook.servers)
  assertEquals(webhook.servers?.length, 1)

  assertExists(webhook.requestBody)
})

Deno.test('toWebhooksV3 - a PathItem $ref is currently dropped (documented limitation)', () => {
  // The webhook PathItem `$ref` form is a 3.1 edge case `toWebhooksV3` does
  // not yet resolve (see the file docstring). The methods live behind the
  // ref, so none are discovered and the webhook produces no OasWebhook —
  // a silent no-op, not a crash. This test pins the CURRENT behavior; if
  // ref-resolution lands later, update it to assert the resolved methods.
  const webhooks = run({
    newPet: { $ref: '#/components/pathItems/NewPetHook' } as OpenAPIV3.PathItemObject
  })

  assertEquals(webhooks, [])
})
