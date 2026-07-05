import { toWebhookEntry } from './toWebhookEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import { assertEquals } from '@std/assert/equals'

Deno.test('toWebhookEntry - returns a webhook config with the webhook discriminator', () => {
  const entry = toWebhookEntry({
    id: 'webhook-handlers',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.id, 'webhook-handlers')
  assertEquals(entry.type, 'webhook')
  assertEquals(typeof entry.isSupported, 'function')
})

Deno.test('toWebhookEntry - forwards optional preview/mapping/enrichment hooks', () => {
  const entry = toWebhookEntry({
    id: 'webhook-handlers',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  // No optional hooks configured → all undefined (mirrors the operation entry).
  assertEquals(entry.toPreviewModule, undefined)
  assertEquals(entry.toEnrichmentDefaults, undefined)
})
