import type { Method } from '../../types/Method.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasParameterLocation } from '../parameter/parameter-types.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasResponse } from '../response/Response.ts'
import { toPrimaryResponseCode } from '../response/toPrimaryResponseCode.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
import type { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'
import type { OasServer } from '../server/Server.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

/**
 * Fields for an OpenAPI 3.1 webhook.
 *
 * Structurally a webhook is an Operation Object (same `parameters`,
 * `requestBody`, `responses`, …) keyed by a **name** rather than a URL
 * path. The semantics are *inverted* relative to a REST operation,
 * though: the server initiates the call, so `requestBody` is the payload
 * delivered *to* the consumer's handler and `responses` is what the
 * handler returns to acknowledge. That inversion is why webhooks are a
 * distinct subject ({@link OasWebhook}), not an {@link OasOperation} with
 * a flag — see notes/openapi-3.1-webhooks-and-parser-architecture.md §6.2.
 */
export type WebhookFields = {
  /** The webhook name (the `webhooks` map key — NOT a URL path) */
  name: string
  /** The HTTP method for this webhook */
  method: Method
  /** The parent path item containing this webhook */
  pathItem: OasPathItem | undefined
  /** Unique identifier for the webhook operation */
  operationId?: string | undefined
  /** Brief summary of the webhook */
  summary?: string | undefined
  /** Tags for organizing webhooks in documentation */
  tags?: string[] | undefined
  /** Detailed description of the webhook */
  description?: string | undefined
  /** Parameters accepted by this webhook (e.g. inbound headers) */
  parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined
  /** Payload delivered to the handler for this webhook */
  requestBody?: OasRequestBody | OasRef<'requestBody'> | undefined
  /** Acknowledgement responses the handler returns, mapped by status code */
  responses: Record<string, OasResponse | OasRef<'response'>>
  /** Security requirements for this webhook */
  security?: OasSecurityRequirement[] | undefined
  /** Whether this webhook is deprecated */
  deprecated?: boolean | undefined
  /** External documentation for this webhook */
  externalDocs?: OasExternalDocs | undefined
  /** OpenAPI specification extensions */
  extensionFields?: Record<string, unknown>
  /** Servers for this webhook */
  servers?: OasServer[] | undefined
}

/**
 * Represents an OpenAPI 3.1 webhook — a third OAS subject, peer to
 * {@link OasOperation} and the schema/model subjects.
 *
 * Kept OUT of {@link OasDocument.operations} (it lives in
 * {@link OasDocument.webhooks}) so existing client/SDK generators never
 * receive one: webhook code generation is a *receiver/handler* concern,
 * not a client-call concern.
 *
 * Carries webhook-semantic accessors named for the RECEIVER —
 * `toPayload`/`toPayloadSchema` (the received payload), `toParams` (inbound
 * params), `toAckResponse`/`toAckResponseCode` (the ack the handler returns).
 * These deliberately avoid the client-framed {@link OasOperation} names
 * (`toRequestBody`, `toSuccessResponse`) so the inversion stays explicit in
 * generator code. (Signature-verification helpers still accrue on demand.)
 */
export class OasWebhook extends OasBase {
  /** Type identifier for OAS webhook objects */
  oasType: 'webhook' = 'webhook'

  /** The webhook name (the `webhooks` map key — NOT a URL path) */
  name: string
  /** The HTTP method for this webhook */
  method: Method
  /** The parent path item containing this webhook */
  pathItem: OasPathItem | undefined
  /** Unique identifier for the webhook operation */
  operationId: string | undefined
  /** Brief summary of the webhook */
  summary: string | undefined
  /** Tags for organizing webhooks in documentation */
  tags: string[] | undefined
  /** Detailed description of the webhook */
  description: string | undefined
  /** Parameters accepted by this webhook */
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  /** Payload delivered to the handler for this webhook */
  requestBody: OasRequestBody | OasRef<'requestBody'> | undefined
  /** Acknowledgement responses mapped by status code */
  responses: Record<string, OasResponse | OasRef<'response'>>
  /** Security requirements for this webhook */
  security: OasSecurityRequirement[] | undefined
  /** Whether this webhook is deprecated */
  deprecated: boolean | undefined
  /** External documentation for this webhook */
  externalDocs: OasExternalDocs | undefined
  /** OpenAPI specification extensions */
  extensionFields: Record<string, unknown> | undefined
  /** Servers for this webhook */
  servers: OasServer[] | undefined

  constructor(fields: WebhookFields, context?: ParseContextType) {
    super(context)
    this.name = fields.name
    this.method = fields.method
    this.pathItem = fields.pathItem
    this.operationId = fields.operationId
    this.summary = fields.summary
    this.tags = fields.tags
    this.description = fields.description
    this.parameters = fields.parameters
    this.requestBody = fields.requestBody
    this.responses = fields.responses
    this.security = fields.security
    this.deprecated = fields.deprecated
    this.externalDocs = fields.externalDocs
    this.extensionFields = fields.extensionFields
    this.servers = fields.servers
  }

  /**
   * The received-payload body — the request body the API delivers TO the
   * consumer's handler. Webhook semantics are inverted: this is what the
   * handler RECEIVES, not what a client sends. A `$ref` body is resolved.
   */
  toPayload(): OasRequestBody | undefined {
    return this.requestBody?.resolve()
  }

  /**
   * The schema of the received payload for `mediaType` (default
   * `application/json`) — the inbound body shape a handler generator emits a
   * type for. `undefined` when there is no body or no schema for that media
   * type.
   */
  toPayloadSchema(mediaType = 'application/json'): OasSchema | OasRef<'schema'> | undefined {
    return this.toPayload()?.content[mediaType]?.schema
  }

  /**
   * Resolve the inbound parameters (e.g. the signature/headers a handler
   * receives), optionally filtered by location. Mirrors
   * {@link OasOperation.toParams}; the parameters carry the same shape, only
   * their direction is inbound.
   */
  toParams(filter?: OasParameterLocation[]): OasParameter[] {
    return (
      this.parameters
        ?.map(param => param.resolve())
        .filter(param => (filter?.length ? filter.includes(param.location) : true)) ?? []
    )
  }

  /**
   * The status code of the primary acknowledgement response — the lowest 2xx
   * the handler returns to ack the delivery, falling back to `default`. Named
   * for the receiver: a webhook's `responses` are what the handler RETURNS,
   * not what a client receives (cf. {@link OasOperation.toSuccessResponseCode}).
   */
  toAckResponseCode(): string | undefined {
    return toPrimaryResponseCode(this.responses)
  }

  /**
   * The primary acknowledgement response definition (the body/headers the
   * handler returns), or `undefined` when none is declared.
   */
  toAckResponse(): OasResponse | OasRef<'response'> | undefined {
    const ackCode = this.toAckResponseCode()

    return ackCode ? this.responses[ackCode] : undefined
  }

  /**
   * Serializes the webhook to a plain JavaScript object.
   */
  toJSON(): object {
    return {
      name: this.name,
      method: this.method,
      operationId: this.operationId,
      summary: this.summary,
      description: this.description,
      tags: this.tags,
      parameters: this.parameters,
      requestBody: this.requestBody,
      responses: this.responses,
      security: this.security,
      deprecated: this.deprecated,
      ...this.extensionFields
    }
  }
}
