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
const MAX_REDIRECTS = 5;

/**
 * Does this text carry a GraphQL SDL definition? Every SDL keyword that can
 * open a definition, followed by whitespace — which is what separates SDL's
 * `type Query {` from YAML's `type: string`.
 *
 * This is a POSITIVE test, deliberately: gql is not the fallthrough for
 * "everything that isn't OpenAPI". An HTML error page and a JSON document
 * with no `openapi` key are neither protocol, and saying so beats handing
 * them to the GraphQL parser and reporting its syntax error.
 */
const looksLikeSdl = (schema: string): boolean =>
  /^[ \t]*(type|interface|enum|union|input|scalar|schema|directive|extend)[ \t]+/m
    .test(schema);

type ParseOutcome =
  /** Read as a JSON/YAML mapping — the shape an OAS document has. */
  | { kind: "document"; document: object }
  /** Read, but not as a mapping: a plain scalar (an HTML page reads as one),
   *  a list, `null`. */
  | { kind: "scalar" }
  | { kind: "unreadable"; reason: string };

const toParseOutcome = (schema: string): ParseOutcome => {
  try {
    const parsed = stringToSchema(schema);
    return parsed !== null && typeof parsed === "object" &&
        !Array.isArray(parsed)
      ? { kind: "document", document: parsed }
      : { kind: "scalar" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "unreadable", reason };
  }
};

/**
 * Infer the protocol from document content: a JSON/YAML mapping carrying an
 * `openapi` or `swagger` key is OAS; a document carrying an SDL definition is
 * GraphQL. Anything else raises `SchemaReadError` (→ 422) rather than being
 * routed to a parser that will only be able to say the text is not its
 * language — an HTML error page from a `source` behind an SSO wall, a JSON
 * document with no `openapi` key, a truncated document, an empty response.
 *
 * The two tests are independent, so neither ordering nor the parse succeeding
 * decides the answer alone: single-line SDL (`type Query { a: Int }`) reads as
 * a YAML mapping, and SDL with a field named `openapi` fails the YAML parse.
 */
export const inferProtocol = (schema: string): "oas" | "gql" => {
  if (schema.trim() === "") {
    throw new SchemaReadError("The schema document is empty.");
  }
  const outcome = toParseOutcome(schema);
  if (
    outcome.kind === "document" &&
    ("openapi" in outcome.document || "swagger" in outcome.document)
  ) {
    return "oas";
  }
  if (looksLikeSdl(schema)) return "gql";
  throw new SchemaReadError(
    outcome.kind === "unreadable"
      ? `Could not read the document as JSON or YAML: ${outcome.reason}. ` +
        "Pass an OpenAPI document or GraphQL SDL."
      : "The document is neither an OpenAPI document (no `openapi` or " +
        "`swagger` key) nor GraphQL SDL.",
  );
};

