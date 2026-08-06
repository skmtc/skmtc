import { assertEquals, assertExists } from "@std/assert";
import * as v from "valibot";
import type {
  Enrichments,
  GeneratorsMapContainer,
  ModelEntry,
  TransformModelArgs,
} from "@skmtc/core";
import { emptyEnrichmentSchema } from "@skmtc/core";
import { createServer } from "./createServer.ts";

/**
 * Integration tests for `createServer`.
 *
 * Uses an empty generator map — the goal is to verify the request
 * routing and `protocol` dispatch, not the generator output. Both the
 * `'oas'` and `'gql'` branches should accept their respective input
 * shapes and return a 200 with `artifacts` + `manifest` in the body.
 */

const minimalOas = {
  openapi: "3.0.0",
  info: { title: "Test", version: "1.0.0" },
  paths: {},
};

const minimalSdl = /* GraphQL */ `
  type Query {
    ping: Boolean
  }
`;

const mkApp = () =>
  createServer({
    toGeneratorConfigMap: () => ({}),
  });

Deno.test("POST /artifacts - infers protocol=oas from an OpenAPI document", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schema: JSON.stringify(minimalOas) }),
  });

  // No `protocol` field → inferred from the document content (the
  // `openapi` key marks it as OAS).
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.artifacts);
  assertExists(body.manifest);
});

Deno.test("POST /artifacts - infers protocol=gql from SDL", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schema: minimalSdl }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.artifacts);
  assertExists(body.manifest);
});

Deno.test("POST /artifacts - rejects body with neither schema nor source", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ protocol: "oas" }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_request");
});

Deno.test("POST /artifacts - rejects body with both schema and source", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schema: JSON.stringify(minimalOas),
      source: "https://example.com/openapi.json",
    }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_request");
});

Deno.test("POST /artifacts - rejects a non-http source URL", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "ftp://example.com/openapi.json" }),
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_request");
});

Deno.test("POST /artifacts - non-JSON body returns a structured 400", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not json",
  });

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_request");
});

Deno.test("POST /artifacts - unreadable OAS document returns a structured 422", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ protocol: "oas", schema: '{"openapi": truncated' }),
  });

  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, "invalid_schema");
  assertExists(body.message);
});

Deno.test("POST /artifacts - accepts protocol=oas with OpenAPI body", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocol: "oas",
      schema: JSON.stringify(minimalOas),
    }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.artifacts);
  assertExists(body.manifest);
  // Attribution is always enabled with a post-pass, so both fields are
  // present (empty here — the empty generator map emits no files).
  assertEquals(Array.isArray(body.generationMap), true);
  assertExists(body.sidecars);
});

Deno.test("POST /artifacts - accepts protocol=gql with GraphQL SDL", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocol: "gql",
      schema: minimalSdl,
    }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.artifacts);
  assertExists(body.manifest);
});

Deno.test("POST /artifacts - rejects body with invalid protocol", async () => {
  const app = mkApp();
  const res = await app.request("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schema: "whatever", protocol: "soap" }),
  });

  // An unknown protocol is a validation failure → structured 400.
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_request");
});

Deno.test("GET /generators - lists configured generator IDs", async () => {
  const modelGen: ModelEntry<Enrichments> = {
    id: "modelGen",
    type: "model",
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    isSupported: () => true,
    supportsVariant: () => false,
    transform(_args: TransformModelArgs): void {},
  };
  const app = createServer({
    toGeneratorConfigMap: (() => ({ modelGen })) as <
      EnrichmentType = undefined,
    >() => GeneratorsMapContainer<EnrichmentType>,
  });

  const res = await app.request("/generators");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.generators, ["modelGen"]);
});

Deno.test("POST /descriptors - returns one descriptor per generator", async () => {
  type Enrichment = { coerce?: boolean };
  const modelGen: ModelEntry<Enrichment> = {
    id: "modelGen",
    type: "model",
    isSupported: () => true,
    supportsVariant: () => false,
    toEnrichmentSchema: () => v.object({ coerce: v.optional(v.boolean()) }),
    transform(_args: TransformModelArgs): void {},
  };
  const app = createServer({
    toGeneratorConfigMap: (() => ({ modelGen })) as <
      EnrichmentType = undefined,
    >() => GeneratorsMapContainer<EnrichmentType>,
  });

  const res = await app.request("/descriptors", { method: "POST" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.descriptors.length, 1);
  assertEquals(body.descriptors[0].generator, "modelGen");
  assertEquals(body.descriptors[0].subjectType, "model");
  // The `coerce` boolean maps to a `toggle` field.
  assertEquals(body.descriptors[0].fields[0].key, "coerce");
  assertEquals(body.descriptors[0].fields[0].type, "toggle");
});

Deno.test("POST /enrichment-defaults - empty generator map returns empty defaults", async () => {
  const app = mkApp();
  const res = await app.request("/enrichment-defaults", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocol: "oas",
      schema: JSON.stringify(minimalOas),
    }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.enrichmentDefaults, {});
  assertEquals(body.parseIssues, []);
});

