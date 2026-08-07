import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import {
  assertSdlReadable,
  fetchSource,
  inferProtocol,
  SchemaReadError,
  SourceFetchError,
} from "./schemaInput.ts";

/** SDL a caller can plausibly post. `type Query { a: Int }` on one line reads
 *  as a YAML mapping, and a field named `openapi` fails the YAML parse — so
 *  neither "it parsed" nor "it threw" can decide the protocol on its own. */
const SDL_DOCUMENTS: [string, string][] = [
  ["multi-line", "type Query {\n  a: Int\n}\n"],
  ["single line", "type Query { a: Int }"],
  ["field named openapi", "type Query {\n  openapi: String\n  a: Int\n}\n"],
  ["field named swagger", "type Query {\n  swagger: String\n}\n"],
  ["leading comment", "# The API\ntype Query {\n  a: Int\n}\n"],
  ["leading docstring", '"""The API"""\ntype Query {\n  a: Int\n}\n'],
  ["schema block", "schema {\n  query: Query\n}\ntype Query { a: Int }"],
  ["enum and input", "enum Role { ADMIN }\ninput Filter { q: String }"],
  ["scalar", "scalar DateTime\ntype Query { at: DateTime }"],
  ["directive", "directive @auth on FIELD_DEFINITION\ntype Query { a: Int }"],
  ["interface", "interface Node {\n  id: ID!\n}\n"],
  ["extension", "extend type Query {\n  b: Int\n}\n"],
  ["indented", "\n  type Query {\n    ping: Boolean\n  }\n"],
];

const OAS_DOCUMENTS: [string, string][] = [
  ["json 3.0", '{"openapi": "3.0.0", "info": {}, "paths": {}}'],
  ["yaml 3.0", "openapi: 3.0.0\ninfo:\n  title: x\npaths: {}\n"],
  ["swagger 2.0", '{"swagger": "2.0", "info": {}, "paths": {}}'],
  ["yaml swagger 2.0", "swagger: '2.0'\ninfo:\n  title: x\n"],
];

/** Documents that are neither protocol. Each used to be handed to the
 *  GraphQL parser, which could only report that they are not SDL. */
const UNREADABLE_DOCUMENTS: [string, string][] = [
  ["html error page", "<!doctype html><html><body>404</body></html>"],
  ["json without a version key", '{"paths": {"/a": {}}, "info": {}}'],
  ["yaml without a version key", "info:\n  title: x\npaths: {}\n"],
  ["truncated json", '{"openapi": "3.0.0", "info": {'],
  ["bad indent yaml", "openapi: 3.0.0\ninfo:\n  title: x\n   bad: y"],
  ["empty", "   "],
  ["prose", "Not found. Please sign in to view this schema."],
  // YAML block scalars carry prose, and a wrapped line can open with an SDL
  // keyword and whitespace. Matching keyword-plus-whitespace alone sent these
  // to the GraphQL parser — the first below even announces itself as OAS on
  // line 1 and still came back as a GraphQL syntax error.
  [
    "truncated oas yaml whose prose opens with `schema `",
    "openapi: 3.0.0\ninfo:\n  description: >\n    schema defined in " +
    "components.\n  title: x\n   bad: y",
  ],
  [
    "components-only yaml whose prose opens with `type `",
    "components:\n  schemas:\n    Widget:\n      description: >\n" +
    "        type of widget is not yet decided.\n",
  ],
  [
    "prose opening with `interface `",
    "interface not available. Sign in to view this schema.",
  ],
];

Deno.test("inferProtocol - reads GraphQL SDL as gql", () => {
  for (const [label, document] of SDL_DOCUMENTS) {
    assertEquals(inferProtocol(document), "gql", label);
  }
});

Deno.test("inferProtocol - reads an OpenAPI document as oas", () => {
  for (const [label, document] of OAS_DOCUMENTS) {
    assertEquals(inferProtocol(document), "oas", label);
  }
});

Deno.test("inferProtocol - refuses a document that is neither", () => {
  for (const [label, document] of UNREADABLE_DOCUMENTS) {
    assertThrows(() => inferProtocol(document), SchemaReadError, undefined, label);
  }
});

Deno.test("inferProtocol - an unparseable document announcing `openapi:` names the YAML failure", () => {
  // Not just "a 422": the reason has to name the real problem. Classified as
  // SDL, this reported a GraphQL syntax error about a document whose first
  // line says it is OpenAPI.
  const error = assertThrows(
    () =>
      inferProtocol(
        "openapi: 3.0.0\ninfo:\n  description: >\n    type of widget is " +
          "unclear\n  title: x\n   bad: y",
      ),
    SchemaReadError,
  );
  assertStringIncludes(error.message, "Could not read the document");
});

