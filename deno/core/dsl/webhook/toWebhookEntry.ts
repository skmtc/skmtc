import type * as v from 'valibot'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedWebhookArgs,
  ToWebhookPreviewModuleArgs,
  ToWebhookMappingArgs,
  ToWebhookEnrichmentsArgs,
  TransformWebhookArgs
} from '@/dsl/webhook/types.ts'
import type { PreviewModule } from '@/types/Preview.ts'

/**
 * Configuration arguments for creating webhook generator entries.
 *
 * Mirrors {@link ToOasOperationConfigArgs} for the 3.1 webhook subject —
 * the field that varies is `webhook` (an {@link OasWebhook}) in place of
 * `operation`.
 *
 * @template EnrichmentType - Type of enrichment data this webhook can provide
 */
export type ToWebhookConfigArgs<EnrichmentType = undefined> = {
  id: string
  transform: ({ context, webhook, variant }: TransformWebhookArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported?: (args: IsSupportedWebhookArgs) => boolean
  /**
   * Optional: whether this generator entry supports variants. Defaults to a
   * function returning `false` when omitted.
   */
  supportsVariant?: () => boolean
  toPreviewModule?: ({ context, webhook }: ToWebhookPreviewModuleArgs) => PreviewModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    webhook: OasWebhook
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    webhook,
    context,
    variant
  }: ToWebhookEnrichmentsArgs) => EnrichmentType | undefined
}

export type WebhookEntry<EnrichmentType = undefined> = {
  id: string
  type: 'webhook'
  transform: ({ context, webhook, variant }: TransformWebhookArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported: (args: IsSupportedWebhookArgs) => boolean
  supportsVariant: () => boolean
  toPreviewModule?: ({ context, webhook }: ToWebhookPreviewModuleArgs) => PreviewModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    webhook: OasWebhook
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    webhook,
    context,
    variant
  }: ToWebhookEnrichmentsArgs) => EnrichmentType | undefined
}

/**
 * Creates a configured webhook generator entry.
 *
 * Sibling of {@link toOasOperationEntry} for the OpenAPI 3.1 webhook
 * subject. Webhooks have inverted semantics (handler/receiver, not client
 * call), so they are a distinct subject — never routed through an operation
 * generator. The enrichment routing is `[id][name][method][variant]`,
 * mirroring the operation `[id][path][method][variant]` with the webhook
 * name in the `path` slot.
 *
 * @example Basic webhook entry
 * ```typescript
 * import { toWebhookEntry } from '@skmtc/core';
 *
 * const webhookEntry = toWebhookEntry({
 *   id: 'webhook-handlers',
 *   transform: ({ context, webhook }) => {
 *     context.insertWebhook({ projection: MyHandler, webhook });
 *   }
 * });
 * ```
 */
export const toWebhookEntry = <EnrichmentType = undefined>({
  id,
  transform,
  toEnrichmentSchema,
  isSupported,
  supportsVariant,
  toPreviewModule,
  toEnrichmentRequest,
  toEnrichmentDefaults
}: ToWebhookConfigArgs<EnrichmentType>): WebhookEntry<EnrichmentType> => {
  return {
    id,
    type: 'webhook',
    transform,
    toEnrichmentSchema,
    isSupported: isSupported ?? (() => true),
    supportsVariant: supportsVariant ?? (() => false),
    toPreviewModule,
    toEnrichmentRequest,
    toEnrichmentDefaults
  }
}