Deno.test("POST /enrichment-defaults - returns seeded defaults per supported subject", async () => {
  type Enrichment = {
    subject?: { note?: string };
    generator?: undefined;
    stack?: undefined;
  };
  const modelGen: ModelEntry<Enrichment> = {
    id: "modelGen",
    type: "model",
    isSupported: () => true,
    supportsVariant: () => false,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(v.object({ note: v.optional(v.string()) })),
        generator: v.undefined(),
        stack: v.undefined(),
      }),
    transform(_args: TransformModelArgs): void {},
    toEnrichmentDefaults: ({ refName }) => ({
      subject: { note: `model ${refName}` },
      generator: undefined,
      stack: undefined,
    }),
  };
  const app = createServer({
    toGeneratorConfigMap: (() => ({ modelGen })) as <
      EnrichmentType = undefined,
    >() => GeneratorsMapContainer<EnrichmentType>,
  });

  const oasWithModel = {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0.0" },
    paths: {},
    components: { schemas: { Widget: { type: "object" } } },
  };

  const res = await app.request("/enrichment-defaults", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      protocol: "oas",
      schema: JSON.stringify(oasWithModel),
    }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  // Keyed by the `enrichments` config routing: `[id][refName]['main']`.
  assertEquals(body.enrichmentDefaults, {
    modelGen: { Widget: { main: { note: "model Widget" } } },
  });
});

/** Run `body` with `globalThis.fetch` replaced — the server fetches `source`
 *  URLs through it, so tests need no network access. */
const withStubbedFetch = async (
  stub: (input: URL | RequestInfo) => Response | Promise<Response>,
  body: () => Promise<void>,
) => {
  const original = globalThis.fetch;
  globalThis.fetch =
    ((input: URL | RequestInfo) =>
      Promise.resolve(stub(input))) as typeof fetch;
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
};

Deno.test("POST /artifacts - fetches a source URL and echoes the resolved source", async () => {
  const requested: string[] = [];
  await withStubbedFetch(
    (input) => {
      requested.push(String(input));
      return new Response(JSON.stringify(minimalOas), { status: 200 });
    },
    async () => {
      const app = mkApp();
      const res = await app.request("/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "https://example.com/openapi.json" }),
      });

      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.artifacts);
      assertExists(body.manifest);
      assertEquals(requested, ["https://example.com/openapi.json"]);
      // The reproducibility receipt: requested URL, final URL (a constructed
      // Response has no url, so it falls back to the requested one), digest.
      assertEquals(body.source.url, "https://example.com/openapi.json");
      assertEquals(body.source.resolvedUrl, "https://example.com/openapi.json");
      assertEquals(body.source.digest.startsWith("sha256:"), true);
    },
  );
});

Deno.test("POST /artifacts - non-2xx source returns a structured 422", async () => {
  await withStubbedFetch(
    () => new Response("nope", { status: 404, statusText: "Not Found" }),
    async () => {
      const app = mkApp();
      const res = await app.request("/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "https://example.com/missing.json" }),
      });

      assertEquals(res.status, 422);
      const body = await res.json();
      assertEquals(body.error, "source_fetch_failed");
      assertEquals(body.message.includes("404"), true);
    },
  );
});

Deno.test("POST /artifacts - unreachable source returns a structured 422", async () => {
  await withStubbedFetch(
    () => {
      throw new TypeError("connection refused");
    },
    async () => {
      const app = mkApp();
      const res = await app.request("/artifacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "https://example.com/openapi.json" }),
      });

      assertEquals(res.status, 422);
      const body = await res.json();
      assertEquals(body.error, "source_fetch_failed");
    },
  );
});

Deno.test("POST /subjects - accepts a source URL", async () => {
  await withStubbedFetch(
    () => new Response(JSON.stringify(minimalOas), { status: 200 }),
    async () => {
      const app = mkApp();
      const res = await app.request("/subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "https://example.com/openapi.json" }),
      });

      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.subjects);
      assertEquals(body.parseIssues, []);
    },
  );
});

Deno.test("POST /to-v3-json - accepts a source URL", async () => {
  await withStubbedFetch(
    () => new Response(JSON.stringify(minimalOas), { status: 200 }),
    async () => {
      const app = mkApp();
      const res = await app.request("/to-v3-json", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "https://example.com/openapi.json" }),
      });

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.schema.openapi, "3.0.0");
    },
  );
});

Deno.test("POST /to-v3-json - converts OpenAPI source to v3 JSON", async () => {
  const app = mkApp();
  const res = await app.request("/to-v3-json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schema: JSON.stringify(minimalOas) }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.schema.openapi, "3.0.0");
});
