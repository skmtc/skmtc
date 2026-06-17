import { toWebhookEntry, emptyEnrichmentSchema } from '@skmtc/core'
import { WebhookHandler } from './WebhookHandler.ts'
import denoJson from '../deno.json' with { type: 'json' }

/**
 * Entry for the simple TypeScript webhook-handler generator. Emits one
 * `<Name>WebhookHandler` type per 3.1 webhook. Capability is unconditional
 * (every webhook is supported); consumers gate via `client.json` include/skip.
 */
export const tsWebhookEntry = toWebhookEntry({
  id: denoJson.name,
  transform({ context, webhook, variant }) {
    context.insertWebhook({ projection: WebhookHandler, webhook, variant })
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

export default tsWebhookEntry
