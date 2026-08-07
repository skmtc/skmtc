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

/** The request body itself was not JSON. Distinct from a `SyntaxError`
 *  thrown deeper in a run (a generator reading a malformed `x-` extension,
 *  say) — that is a server fault and must stay a 500, not become "your body
 *  is not valid JSON". Maps to a structured 400. */
export class InvalidBodyError extends Error {
  override name = "InvalidBodyError";
}

const protocolSchema = v.pipe(
  v.picklist(["oas", "gql"]),
  v.description(
    "Schema protocol. Optional — inferred from the document content when " +
      "omitted (a JSON/YAML document with an `openapi` or `swagger` key is " +
      "`oas`; anything else is treated as GraphQL SDL).",
  ),
);

const sourceSchema = v.pipe(
  v.string(),
  v.url("`source` must be an absolute http(s) URL to fetch the schema from."),
  v.check(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "`source` must use http or https.",
  ),
  v.description(
    "URL of the schema document. The server fetches it (following redirects, " +
      "checking each hop) and echoes the final URL + content digest in the " +
      "response. Must be publicly reachable: a URL naming a loopback, " +
      "private, link-local or `.internal` host is refused.",
  ),
);

const EXACTLY_ONE_MESSAGE =
  "Provide exactly one of `schema` (inline document) or `source` (URL).";

/**
 * Body schema for `POST /artifacts`, `POST /subjects` and
 * `POST /enrichment-defaults`.
 *
 * The schema input is EXACTLY ONE of:
 * - `schema` — the document itself, as a string (JSON/YAML OpenAPI, or SDL)
 * - `source` — an http(s) URL the server fetches the document from
 *
 * `protocol` is optional either way: when omitted, the server infers it from
 * the document content. Passing it explicitly overrides inference.
 */
export const postArtifactsBody = v.pipe(
  v.object({
    protocol: v.optional(protocolSchema),
    schema: v.optional(v.pipe(
      v.string(),
      v.description("The schema document itself, as a string."),
    )),
    source: v.optional(sourceSchema),
    clientSettings: v.optional(settingsSchema),
    /** Schema source identifier stamped onto each sidecar's `src` field
     *  (e.g. `'openapi.json'`). Optional — defaults to the resolved `source`
     *  URL when one was fetched, else to the protocol name. */
    schemaSrc: v.optional(v.string()),
  }),
  v.check(
    (body) => (body.schema === undefined) !== (body.source === undefined),
    EXACTLY_ONE_MESSAGE,
  ),
);

export type ArtifactsBody = v.InferOutput<typeof postArtifactsBody>;

/** Body for `POST /validate` — enrichment config to check, no schema needed. */
export const validateBody = v.object({
  clientSettings: v.optional(settingsSchema),
});

/** Body for `POST /to-v3-json` — a raw OpenAPI/Swagger document to normalize,
 *  inline (`schema`) or fetched from a URL (`source`). */
export const toV3JsonBody = v.pipe(
  v.object({
    schema: v.optional(v.string()),
    source: v.optional(sourceSchema),
  }),
  v.check(
    (body) => (body.schema === undefined) !== (body.source === undefined),
    EXACTLY_ONE_MESSAGE,
  ),
);

export type ToV3JsonBody = v.InferOutput<typeof toV3JsonBody>;
