import * as v from "valibot";
import { clientSettings as settingsSchema } from "@skmtc/core";

/**
 * Request-body valibot schemas for the stack server's routes.
 *
 * These are the single source of truth for the server's request contract:
 * `createServer` validates against them at runtime, and `buildOpenApiDocument`
 * (`./openapi.ts`) derives the published OpenAPI request schemas from them — so
 * the documented contract cannot drift from what the server actually accepts.
 */

/**
 * Body schemas for `POST /artifacts`, modeled as a discriminated union over
 * `protocol`. Each variant declares the field it actually needs — there are no
 * optional / "maybe present" fields whose presence depends on another field's
 * value.
 *
 * The shared half (`schema`, `clientSettings`) is spread into each variant
 * rather than extracted into a base, because the branching shape is the more
 * important property to make obvious.
 */
export const oasArtifactsBody = v.object({
  protocol: v.literal("oas"),
  schema: v.string(),
  clientSettings: v.optional(settingsSchema),
  /** Schema source identifier stamped onto each sidecar's `src` field
   *  (e.g. `'openapi.json'`). Optional — defaults to the protocol name. */
  schemaSrc: v.optional(v.string()),
});

export const gqlArtifactsBody = v.object({
  protocol: v.literal("gql"),
  schema: v.string(),
  clientSettings: v.optional(settingsSchema),
  /** Schema source identifier stamped onto each sidecar's `src` field.
   *  Optional — defaults to the protocol name. */
  schemaSrc: v.optional(v.string()),
});

/**
 * Discriminated request body for `POST /artifacts`, `POST /subjects` and
 * `POST /enrichment-defaults`. `v.variant` keys on `protocol` and routes to the
 * matching variant — clients must send `protocol: 'oas'` or `protocol: 'gql'`
 * explicitly. After parsing, the result is a properly-narrowed discriminated
 * union.
 */
export const postArtifactsBody = v.variant("protocol", [
  oasArtifactsBody,
  gqlArtifactsBody,
]);

export type ArtifactsBody = v.InferOutput<typeof postArtifactsBody>;

/** Body for `POST /validate` — enrichment config to check, no schema needed. */
export const validateBody = v.object({
  clientSettings: v.optional(settingsSchema),
});

/** Body for `POST /to-v3-json` — a raw OpenAPI/Swagger document to normalize. */
export const toV3JsonBody = v.object({ schema: v.string() });
