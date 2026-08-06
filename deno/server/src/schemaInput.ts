import { encodeHex } from "@std/encoding/hex";
import { stringToSchema } from "@skmtc/convert";
import type { ArtifactsBody } from "./requestSchemas.ts";

/**
 * Resolving a request's schema input: the caller sends exactly one of an
 * inline `schema` string or a `source` URL, with `protocol` optional. This
 * module turns that into a definite `{ protocol, schema }` pair — fetching
 * the source when given one — and reports failures as typed errors the
 * server's error handler maps to structured 4xx responses.
 */

/** The `source` URL could not be fetched (network failure, non-2xx, timeout,
 *  or an oversized response). Maps to a structured 422. */
export class SourceFetchError extends Error {
  override name = "SourceFetchError";
}

/** The schema document could not be read at all — not valid JSON/YAML on the
 *  `oas` path. (Distinct from a document that parses but has issues: those
 *  return 200 with `manifest.parseIssues`.) Maps to a structured 422. */
export class SchemaReadError extends Error {
  override name = "SchemaReadError";
}

/** Echo of a fetched `source`, returned alongside the artifacts so a caller
 *  can reproduce the run. */
export type ResolvedSource = {
  /** The URL as requested. */
  url: string;
  /** The final URL after redirects — when the source redirects to a pinned,
   *  content-addressed form, this is the URL to keep. */
  resolvedUrl: string;
  /** `sha256:<hex>` digest of the fetched bytes, before any normalization. */
  digest: string;
};

export type ResolvedSchemaInput = {
  protocol: "oas" | "gql";
  /** The schema document text, inline from the request or fetched. */
  schema: string;
  /** Present when the input came from a `source` URL. */
  source?: ResolvedSource;
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

/**
 * Infer the protocol from document content: a JSON/YAML document carrying an
 * `openapi` or `swagger` key is OAS; anything else is treated as GraphQL SDL
 * (whose parse issues, if any, surface through the normal gql parse path).
 */
export const inferProtocol = (schema: string): "oas" | "gql" => {
  try {
    const document = stringToSchema(schema);
    if (
      document !== null && typeof document === "object" &&
      ("openapi" in document || "swagger" in document)
    ) {
      return "oas";
    }
  } catch {
    // Not JSON/YAML — fall through to SDL.
  }
  return "gql";
};

const toDigest = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${encodeHex(new Uint8Array(hash))}`;
};

/** Read a response body with a hard size cap, so a huge (or endless) source
 *  fails cleanly instead of exhausting memory. */
const readCapped = async (
  response: Response,
  url: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_SOURCE_BYTES) {
    await response.body?.cancel();
    throw new SourceFetchError(
      `Source ${url} is ${declared} bytes; the limit is ${MAX_SOURCE_BYTES}.`,
    );
  }
  if (response.body === null) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await response.body.cancel();
      throw new SourceFetchError(
        `Source ${url} exceeds the ${MAX_SOURCE_BYTES}-byte limit.`,
      );
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Fetch a `source` URL: follow redirects, enforce a timeout and size cap,
 *  and report the final URL + content digest. */
export const fetchSource = async (
  url: string,
): Promise<{ schema: string; source: ResolvedSource }> => {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SourceFetchError(`Could not fetch source ${url}: ${reason}`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new SourceFetchError(
      `Source ${url} returned ${response.status} ${response.statusText}`.trim(),
    );
  }
  const bytes = await readCapped(response, url);
  return {
    schema: new TextDecoder().decode(bytes),
    source: {
      url,
      // A constructed Response (tests, some proxies) has an empty `url`;
      // fall back to the requested one.
      resolvedUrl: response.url === "" ? url : response.url,
      digest: await toDigest(bytes),
    },
  };
};

/**
 * Resolve a validated request body to a definite schema input: fetch the
 * `source` if one was given, then infer the protocol unless it was passed
 * explicitly.
 */
export const resolveSchemaInput = async (
  body: Pick<ArtifactsBody, "protocol" | "schema" | "source">,
): Promise<ResolvedSchemaInput> => {
  const fetched = body.source !== undefined
    ? await fetchSource(body.source)
    : undefined;
  const schema = fetched?.schema ?? body.schema;
  if (schema === undefined) {
    // Unreachable behind the request schema's exactly-one check.
    throw new SchemaReadError("No schema input provided.");
  }
  return {
    protocol: body.protocol ?? inferProtocol(schema),
    schema,
    ...(fetched !== undefined ? { source: fetched.source } : {}),
  };
};
