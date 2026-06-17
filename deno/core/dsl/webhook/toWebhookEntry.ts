import * as v from 'valibot'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { EnrichmentRequest } from '@/types/EnrichmentRequest.ts'
import type {
  IsSupportedWebhookArgs,
  ToWebhookPreviewModuleArgs,
  ToWebhookMappingArgs,
  ToWebhookEnrichmentsArgs,
  TransformWebhookArgs,
  IsSupportedWebhookConfigArgs
} from '@/dsl/webhook/types.ts'
import type { MappingModule, PreviewModule } from '@/types/Preview.ts'
import { GENERATOR_ENRICHMENT_KEY, STACK_ENRICHMENT_KEY } from '@/types/Enrichments.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

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
  isSupported?: ({
    context,
    webhook
  }: IsSupportedWebhookConfigArgs<EnrichmentType>) => boolean
  toPreviewModule?: ({ context, webhook }: ToWebhookPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, webhook }: ToWebhookMappingArgs) => MappingModule
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
  toPreviewModule,
  toMappingModule,
  toEnrichmentRequest,
  toEnrichmentDefaults
}: ToWebhookConfigArgs<EnrichmentType>): {
  id: string
  type: 'webhook'
  transform: ({ context, webhook, variant }: TransformWebhookArgs) => void
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported: ({ context, webhook }: IsSupportedWebhookArgs) => boolean
  toPreviewModule?: ({ context, webhook }: ToWebhookPreviewModuleArgs) => PreviewModule
  toMappingModule?: ({ context, webhook }: ToWebhookMappingArgs) => MappingModule
  toEnrichmentRequest?: <RequestedEnrichment extends EnrichmentType>(
    webhook: OasWebhook
  ) => EnrichmentRequest<RequestedEnrichment> | undefined
  toEnrichmentDefaults?: ({
    webhook,
    context,
    variant
  }: ToWebhookEnrichmentsArgs) => EnrichmentType | undefined
} => {
  return {
    id,
    type: 'webhook',
    transform,
    toEnrichmentSchema,
    isSupported: ({ context, webhook, variant }: IsSupportedWebhookArgs) => {
      if (!isSupported) {
        return true
      }

      // Assemble the three-scope umbrella — mirrors
      // `WebhookProjectionBase.toEnrichments` so the shim and the
      // projection-base resolve to the same value. Subject is per-item
      // (`[id][name][method][variant]`); generator and stack are
      // run-constants. The required composite schema parses cast-free.
      const raw = {
        subject: get(context.settings, [
          'enrichments',
          id,
          webhook.name,
          webhook.method,
          variant
        ]),
        generator: get(context.settings, ['enrichments', id, GENERATOR_ENRICHMENT_KEY]),
        stack: get(context.settings, ['enrichments', STACK_ENRICHMENT_KEY])
      }

      return isSupported({
        context,
        webhook,
        enrichments: v.parse(toEnrichmentSchema(), raw),
        variant
      })
    },
    toPreviewModule,
    toMappingModule,
    toEnrichmentRequest,
    toEnrichmentDefaults
  }
}
