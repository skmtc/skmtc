import { WebhookHandlerBase } from './base.ts'
import { toPayloadType } from './toPayloadType.ts'

/**
 * The webhook-handler projection. For each webhook, emits a typed handler
 * signature the consumer implements to RECEIVE the inbound payload:
 *
 * ```ts
 * export type NewPetWebhookHandler =
 *   (payload: { id: string; name?: string }) => void | Promise<void>
 * ```
 *
 * Inverted semantics vs an operation generator: this is a *receiver*, not a
 * client call — `payload` is what the server delivers to the handler, not a
 * body the consumer sends. `toString()` is pure (reads `this.webhook`).
 */
export class WebhookHandler extends WebhookHandlerBase {
  override toString(): string {
    return `(payload: ${toPayloadType(this.webhook)}) => void | Promise<void>`
  }
}