Deno.test("assertSdlReadable - accepts every SDL document", () => {
  for (const [label, document] of SDL_DOCUMENTS) {
    assertSdlReadable(document);
    assertEquals(inferProtocol(document), "gql", label);
  }
});

Deno.test("assertSdlReadable - refuses a document carrying no SDL definition", () => {
  // The gate an explicit `protocol: "gql"` has to clear too, so passing the
  // protocol is not a way past the readability contract.
  for (const [label, document] of UNREADABLE_DOCUMENTS) {
    assertThrows(() => assertSdlReadable(document), SchemaReadError, undefined, label);
  }
});

/** `fetchSource` with `globalThis.fetch` replaced, so no test touches the
 *  network — a blocked URL must fail before `fetch` is reached at all. */
const withStubbedFetch = async (
  stub: (input: URL | RequestInfo, init?: RequestInit) => Response,
  body: () => Promise<void>,
) => {
  const original = globalThis.fetch;
  globalThis.fetch =
    ((input: URL | RequestInfo, init?: RequestInit) =>
      Promise.resolve(stub(input, init))) as typeof fetch;
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
};

Deno.test("fetchSource - spends one timeout budget across every redirect hop", async () => {
  const signals: (AbortSignal | null | undefined)[] = [];
  await withStubbedFetch(
    (input, init) => {
      signals.push(init?.signal);
      return String(input) === "https://example.com/a"
        ? new Response(null, { status: 302, headers: { location: "/b" } })
        : new Response('{"openapi": "3.0.0"}', { status: 200 });
    },
    async () => {
      await fetchSource("https://example.com/a");

      // Built per hop, the documented 10s budget would really be 10s × hops,
      // so a slow chain could hold a request open far past the limit the
      // `source` description advertises. One signal, threaded, is the fix.
      assertEquals(signals.length, 2);
      assertEquals(signals[0] instanceof AbortSignal, true);
      assertStrictEquals(signals[0], signals[1]);
    },
  );
});

/** Loopback, RFC1918, carrier-grade NAT, link-local (cloud metadata),
 *  unique-local, IPv4-mapped loopback, and private-by-convention names —
 *  in both the literal and bracketed IPv6 forms a caller can write. */
const PRIVATE_URLS = [
  "http://localhost:8080/internal/config",
  "http://127.0.0.1/x",
  "http://10.0.0.1/x",
  "http://172.16.4.4/x",
  "http://192.168.1.1/x",
  "http://100.64.0.1/x",
  "http://169.254.169.254/latest/meta-data/",
  "http://[::1]:9000/x",
  "http://[::ffff:127.0.0.1]/x",
  "http://[fd00::1]/x",
  "http://[fe80::1]/x",
  "http://build.internal/openapi.json",
  "http://printer.local/openapi.json",
  // Fully-qualified forms: `URL` keeps the trailing dot, and `localhost.`
  // resolves exactly where `localhost` does.
  "http://localhost./x",
  "http://localhost.:8080/admin",
  "http://build.internal./openapi.json",
  "http://printer.local./openapi.json",
  // `URL` lowercases the host, so the check sees one casing.
  "http://LOCALHOST/x",
];

Deno.test("fetchSource - refuses a private target without reaching fetch", async () => {
  await withStubbedFetch(
    () => {
      throw new Error("fetch must not be attempted");
    },
    async () => {
      for (const url of PRIVATE_URLS) {
        const error = await assertRejects(
          () => fetchSource(url),
          SourceFetchError,
        );
        assertStringIncludes(error.message, "private address");
      }
    },
  );
});

Deno.test("fetchSource - fetches a public target", async () => {
  await withStubbedFetch(
    () => new Response("{}", { status: 200 }),
    async () => {
      for (const url of ["https://example.com/x", "http://[2606:4700::1]/x"]) {
        const { schema } = await fetchSource(url);
        assertEquals(schema, "{}");
      }
    },
  );
});

Deno.test("fetchSource - stops after the redirect limit", async () => {
  await withStubbedFetch(
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/again" },
      }),
    async () => {
      const error = await assertRejects(
        () => fetchSource("https://example.com/start"),
        SourceFetchError,
      );
      assertStringIncludes(error.message, "redirects");
    },
  );
});
