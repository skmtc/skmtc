import { emptyEnrichmentSchema } from '@skmtc/core'
import { toTsWebhookProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toPascalCase } from './toPascalCase.ts'
import denoJson from '../deno.json' with { type: 'json' }

/**
 * Projection base for the TypeScript webhook-handler generator.
 *
 * Identifier: `<PascalName>WebhookHandler`, emitted as `export type` (kind
 * `'type'`). Export path: `@/webhooks/<PascalName>.generated.ts`. No
 * enrichments (emptyEnrichmentSchema).
 */
export const WebhookHandlerBase = toTsWebhookProjectionBase({
  id: denoJson.name,
  toIdentifierName({ webhook }) {
    return `${toPascalCase(webhook.name)}WebhookHandler`
  },
  toIdentifierType: () => ({ kind: 'type' }),
  toExportPath({ webhook }) {
    return join('@', 'webhooks', `${toPascalCase(webhook.name)}.generated.ts`)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
