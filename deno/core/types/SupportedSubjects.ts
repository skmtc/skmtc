/**
 * The subjects each generator supports for a given schema.
 *
 * Produced by evaluating every generator's `isSupported` predicate over the
 * parsed document's operations / models — *without* running transform or
 * render. An operation generator reports the operations its `isSupported`
 * accepts; a model generator reports every model (the generate pipeline applies
 * no model-level `isSupported`). Keyed by generator id.
 */

/** A supported OAS operation. */
export type SupportedOasOperation = { path: string; method: string }

/** A supported 3.1 webhook. */
export type SupportedWebhook = { name: string; method: string }

/** A supported GraphQL operation. */
export type SupportedGqlOperation = { rootKind: string; fieldName: string }

/** What one generator supports, discriminated by its subject type. */
export type GeneratorSupport =
  | { type: 'oasOperation'; operations: SupportedOasOperation[] }
  | { type: 'webhook'; webhooks: SupportedWebhook[] }
  | { type: 'gqlOperation'; operations: SupportedGqlOperation[] }
  | { type: 'model'; models: string[] }

/** Generator id → the subjects that generator supports. */
export type SupportedSubjects = Record<string, GeneratorSupport>