const toDigest = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${encodeHex(new Uint8Array(hash))}`;
};

/** Read a response body with a hard size cap, so a huge (or endless) source
 *  fails cleanly instead of exhausting memory.
 *
 *  The body is drained through an explicit reader rather than `for await`:
 *  the loop's implicit reader locks the stream, and cancelling a locked
 *  stream throws `TypeError`, which would turn the size-cap 422 into a 500. */
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

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new SourceFetchError(
        `Source ${url} exceeds the ${MAX_SOURCE_BYTES}-byte limit.`,
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Drain the body, reporting a mid-stream failure — the read timing out,
 *  the connection resetting — as the same `SourceFetchError` a failed
 *  connect produces. `fetch` resolves once headers arrive, so without this
 *  everything that goes wrong while reading escapes as a 500. */
const readSourceBody = async (
  response: Response,
  url: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  try {
    return await readCapped(response, url);
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new SourceFetchError(`Could not read source ${url}: ${reason}`);
  }
};

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Loopback, private (RFC1918), carrier-grade NAT, link-local (which is
 *  where cloud metadata services live) and "this network". */
const isPrivateIpv4 = (hostname: string): boolean => {
  const match = IPV4_PATTERN.exec(hostname);
  if (match === null) return false;
  const [first, second] = match.slice(1).map(Number);
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127);
};

/** Loopback / unspecified, unique-local (`fc00::/7`), link-local
 *  (`fe80::/10`), plus IPv4-mapped forms of the blocked v4 ranges. */
const isPrivateIpv6 = (hostname: string): boolean => {
  if (!hostname.includes(":")) return false;
  const mapped = /^::ffff:(.+)$/.exec(hostname);
  if (mapped !== null) {
    const [high, low] = mapped[1].split(":");
    const dotted = low === undefined ? mapped[1] : [
      parseInt(high, 16) >> 8,
      parseInt(high, 16) & 0xff,
      parseInt(low, 16) >> 8,
      parseInt(low, 16) & 0xff,
    ].join(".");
    return isPrivateIpv4(dotted);
  }
  return hostname === "::1" || hostname === "::" ||
    /^f[cd]/.test(hostname) || /^fe[89ab]/.test(hostname);
};

/** Names that resolve inside a private network by convention. */
const isPrivateName = (hostname: string): boolean => {
  // A fully-qualified name keeps its trailing dot through `URL`, and
  // `localhost.` resolves exactly where `localhost` does.
  const name = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  return name === "localhost" ||
    [".localhost", ".local", ".internal"].some((suffix) =>
      name.endsWith(suffix)
    );
};

/**
 * Reject a `source` that points at the deployment's own network rather than
 * a public schema. Deno subhosting already isolates a stack server from any
 * internal network, so this is defence in depth — but it also keeps the
 * error honest (a private target names itself) and holds if the same server
 * is ever run somewhere less isolated.
 *
 * Checked per redirect hop, not just on the requested URL: `redirect:
 * "follow"` would hand a public-looking URL a free hop to an internal one.
 * A hostname that RESOLVES to a private address is not covered — that needs
 * DNS resolution the deployment target does not guarantee.
 */
const toFetchableUrl = (url: string): URL => {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SourceFetchError(
      `Source ${url} must use http or https, not ${parsed.protocol}`,
    );
  }
  // `URL` brackets an IPv6 literal and lowercases the host.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (
    isPrivateName(hostname) || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)
  ) {
    throw new SourceFetchError(
      `Source ${url} targets a private address (${hostname}); ` +
        "only publicly reachable http(s) URLs can be fetched.",
    );
  }
  return parsed;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch, following redirects one hop at a time so every hop's target is
 * checked before it is requested. Returns the response together with the
 * URL that produced it — the reliable resolved URL, where `response.url` is
 * empty on a constructed Response.
 */
const fetchFollowing = async (
  url: string,
  hopsLeft: number,
): Promise<{ response: Response; resolvedUrl: string }> => {
  const target = toFetchableUrl(url);
  const response = await fetch(target, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "manual",
  });
  const location = response.headers.get("location");
  if (!REDIRECT_STATUSES.has(response.status) || location === null) {
    return { response, resolvedUrl: target.href };
  }
  await response.body?.cancel();
  if (hopsLeft === 0) {
    throw new SourceFetchError(
      `Source ${url} exceeded ${MAX_REDIRECTS} redirects.`,
    );
  }
  return fetchFollowing(new URL(location, target).href, hopsLeft - 1);
};

/** `fetchFollowing`, with any network-level failure (DNS, refused connect,
 *  connect timeout) reported as a `SourceFetchError`. */
const fetchChecked = async (
  url: string,
): Promise<{ response: Response; resolvedUrl: string }> => {
  try {
    return await fetchFollowing(url, MAX_REDIRECTS);
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new SourceFetchError(`Could not fetch source ${url}: ${reason}`);
  }
};

/** Fetch a `source` URL: follow redirects, enforce a timeout and size cap,
 *  and report the final URL + content digest. */
export const fetchSource = async (
  url: string,
): Promise<{ schema: string; source: ResolvedSource }> => {
  const { response, resolvedUrl } = await fetchChecked(url);

  if (!response.ok) {
    await response.body?.cancel();
    // Status only — the target's `statusText` is its text, not ours.
    throw new SourceFetchError(`Source ${url} returned ${response.status}`);
  }
  const bytes = await readSourceBody(response, url);
  return {
    schema: new TextDecoder().decode(bytes),
    source: { url, resolvedUrl, digest: await toDigest(bytes) },
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
